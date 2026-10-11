import { randomUUID } from "node:crypto";
import type { CountChange } from "@/lib/counter-item-rules";
import { designKey } from "@/lib/design-name";
import type { BusinessChannel } from "@/lib/operations";
import { insertStockMovement } from "@/lib/operations-postgres";
import type { PostgresExecutor } from "@/lib/postgres/client";
import { BIG_COUNT_DROP, planShelfCount } from "@/lib/shelf-count-rules";
import { stockMovementTypesStatus } from "@/lib/stock-movement-types-database";
import type { StockPlace } from "@/lib/stock-rules";

export class ShelfCountRefusal extends Error {
  ne: string;
  constructor(message: { en: string; ne: string }) {
    super(message.en);
    this.ne = message.ne;
  }
}

const KEY_SQL = "lower(regexp_replace(btrim(design), '\\s+', ' ', 'g'))";
const whole = (value: number | string | undefined | null) => Math.max(0, Math.round(Number(value) || 0));

export type ShelfCountResult = {
  design: string;
  place: StockPlace;
  /** At the place counted, size by size: what the app had and what was found. */
  changes: CountChange[];
  counted: number;
  booksBefore: number;
  booksAfter: number;
};

/**
 * Set one place's pairs to a count of its shelf (owner, 2026-10-11).
 *
 * What is counted IS that place's stock — not added on top. The other place is
 * not touched: counting the shop never wipes the factory's pairs. A size the
 * place held but that was not typed was not found, and goes to 0 there.
 *
 * The shoe's stock follows: for each size it becomes what was counted here
 * plus what the other place holds. More found goes in as an Adjustment; fewer
 * goes out as Damage Out (pairs not found), from the rows that hold them. Then
 * both places are written as they should read, so "where the pairs are" and
 * "how many there are" agree again — kitto 770 read 300 at the shop against
 * 200 in stock.
 *
 * Runs inside the caller's transaction, with the stock and place rows locked,
 * so a bill cut meanwhile cannot slip between the reading and the writing.
 */
export async function setPlaceToCount(
  db: PostgresExecutor,
  input: {
    design: string;
    place: StockPlace;
    counted: Record<string, number>;
    confirmBigDrop: boolean;
    /** Nothing typed sets the place to 0 only when this was ticked. */
    noneOnShelf: boolean;
    note: string;
  },
): Promise<ShelfCountResult> {
  const key = designKey(input.design);
  const held = await db.query<{ design: string; channel: string; size_run: string; stock_pairs: number | string }>(
    `SELECT design, channel, size_run, stock_pairs FROM finished_stock
      WHERE ${KEY_SQL} = $1
      ORDER BY created_at DESC
      FOR UPDATE`,
    [key],
  );
  const placed = await db.query<{ design: string; size_run: string; location: string; pairs: number | string }>(
    `SELECT design, size_run, location, pairs FROM stock_locations
      WHERE ${KEY_SQL} = $1
      FOR UPDATE`,
    [key],
  );
  const design = held[0]?.design ?? placed[0]?.design ?? input.design.trim();
  const other: StockPlace = input.place === "Shop" ? "Factory" : "Shop";
  const sizeOf = (run: string) => run.trim() || "Mixed";

  const books: Record<string, number> = {};
  for (const row of held) books[sizeOf(row.size_run)] = (books[sizeOf(row.size_run)] ?? 0) + whole(row.stock_pairs);
  const here: Record<string, number> = {};
  const there: Record<string, number> = {};
  for (const row of placed) {
    const bucket = row.location === input.place ? here : row.location === other ? there : null;
    if (bucket) bucket[sizeOf(row.size_run)] = (bucket[sizeOf(row.size_run)] ?? 0) + whole(row.pairs);
  }
  const counted = Object.fromEntries(
    Object.entries(input.counted)
      .map(([size, pairs]) => [size.trim(), whole(pairs)] as const)
      .filter(([size, pairs]) => size && pairs > 0),
  );

  if (Object.keys(counted).length === 0 && !input.noneOnShelf) {
    throw new ShelfCountRefusal({
      en: "Nothing was typed. Type what you found on the shelf, or tick “Nothing of this shoe on the shelf”.",
      ne: "केही लेखिएन। र्‍याकमा भेटिएको लेख्नुहोस्, वा “र्‍याकमा यो जुत्ता छैन” मा टिक लगाउनुहोस्।",
    });
  }
  const { placeChanges: changes, stockMoves, fewer } = planShelfCount({ books, here, there, counted });
  if (fewer >= BIG_COUNT_DROP && !input.confirmBigDrop) {
    throw new ShelfCountRefusal({
      en: `${fewer} pairs fewer than the app holds here. Tick "I counted again" to save it.`,
      ne: `यहाँ app मा भन्दा ${fewer} जोडी कम भेटियो। "फेरि गनेँ" मा टिक लगाएर राख्नुहोस्।`,
    });
  }

  if (stockMoves.some((move) => move.change < 0) && !(await stockMovementTypesStatus()).ready) {
    throw new ShelfCountRefusal({
      en: "Fewer pairs were found than the books hold, and the database cannot take pairs off yet. Nothing was saved. The Owner can put the rule right in Settings.",
      ne: "app मा भन्दा कम जोडी भेटियो, तर database ले अझै जोडी घटाउन दिँदैन। केही राखिएन। मालिकले Settings मा नियम मिलाउन सक्नुहुन्छ।",
    });
  }

  const homeChannel: BusinessChannel = input.place === "Factory" ? "Factory" : "Retail";
  const placeWord = input.place === "Factory" ? "factory" : "shop";
  for (const move of stockMoves) {
    if (move.change > 0) {
      await insertStockMovement(db, {
        design,
        channel: homeChannel,
        sizeRun: move.size,
        type: "Adjustment",
        pairs: move.change,
        note: `Counted on the ${placeWord} shelf: ${counted[move.size] ?? 0} pairs. ${input.note}`.trim(),
      });
      continue;
    }
    // Fewer: off the rows that hold this size, the counted place's own
    // channel first.
    let left = -move.change;
    const rows = held
      .filter((row) => sizeOf(row.size_run) === move.size && whole(row.stock_pairs) > 0)
      .sort((a, b) => Number(b.channel === homeChannel) - Number(a.channel === homeChannel));
    for (const row of rows) {
      if (left <= 0) break;
      const take = Math.min(left, whole(row.stock_pairs));
      await insertStockMovement(db, {
        design,
        channel: row.channel as BusinessChannel,
        sizeRun: move.size,
        type: "Damage Out",
        pairs: take,
        note: `Counted on the ${placeWord} shelf: ${counted[move.size] ?? 0} pairs — ${-move.change} not found. ${input.note}`.trim(),
      });
      left -= take;
    }
  }

  // The places, written as they should now read: this one is the count, the
  // other as it was (a write-off above may have drawn from either).
  const setPlace = (location: StockPlace, size: string, pairs: number) =>
    db.query(
      `INSERT INTO stock_locations (id, design, size_run, location, pairs)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (design, size_run, location)
       DO UPDATE SET pairs = EXCLUDED.pairs, updated_at = now()`,
      [`loc-${randomUUID()}`, design, size, location, pairs],
    );
  for (const size of new Set([...Object.keys(here), ...Object.keys(counted)])) await setPlace(input.place, size, counted[size] ?? 0);
  for (const [size, pairs] of Object.entries(there)) await setPlace(other, size, pairs);

  const booksBefore = Object.values(books).reduce((sum, pairs) => sum + pairs, 0);
  const booksAfter = booksBefore + stockMoves.reduce((sum, move) => sum + move.change, 0);
  return {
    design,
    place: input.place,
    changes,
    counted: Object.values(counted).reduce((sum, pairs) => sum + pairs, 0),
    booksBefore,
    booksAfter,
  };
}
