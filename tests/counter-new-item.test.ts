import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { migrationChecksum } from "@/lib/delivery-database";
import { counterItemsMigrations } from "@/lib/counter-items-database";
import {
  counterItemProblem,
  movementTypeForHow,
  sellsAtLoss,
  similarNames,
  tidySizes,
  totalPairs,
} from "@/lib/counter-item-rules";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * "+ New item" on the counter bill (owner, 2026-09-29): goods on the shelf that
 * were never entered — no purchase bill, sometimes a bill still to come — are
 * put on the books from the bill and sold at once, on a retail sale. Four
 * guards travel with it so the books do not split or lie.
 */
describe("the Owner's database button for counter goods", () => {
  it("is the migration file, word for word, and only creates", async () => {
    for (const migration of counterItemsMigrations) {
      const file = await read(`scripts/migrations/${migration.name}`);
      expect(migration.sql).toBe(file);
      expect(migrationChecksum(migration.sql)).toBe(migrationChecksum(file));
      const statements = migration.sql.split("\n").filter((line) => line.trim() && !line.trim().startsWith("--"));
      expect(statements.join("\n")).not.toMatch(/\b(DROP|DELETE|UPDATE|ALTER)\b/i);
    }
  });
});

describe("guard 1: one shoe, one name", () => {
  const known = ["bag open", "bantu hill", "lose hill panja", "School Jutta"];

  it("offers the exact name first, then close ones", () => {
    expect(similarNames("school jutta", known)[0]).toBe("School Jutta");
    expect(similarNames("T bag open", known)).toContain("bag open");
    expect(similarNames("bantu hil", known)).toContain("bantu hill");
  });

  it("stays quiet for a name that is really new", () => {
    expect(similarNames("ladies heel red", known)).toEqual([]);
  });

  it("is refused on the server too when the name is already on the books", async () => {
    const source = await read("lib/counter-items.ts");
    expect(source).toContain("designKey(existing) === designKey(name)");
    expect(source).toContain("is already on the books");
  });
});

describe("guards 2 and 3: price and cost", () => {
  const draft = { name: "School shoe", how: "old" as const, sizes: { "30": 6 }, pilePairs: 0, retailPrice: 460, costPerPair: 500, lossConfirmed: false };

  it("questions a price below cost until it is confirmed", () => {
    expect(sellsAtLoss(460, 500)).toBe(true);
    expect(counterItemProblem(draft)?.ne).toContain("घाटा");
    expect(counterItemProblem({ ...draft, lossConfirmed: true })).toBeNull();
  });

  it("allows an unknown cost, and never calls it a loss", () => {
    expect(sellsAtLoss(460, 0)).toBe(false);
    expect(counterItemProblem({ ...draft, costPerPair: 0 })).toBeNull();
  });

  it("wants a name, some pairs and a price", () => {
    expect(counterItemProblem({ ...draft, name: " " })).not.toBeNull();
    expect(counterItemProblem({ ...draft, sizes: {} })).not.toBeNull();
    expect(counterItemProblem({ ...draft, retailPrice: 0 })).not.toBeNull();
  });

  it("feeds the typed cost into costing, whole, for a design with no labour", async () => {
    const costing = await read("lib/costing.ts");
    expect(costing).toContain("laborPerPair === 0 && materialPerPair === 0 && counterCost > 0");
    expect(costing).toContain("unitCostByDesign");
  });
});

describe("guard 4 and the stock", () => {
  it("enters the pairs by how they came, and places them at the shop", async () => {
    expect(movementTypeForHow).toEqual({ old: "Adjustment", pending_bill: "Purchase In", factory: "Production In" });
    const source = await read("lib/counter-items.ts");
    expect(source).toContain('await placePairs(db, movement.design, movement.sizeRun, "Shop", count);');
    expect(source).toContain('channel: "Retail"');
  });

  it("tidies the size rows and counts every pair", () => {
    const sizes = tidySizes([{ size: " 30 ", pairs: "6" }, { size: "", pairs: 4 }, { size: "31", pairs: 0 }, { size: "30", pairs: 1 }]);
    expect(sizes).toEqual({ "30": 7 });
    expect(totalPairs(sizes, 5)).toBe(12);
  });

  it("starts the website listing hidden, at the next shoe code", async () => {
    const source = await read("lib/counter-items.ts");
    expect(source).toContain("nextShoeCode(takenCodes, category.slug)");
    expect(source).toContain("wholesalePriceValue: Math.round(wholesalePrice * 100)");
    expect(source).toContain('rating: "0"');
  });
});

describe("the counter bill", () => {
  it("offers + New item on a retail or wholesale sale", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('onAddNew={channel !== "Online" && kind === "Sale" ? (name) => setNewItemName(name) : undefined}');
    const picker = await read("app/admin/pos/_components/PosProductPicker.tsx");
    expect(picker).toContain("नयाँ माल थप्ने");
  });

  it("puts the new item straight on the bill", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain("setAddedHere((current) => [item, ...current]);");
    // Since 2026-10-09 the pairs typed are the ones being sold: straight on
    // the bill, no size sheet to fill in again.
    expect(form).toContain('if (canAddPair(item, size, next)) next = addPair(next, item, channel, size, "");');
  });

  it("is recorded for the Owner", async () => {
    const actions = await read("app/admin/pos/actions.ts");
    expect(actions).toContain('"counter_item_added"');
  });
});
