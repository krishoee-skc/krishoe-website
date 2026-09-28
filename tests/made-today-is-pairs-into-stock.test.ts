import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { KATHMANDU_TODAY_SQL, KATHMANDU_WEEK_START_SQL } from "@/lib/kathmandu-today-sql";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|--).*$/gm, "");

/**
 * "120 pairs made today" at 03:44 on 13 Aswin (owner, 2026-09-29) was two
 * mistakes at once. It was 12 Aswin's work — the database runs in UTC, and
 * CURRENT_DATE is yesterday until 05:45 here — and it was 60 pairs counted
 * twice, once at Upper and once at Fibermen. Made is what went into stock.
 */
describe("today's pairs on the dashboard", () => {
  it("reads today and this week in Kathmandu, the week from Sunday", () => {
    expect(KATHMANDU_TODAY_SQL).toBe("(now() AT TIME ZONE 'Asia/Kathmandu')::date");
    expect(KATHMANDU_WEEK_START_SQL).toContain("EXTRACT(DOW FROM");
    expect(KATHMANDU_WEEK_START_SQL).not.toContain("date_trunc");
  });

  it("has no UTC today left in the production summary or the factory board", async () => {
    for (const file of ["lib/production-accounting.ts", "lib/factory-board-data.ts"]) {
      const source = code(await read(file));
      expect(source, file).not.toContain("CURRENT_DATE");
      expect(source, file).not.toContain("date_trunc('week'");
    }
  });

  it("gives each stage its own number instead of adding the stages up", async () => {
    const source = await read("lib/production-accounting.ts");
    expect(source).toContain("GROUP BY stage");
    expect(source).toContain("AS today_stage_pairs");
    expect(source).toContain("todayStagePairs:");
  });

  it("shows the pairs posted to stock as made, and the stages beside it", async () => {
    const page = code(await read("app/admin/page.tsx"));
    expect(page).toContain('readPath(productionControl, "todayStockPairs", 0)');
    expect(page).toContain("todayPairs: todayStockPairs,");
    expect(page).toContain("todayPairs={todayStockPairs}");
    expect(page).not.toContain("todayGoodPairs");
    const card = await read("components/admin/OwnerDashboard.tsx");
    expect(card).toContain("props.factory.stages.map");
    expect(card).toContain("जोडी आज स्टकमा चढे");
  });

  it("reminds to post only on a day of work with nothing in stock yet", async () => {
    const page = await read("app/admin/page.tsx");
    expect(page).toContain("if (todayStagePairs.length > 0 && todayStockPairs === 0) {");
    expect(page).toContain("स्टकमा चढाउन बाँकी");
  });

  it("the assistant is told pairs into stock, not the stage sum", async () => {
    const facts = await read("lib/admin-facts.ts");
    expect(facts).toContain("todayGoodPairs: production ? production.todayStockPairs : null,");
  });
});

describe("rejects on a new work entry", () => {
  it("reach the wages ledger on save, as they already did on an edit", async () => {
    const source = await read("lib/factory-mutations.ts");
    const insert = source.slice(source.indexOf("INSERT INTO production_work_entries"));
    const values = insert.slice(0, insert.indexOf("],"));
    expect(values).toContain("$15, 0, $10, $11, 'Approved'");
    expect(values).toContain("rejectPairs,");
  });
});
