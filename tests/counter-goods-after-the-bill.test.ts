import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { weeklyCountShoes } from "@/app/admin/stock/CounterGoodsWatch";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * After goods are added at the counter (owner, 2026-09-29): the supplier's bill
 * is matched without adding the pairs twice, the Owner looks at each new item,
 * and five shoes a week are counted on the shelf.
 */
describe("a bill that comes after its goods", () => {
  it("posts the bill but not the pairs again", async () => {
    const posting = await read("lib/purchasing-postgres.ts");
    expect(posting).toContain("} else if (!row.line.counterItemId) {");
    expect(posting).toContain("SET bill_linked_at = now(), purchase_invoice_id = $2");
  });

  it("refuses a second match and a count that differs", async () => {
    const posting = await read("lib/purchasing-postgres.ts");
    expect(posting).toContain("WHERE id = $1 AND how = 'pending_bill' AND bill_linked_at IS NULL");
    expect(posting).toContain("FOR UPDATE");
    expect(posting).toContain("the counter counted");
  });

  it("carries the match from the form to the posting", async () => {
    const actions = await read("app/admin/purchasing/actions.ts");
    expect(actions).toContain("counterItemId: textValue(formData, `item${index}CounterItemId`)");
    const rules = await read("lib/purchasing.ts");
    expect(rules).toContain('counterItemId: kind === "Trading Goods" ? cleanText(item.counterItemId ?? "") : ""');
    const form = await read("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx");
    expect(form).toContain("name={`item${index}CounterItemId`}");
    expect(form).toContain("यो बिलमा जोड्ने");
  });
});

describe("the Owner's look", () => {
  it("lists new counter goods on the stock page with a ✓, for the Owner", async () => {
    const page = await read("app/admin/stock/page.tsx");
    expect(page).toContain('canAdmin(getSessionAdminRole(session), "settings:write")');
    const actions = await read("app/admin/stock/actions.ts");
    expect(actions).toContain('await requireAdminPermission("settings:write")');
    expect(actions).toContain('"counter_item_reviewed"');
  });

  it("reminds on the dashboard while any wait", async () => {
    const dashboard = await read("app/admin/page.tsx");
    expect(dashboard).toContain('key: "counter-goods"');
    expect(dashboard).toContain('href: "/admin/stock#new-goods"');
  });
});

describe("five shoes a week", () => {
  const row = (design: string, total: number) => ({ design, sizeRun: "Mixed", factory: total, shop: 0, total, unplaced: 0 });
  const rows = ["a", "b", "c", "d", "e", "f", "g", "h"].map((name) => row(name, 3)).concat([row("empty", 0)]);

  it("picks five in stock, the same all week, and moves on the next week", () => {
    const monday = weeklyCountShoes(rows as never, "2026-09-28").map((shoe) => shoe.design);
    const thursday = weeklyCountShoes(rows as never, "2026-10-01").map((shoe) => shoe.design);
    const nextWeek = weeklyCountShoes(rows as never, "2026-10-05").map((shoe) => shoe.design);
    expect(monday).toHaveLength(5);
    expect(monday).not.toContain("empty");
    expect(thursday).toEqual(monday);
    expect(nextWeek).not.toEqual(monday);
  });

  it("adds up a shoe kept in several size rows", () => {
    const shoes = weeklyCountShoes([row("x", 2), { ...row("x", 3), sizeRun: "38" }] as never, "2026-09-28");
    expect(shoes).toEqual([{ design: "x", factory: 5, shop: 0, total: 5, sizes: [] }]);
  });
});
