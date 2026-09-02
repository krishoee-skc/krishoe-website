import { describe, it, expect, afterAll } from "vitest";
import { queryPostgres } from "@/lib/postgres/client";
import { addStockMovementToPostgres } from "@/lib/operations-postgres";

const D = "ZZ size routing probe";
afterAll(async () => {
  await queryPostgres("t", `DELETE FROM stock_movements WHERE design = $1`, [D]);
  await queryPostgres("t", `DELETE FROM finished_stock WHERE design = $1`, [D]);
});

describe.skipIf(!process.env.DATABASE_URL)("size routing", () => {
  it("a real size lands on its own row, not the Mixed pile", async () => {
    await queryPostgres("t", `DELETE FROM stock_movements WHERE design = $1`, [D]);
    await queryPostgres("t", `DELETE FROM finished_stock WHERE design = $1`, [D]);
    // Seed a Mixed pile of 50.
    await queryPostgres("t", `INSERT INTO finished_stock (id, design, channel, size_run, stock_pairs, sold_pairs, returned_pairs) VALUES ('zz-sr-mix', $1, 'Wholesale', 'Mixed', 50, 0, 0)`, [D]);
    // Add 12 pairs at size 36.
    await addStockMovementToPostgres({ design: D, channel: "Wholesale", sizeRun: "36", type: "Adjustment", pairs: 12, note: "size probe" });
    const rows = await queryPostgres<{ size_run: string; stock_pairs: number }>("t",
      `SELECT size_run, stock_pairs FROM finished_stock WHERE design = $1 ORDER BY size_run`, [D]);
    console.log("rows after size-36 add:", rows);
    const mix = rows.find(r => r.size_run === "Mixed");
    const s36 = rows.find(r => r.size_run === "36");
    expect(Number(mix?.stock_pairs)).toBe(50); // untouched
    expect(Number(s36?.stock_pairs)).toBe(12); // new size row
  }, 60_000);
});
