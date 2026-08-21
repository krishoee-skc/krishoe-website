import { NextRequest, NextResponse } from "next/server";
import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { addStockMovement } from "@/lib/operations";
import { queryPostgres } from "@/lib/postgres/client";
import { syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";
import { reportingErrors } from "@/lib/report-error";

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

type StageRow = { item_id: string; item_name: string; category: string; pairs: number };
type PostedRow = { design: string; pairs: number };
type ProductRow = { id: string; name: string; status: string; stock: number };

export type ReadyItem = {
  itemId: string;
  name: string;
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
        `SELECT work.item_id, items.name AS item_name, workers.category,
                SUM(work.pairs_count)::integer AS pairs
         FROM factory_daily_work work
         JOIN factory_items items ON items.id = work.item_id
         JOIN factory_workers workers ON workers.id = work.worker_id
         WHERE items.status = 'active'
         GROUP BY work.item_id, items.name, workers.category
         ORDER BY items.name ASC, workers.category ASC`,
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
      const existing = byItem.get(row.item_id);
      const entry: ReadyItem = existing ?? {
        itemId: row.item_id,
        name: row.item_name,
        stages: [],
        madePairs: 0,
        postedPairs: postedByDesign.get(key(row.item_name)) ?? 0,
        pendingPairs: 0,
        productName: productByName.get(key(row.item_name))?.name ?? null,
        productStatus: productByName.get(key(row.item_name))?.status ?? null,
        productStock: productByName.get(key(row.item_name))?.stock ?? null,
      };

      entry.stages.push({ category: row.category, pairs: Number(row.pairs) || 0 });
      byItem.set(row.item_id, entry);
    }

    const items = [...byItem.values()].map((entry) => {
      // The smallest stage total, never the sum: 60 uppers and 60 bottoms are
      // 60 finished pairs. Summing them is the mistake this whole screen
      // exists to prevent.
      const madePairs = entry.stages.reduce(
        (least, stage) => Math.min(least, stage.pairs),
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
    const movement = await addStockMovement({
      design: items[0].name,
      channel: "Factory",
      sizeRun: "Mixed",
      type: "Production In",
      pairs,
      note: note || "कारखानाबाट तयार",
    });

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
