import { describe, expect, it } from "vitest";
import {
  emptyRow,
  itemNameOf,
  rowIsTouched,
  sameName,
} from "@/app/admin/purchasing/_components/purchase-invoice-rules";
import type { RawMaterial } from "@/lib/operations";

/**
 * The four decisions a purchase bill makes about one of its rows.
 *
 * Every other check on this screen reads its source as text — the Enter walk,
 * the field names, where the place is carried. That catches a rule being
 * reordered or renamed, and it caught exactly that. It cannot catch a rule
 * still being there and answering wrongly, and two of these were in that gap:
 *
 *   - a new row could stop defaulting to Factory, and every source check
 *     stayed green while goods started landing in the shop's pool instead of
 *     the factory's — two pools that have already drifted once and cost the
 *     owner a customer
 *   - rowIsTouched could stop noticing a typed design, and a trading-goods
 *     line the buyer had filled in would be dropped from the bill as empty
 *
 * Both were proved by re-introducing them: the tests above them stayed green.
 * So these call the functions.
 */

const materials: RawMaterial[] = [
  { id: "mat-1", name: "PVC Sheet" } as RawMaterial,
  { id: "mat-2", name: "Fibre Sole" } as RawMaterial,
];

describe("a new bill line", () => {
  it("lands goods at the factory unless the buyer says otherwise", () => {
    // Stock lives in two pools and the wrong one is not a cosmetic error:
    // pairs recorded at the shop are pairs the factory cannot see. Goods
    // arrive at the factory, so the common case needs no extra tap.
    expect(emptyRow(1).place).toBe("Factory");
  });

  it("opens as a raw-material line, in pieces", () => {
    const row = emptyRow(1);
    expect(row.kind).toBe("Raw Material");
    expect(row.materialUnit).toBe("piece");
    expect(row.sizeRun).toBe("Mixed");
  });

  it("opens empty, so nothing is saved that was not typed", () => {
    expect(rowIsTouched(emptyRow(1))).toBe(false);
  });
});

describe("whether a line was typed", () => {
  it("counts a chosen material", () => {
    expect(rowIsTouched({ ...emptyRow(1), materialId: "mat-1" })).toBe(true);
  });

  it("counts a typed material name", () => {
    expect(rowIsTouched({ ...emptyRow(1), materialName: "Glue" })).toBe(true);
  });

  it("counts a typed design, which is how a trading line is named", () => {
    // The gap: a trading-goods line names its shoe in `design`, not in
    // materialName. Miss it and a line the buyer filled in is dropped from the
    // bill as though it were blank.
    expect(rowIsTouched({ ...emptyRow(1), kind: "Trading Goods", design: "bag open" })).toBe(true);
  });

  it("counts a quantity or a rate on their own", () => {
    expect(rowIsTouched({ ...emptyRow(1), quantity: "12" })).toBe(true);
    expect(rowIsTouched({ ...emptyRow(1), rate: "650" })).toBe(true);
  });
});

describe("what the item box shows", () => {
  it("shows the design on a trading line", () => {
    const row = { ...emptyRow(1), kind: "Trading Goods" as const, design: "bag open" };
    expect(itemNameOf(row, materials)).toBe("bag open");
  });

  it("shows the chosen material's own name, not what was typed beside it", () => {
    const row = { ...emptyRow(1), materialId: "mat-2", materialName: "stale text" };
    expect(itemNameOf(row, materials)).toBe("Fibre Sole");
  });

  it("falls back to the typed name for a material not on the list yet", () => {
    const row = { ...emptyRow(1), materialName: "Thread" };
    expect(itemNameOf(row, materials)).toBe("Thread");
  });

  it("shows nothing rather than a stale name when the material is gone", () => {
    const row = { ...emptyRow(1), materialId: "mat-missing" };
    expect(itemNameOf(row, materials)).toBe("");
  });
});

describe("matching a name", () => {
  it("ignores case and surrounding space, which is how a buyer types", () => {
    // "Bag Open" on Monday and "bag open " on Friday are one design. Treated
    // as two, the catalog grows a duplicate and the stock splits across it.
    expect(sameName(" Bag Open ", "bag open")).toBe(true);
  });

  it("still tells two real names apart", () => {
    expect(sameName("bag open", "bagopen")).toBe(false);
  });
});
