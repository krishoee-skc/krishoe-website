import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { originOf, stockOrigins } from "@/lib/stock-origin";

/** Owner, 2026-10-29: Products shows whether a shoe was made in the factory or bought. */
describe("made or bought", () => {
  const origins = stockOrigins([
    { design: "Lose Hill Panja", type: "Production In" },
    { design: "kitto 770", type: "Purchase In" },
    { design: "Bantu Hill", type: "Production In" },
    { design: "bantu hill", type: "Purchase In" },
    { design: "Fom flat", type: "Adjustment" },
    { design: "Doctor Chappal", type: "Sale Out" },
  ]);

  it("reads it from the stock's own history, by shoe name", () => {
    expect(originOf(origins, "Lose Hill Panja")).toEqual({ made: true, bought: false });
    expect(originOf(origins, "Kitto 770")).toEqual({ made: false, bought: true });
    expect(originOf(origins, "Bantu Hill")).toEqual({ made: true, bought: true });
  });

  it("says nothing for an opening count, an adjustment or a sale", () => {
    expect(originOf(origins, "Fom flat")).toBeUndefined();
    expect(originOf(origins, "Doctor Chappal")).toBeUndefined();
  });

  it("works on the plain object the page hands to the list", () => {
    expect(originOf(Object.fromEntries(origins), "kitto 770")).toEqual({ made: false, bought: true });
  });

  it("asks the database for one row per shoe and way in, with a limit", () => {
    const sql = readFileSync("lib/operations-postgres.ts", "utf8");
    expect(sql).toContain("WHERE type IN ('Production In', 'Purchase In')");
    expect(sql).toMatch(/GROUP BY design, type\s+LIMIT 5000/);
  });
});
