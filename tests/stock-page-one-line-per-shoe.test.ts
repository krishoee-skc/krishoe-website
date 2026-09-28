import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The stock page after the owner chose 1, 2, 3 and 4 from the sample on
 * 2026-09-28 (and the order from 5, without making every word Nepali).
 */
const PAGE = "app/admin/stock/page.tsx";
const PLACES = "app/admin/stock/WherePairsAre.tsx";

describe("1. the summary", () => {
  it("shows ready, factory, shop and how many shoes to put right", async () => {
    const page = await readFile(PAGE, "utf8");
    expect(page).toContain('<T en="🏭 At the factory" ne="🏭 कारखानामा" />');
    expect(page).toContain('<T en="🛒 At the shop" ne="🛒 पसलमा" />');
    expect(page).toContain("const toPutRight = loaded.byPlace.filter((row) => row.unplaced !== 0).length;");
    expect(page).toContain('href="#put-right"');
  });
});

describe("2. shoes to put right", () => {
  it("offers the likely fix on each shoe, asked once more before it saves", async () => {
    const places = await readFile(PLACES, "utf8");
    expect(places).toContain("function fixesFor(row: StockAtPlace): Fix[]");
    expect(places).toContain("pairs: row.factory + row.unplaced");
    expect(places).toContain("pairs: row.shop - over");
    expect(places).toContain('text("Sure?", "पक्का?")');
    expect(places).toContain("const result = await setPlaceCountAction(null, formData);");
    expect(places).toContain('text("Count and enter", "गनेर हाल्ने")');
  });
});

describe("3. one shoe, one line", () => {
  it("groups the size rows of a shoe, and opens them on a press", async () => {
    const places = await readFile(PLACES, "utf8");
    expect(places).toContain("const groups = useMemo(() => groupByShoe(rows), [rows]);");
    expect(places).toContain("aria-expanded={open}");
    expect(places).toContain("function sizesLabel(runs: string[])");
  });

  it("carries sold, made or bought and how long it lasts in the same table", async () => {
    const page = await readFile(PAGE, "utf8");
    const places = await readFile(PLACES, "utf8");
    expect(page).toContain("extras={loaded.extras}");
    expect(page).not.toContain("<StockOutlookPanel");
    expect(places).toContain('{ key: "lasts", en: "How long it lasts", ne: "कति दिन पुग्छ", sortable: false }');
    expect(places).toContain("<OriginTag origin={extra?.origin} text={text} />");
  });

  it("keeps the old per-origin lists only for when places could not load", async () => {
    const page = await readFile(PAGE, "utf8");
    expect(page).toContain("{loaded.byPlace.length === 0 ? (");
  });
});

describe("4. recent movement", () => {
  it("is one line per shoe, per kind, per day, without the channel", async () => {
    const page = await readFile(PAGE, "utf8");
    expect(page).toContain("function groupMovements(movements: StockMovement[])");
    expect(page).toContain("const key = `${date}::${movement.design}::${movement.type}`;");
    expect(page).not.toContain("{movement.channel} · Size {movement.sizeRun}");
  });
});

describe("the list in boxes, the owner's second sample (2026-09-28)", () => {
  it("draws every cell as a box, bigger, with a totals line", async () => {
    const places = await readFile(PLACES, "utf8");
    expect(places).toContain("border-separate border-spacing-0 overflow-hidden rounded-xl border-2");
    expect(places).toContain("<tfoot>");
    expect(places).toContain('text("✓ Matches", "✓ मिलेको")');
  });

  it("finds a shoe by name or code, filters, sorts, and opens its history", async () => {
    const places = await readFile(PLACES, "utf8");
    expect(places).toContain('placeholder={text("Find a shoe — name or #code", "जुत्ता खोज्नुहोस् — नाम वा #कोड")}');
    expect(places).toContain("sameCode(code, wanted)");
    expect(places).toContain("SHOE_FILTERS.map((filter)");
    expect(places).toContain("function sortBy(key");
    expect(places).toContain("aria-sort=");
    expect(places).toContain("function ShoeHistory(");
    // What needs a look comes first.
    expect(places).toContain('useState<{ key: SortKey; dir: 1 | -1 }>({ key: "attention", dir: 1 })');
  });

  it("says 36–41 for a run written out size by size", async () => {
    const places = await readFile(PLACES, "utf8");
    expect(places).toContain(".flatMap((run) => run.split(/[,\\s]+/))");
  });
});
