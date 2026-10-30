import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { arrivalPlaceFor } from "@/lib/stock-rules";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Pairs brought in on the Operations "Stock movement" form get a place
 * (owner, 2026-10-30): fom close shoes' six Production In pairs showed
 * "6 no place" because only the factory, purchase and counter paths placed
 * what they brought in. And the Stock screen lists each size once.
 */
describe("the stock movement form places what it brings in", () => {
  it("puts pairs in at the channel's own place, and nothing for the rest", () => {
    expect(arrivalPlaceFor({ type: "Production In", pairs: 6, channel: "Factory" })).toEqual([{ place: "Factory", pairs: 6 }]);
    expect(arrivalPlaceFor({ type: "Purchase In", pairs: 5, channel: "Retail" })).toEqual([{ place: "Shop", pairs: 5 }]);
    expect(arrivalPlaceFor({ type: "Adjustment", pairs: 3, channel: "Wholesale" })).toEqual([{ place: "Factory", pairs: 3 }]);
    expect(arrivalPlaceFor({ type: "Adjustment", pairs: 2, channel: "Online" })).toEqual([{ place: "Shop", pairs: 2 }]);
    expect(arrivalPlaceFor({ type: "Sale Out", pairs: 2, channel: "Retail" })).toEqual([]);
    expect(arrivalPlaceFor({ type: "Return In", pairs: 1, channel: "Retail" })).toEqual([]);
    expect(arrivalPlaceFor({ type: "Damage Out", pairs: 1, channel: "Factory" })).toEqual([]);
  });

  it("asks for it only from the form, so the paths that place already do not place twice", async () => {
    const actions = await read("app/admin/operations/actions.ts");
    expect(actions.match(/placeArrivals: true/g)).toHaveLength(1);
    const factoryReady = await read("app/api/factory/ready/route.ts");
    expect(factoryReady).not.toContain("placeArrivals");
  });

  it("lists each size once on the Stock screen", async () => {
    const screen = await read("app/admin/stock/WherePairsAre.tsx");
    expect(screen).toContain("...new Set(");
  });
});
