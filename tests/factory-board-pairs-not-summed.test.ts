import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { normaliseWorkRow, topProducts, type FactoryWorkRow } from "@/lib/factory-board";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const work = (over: Partial<FactoryWorkRow>): FactoryWorkRow =>
  normaliseWorkRow({ worker_id: "w1", worker_name: "Ram", item_id: "fom", item_name: "Fom flat", pairs_count: 60, reject_pairs: 0, amount_earned: 0, status: "completed", ...over });

/**
 * One rule for the whole app (owner, 2026-09-29): "pairs made" is pairs into
 * stock; "work" is what a worker did at a stage, shown stage by stage and only
 * ever summed for wages. On 12 Aswin, 60 pairs of Fom flat through Upper and
 * Fibermen read as 120 on the board's "Total pairs", its "Good pairs" and its
 * product bars alike.
 */
describe("the factory board never adds the stages up", () => {
  it("shows a shoe's stages side by side and its bar at the biggest stage", () => {
    const [fom] = topProducts([
      work({ worker_id: "u", stage: "Upper" }),
      work({ worker_id: "f", stage: "Fibermen" }),
    ]);
    expect(fom.pairs).toBe(60);
    expect(fom.stages).toEqual([
      { stage: "Fibermen", pairs: 60 },
      { stage: "Upper", pairs: 60 },
    ]);
  });

  it("still adds two people at the same stage of the same shoe", () => {
    const [fom] = topProducts([
      work({ worker_id: "a", stage: "Upper", pairs_count: 25 }),
      work({ worker_id: "b", stage: "Upper", pairs_count: 35 }),
      work({ worker_id: "c", stage: "Fibermen", pairs_count: 40 }),
    ]);
    expect(fom.pairs).toBe(60);
    expect(fom.stages[0]).toEqual({ stage: "Upper", pairs: 60 });
  });

  it("leads with pairs into stock, and calls the reject card what it is", async () => {
    const board = await read("app/admin/factory/FactoryBoard.tsx");
    expect(board).toContain('label={text("Pairs into stock", "स्टकमा चढेको जोडी")}');
    expect(board).toContain("value={stockPairs}");
    expect(board).not.toContain("value={stats.totalPairs}");
    expect(board).not.toContain("{stats.goodPairs}");
    expect(board).not.toContain("आजको गुणस्तर (QC)");
    expect(board).toContain('text("Rejects today", "आजको reject")');
  });

  it("reads the day's stock pairs from every Production In, in Nepal's day", async () => {
    const data = await read("lib/factory-board-data.ts");
    const fn = data.slice(data.indexOf("export async function getFactoryDayStockPairs"));
    expect(fn).toContain("type = 'Production In'");
    expect(fn).toContain("(created_at AT TIME ZONE 'Asia/Kathmandu')::date = $1::date");
    const page = await read("app/admin/factory/page.tsx");
    expect(page).toContain("getFactoryDayStockPairs(date)");
  });
});
