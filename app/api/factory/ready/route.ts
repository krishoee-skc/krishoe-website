import { NextRequest, NextResponse } from "next/server";
import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { addStockMovement } from "@/lib/operations";
import { queryPostgres } from "@/lib/postgres/client";
import { syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";
import { reportingErrors } from "@/lib/report-error";
import { colourKey } from "@/lib/colour-name";
import { sizeRunKey } from "@/lib/shoe-sizes";

const STORE = "krishoe";

/**
 * The bridge between "who made what" and "what is on the shelf".
 *
 * Wages and stock are two separate ledgers on purpose: one shoe passes through
 * Upper and Fibermen, so a wage entry per stage means 60 pairs are recorded
 * twice — and if either entry moved stock, 60 finished pairs would appear as
 * 120. The owner spotted that risk themselves before writing a single entry.
 *
 * The cost of keeping them separate is that nothing tells you how far apart
 * they have drifted. Work can be entered for a week with nobody posting the
 * pairs, and the shop sits at SOLD OUT with a full godown behind it; or the
 * same pairs can be posted twice, and the shop sells what is not there. Both
 * are silent.
 *
 * So this reports the gap and lets the owner close it. It reports; it never
 * decides. The pairs that go into stock are the ones counted in the godown —
 * the owner's own rule, and the only number that is ever true.
 */

type StageRow = {
  item_id: string;
  item_name: string;
  category: string;
  colour: string | null;
  size: string | null;
  pairs: number;
};
type PostedRow = { design: string; pairs: number };
type ProductRow = { id: string; name: string; status: string; stock: number };

export type ReadyItem = {
  itemId: string;
  name: string;
  /** The colour these pairs were made in, as it was written on the work. */
  colour: string;
  /** The size run these pairs were made in. */
  sizeRun: string;
  /** Pairs recorded per factory stage, all time. */
  stages: { category: string; pairs: number }[];
  /** A pair is finished only once every stage has had it, so the smallest wins. */
  madePairs: number;
  postedPairs: number;
  pendingPairs: number;
  /** The shop product this name reaches, if any. */
  productName: string | null;
  productStatus: string | null;
  productStock: number | null;
};

export async function GET() {
  const denied = await authorizeFactoryApi("/api/factory/ready", "GET");
  if (denied) return denied;

  try {
    const [stages, posted, products] = await Promise.all([
      queryPostgres<StageRow>(
        STORE,
        // Group by the entry's own stage — the work actually done — falling
        // back to the worker's category for old rows written before the stage
        // column existed. So an Upper man who did fiber silai counts as Fiber
        // Silai here, matching what was really made.
        `SELECT work.item_id, items.name AS item_name,
                COALESCE(NULLIF(work.stage, ''), workers.category) AS category,
                work.color AS colour, work.size,
                SUM(work.pairs_count)::integer AS pairs
         FROM factory_daily_work work
         JOIN factory_items items ON items.id = work.item_id
         JOIN factory_workers workers ON workers.id = work.worker_id
         WHERE items.status = 'active' AND work.status <> 'Reversed'
         GROUP BY work.item_id, items.name,
                  COALESCE(NULLIF(work.stage, ''), workers.category),
                  work.color, work.size
         ORDER BY items.name ASC, work.color ASC, category ASC`,
      ),
      // Everything already turned into shelf stock for this design, by any
      // route — this screen, the Operations form, or Packing/QC.
      queryPostgres<PostedRow>(
        STORE,
        `SELECT lower(regexp_replace(btrim(design), '\\s+', ' ', 'g')) AS design,
                SUM(pairs)::integer AS pairs
         FROM stock_movements
         WHERE type IN ('Production In', 'Adjustment')
         GROUP BY 1`,
      ),
      queryPostgres<ProductRow>(
        STORE,
        `SELECT id, name, status, stock FROM products`,
      ),
    ]);

    const key = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
    const postedByDesign = new Map(posted.map((row) => [row.design, Number(row.pairs) || 0]));
    const productByName = new Map(products.map((row) => [key(row.name), row]));

    const byItem = new Map<string, ReadyItem>();

    for (const row of stages) {
      // Grouped by what the pairs actually are, not by the shoe's name alone.
      // Sixty black uppers and sixty cherry bottoms under one name read as
      // "sixty ready" and would post sixty pairs of nothing.
      //
      // The two keys are what make that grouping hold: this shop's own records
      // carry "Black" against "black" and "36/41" against the chips'
      // "36, 37, 38, 39, 40, 41", and without them each spelling becomes its
      // own half-sized group.
      const groupKey = `${row.item_id}|${colourKey(row.colour)}|${sizeRunKey(row.size)}`;
      const existing = byItem.get(groupKey);
      const entry: ReadyItem = existing ?? {
        itemId: row.item_id,
        name: row.item_name,
        // Kept as written, so the row can name itself on screen; the keys above
        // are for matching, never for display.
        colour: (row.colour ?? "").trim(),
        sizeRun: (row.size ?? "").trim(),
        stages: [],
        madePairs: 0,
        postedPairs: postedByDesign.get(key(row.item_name)) ?? 0,
        pendingPairs: 0,
        productName: productByName.get(key(row.item_name))?.name ?? null,
        productStatus: productByName.get(key(row.item_name))?.status ?? null,
        productStock: productByName.get(key(row.item_name))?.stock ?? null,
      };

      entry.stages.push({ category: row.category, pairs: Number(row.pairs) || 0 });
      byItem.set(groupKey, entry);
    }

    const items = [...byItem.values()].map((entry) => {
      // A pair passes through both stages — Upper and Fibermen — so it is
      // finished only when both have made it. The count is the smaller stage,
      // never the sum: 60 uppers and 60 fibers are 60 finished pairs. And a
      // stage with no entry at all counts as zero, not as "not required" — an
      // upper made with no fiber yet is zero finished pairs, so posting is held
      // back until the fiber is entered too. Summing, or ignoring a missing
      // stage, is the mistake this screen exists to prevent.
      const REQUIRED_STAGES = ["Upper", "Fibermen"];
      const pairsByStage = new Map(entry.stages.map((s) => [s.category, s.pairs]));
      // Only treat the two known stages as required; any extra category the
      // shop uses is folded in through the min of what's present, so it never
      // wrongly blocks a design that genuinely runs on one stage.
      const relevant = REQUIRED_STAGES.some((s) => pairsByStage.has(s))
        ? REQUIRED_STAGES.map((s) => pairsByStage.get(s) ?? 0)
        : entry.stages.map((s) => s.pairs);
      const madePairs = relevant.reduce(
        (least, pairs) => Math.min(least, pairs),
        Number.POSITIVE_INFINITY,
      );

      return {
        ...entry,
        madePairs: Number.isFinite(madePairs) ? madePairs : 0,
        pendingPairs: Math.max(0, (Number.isFinite(madePairs) ? madePairs : 0) - entry.postedPairs),
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error building the ready-to-post list:", error);
    return NextResponse.json({ error: "Could not read what is ready" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/ready", "POST");
  if (denied) return denied;

  try {
    const body = await request.json();
    const itemId = typeof body.item_id === "string" ? body.item_id.trim() : "";
    const pairs = Math.trunc(Number(body.pairs));
    const note = typeof body.note === "string" ? body.note.trim() : "";

    // The caller's own key, reused on a retry. A double tap on a factory phone,
    // a slow request the browser sent twice, or a back-and-forward each arrive
    // here as a second post — and each would have added another sixty pairs to
    // a godown that has sixty. Optional, so every older caller (the Operations
    // form, Packing/QC, the purchase posting) keeps working untouched.
    const submissionKey =
      typeof body.submission_key === "string" ? body.submission_key.trim().slice(0, 200) : "";

    if (submissionKey) {
      const seen = await queryPostgres<{ id: string; pairs: number; design: string }>(
        STORE,
        `SELECT id, pairs, design FROM stock_movements WHERE submission_key = $1 LIMIT 1`,
        [submissionKey],
      );

      // A replay is a success, not an error: the pairs the caller asked for are
      // in stock, which is what they wanted to know. Saying "already posted"
      // with a failure code would send the owner looking for a problem.
      if (seen[0]) {
        return NextResponse.json({
          movementId: seen[0].id,
          pairs: Number(seen[0].pairs) || 0,
          design: seen[0].design,
          replayed: true,
        });
      }
    }

    if (!itemId) {
      return NextResponse.json({ error: "item_id is required" }, { status: 400 });
    }
    if (!Number.isFinite(pairs) || pairs <= 0) {
      return NextResponse.json({ error: "कति जोडी तयार भयो, त्यो हाल्नुहोस्" }, { status: 400 });
    }

    const items = await queryPostgres<{ name: string }>(
      STORE,
      `SELECT name FROM factory_items WHERE id = $1 AND status = 'active'`,
      [itemId],
    );
    if (!items[0]) {
      return NextResponse.json({ error: "Factory Item not found" }, { status: 404 });
    }

    // Recorded under the factory item's own name, which is what the catalog
    // sync matches products on. Where no product carries that name yet, the
    // sync creates a Draft one rather than losing the pairs — the same door
    // every other stock movement uses.
    // Posted under the size run the pairs were actually made in, not "Mixed".
    // The Stock screen joins finished_stock to stock_locations on design *and*
    // size run, so a run of 36/41 filed as "Mixed" lands in a row nothing
    // matches — the pairs count, but the screen cannot say where they are.
    // Falls back to "Mixed" when the caller sends none, which is what every
    // older caller does.
    const sizeRun = typeof body.size_run === "string" && body.size_run.trim()
      ? body.size_run.trim()
      : "Mixed";

    const movement = await addStockMovement({
      design: items[0].name,
      channel: "Factory",
      sizeRun,
      type: "Production In",
      pairs,
      note: note || "कारखानाबाट तयार",
    });

    // Stamped on the movement just written rather than threaded through
    // addStockMovement, which four other callers share and none of them needs
    // this. The unique index is what actually refuses a second press: two
    // landing in the same instant both read "no movement yet" above, and one of
    // them loses here. Losing means the pairs are already in — so it is
    // reported as the replay it is, not as a failure.
    if (submissionKey) {
      try {
        await queryPostgres(
          STORE,
          `UPDATE stock_movements SET submission_key = $2 WHERE id = $1`,
          [movement.id, submissionKey],
        );
      } catch {
        await queryPostgres(STORE, `DELETE FROM stock_movements WHERE id = $1`, [movement.id]);
        const winner = await queryPostgres<{ id: string; pairs: number; design: string }>(
          STORE,
          `SELECT id, pairs, design FROM stock_movements WHERE submission_key = $1 LIMIT 1`,
          [submissionKey],
        );
        return NextResponse.json({
          movementId: winner[0]?.id ?? movement.id,
          pairs: Number(winner[0]?.pairs) || pairs,
          design: winner[0]?.design ?? items[0].name,
          replayed: true,
        });
      }
    }

    await reportingErrors("sync catalog stock after factory ready posting", () =>
      syncProductCatalogStockWithFinishedStock(),
    );
    await recordAdminAuditEvent(
      "factory_ready_stock_posted",
      `${pairs} finished pairs of ${items[0].name} posted to stock from the daily screen.`,
    );

    return NextResponse.json({ movementId: movement.id, pairs, design: items[0].name });
  } catch (error) {
    console.error("Error posting finished pairs:", error);
    return NextResponse.json({ error: "स्टकमा चढाउन सकिएन" }, { status: 500 });
  }
}
