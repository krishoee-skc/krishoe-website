import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { stockByShoe } from "@/lib/dashboard-figures";
import { publicRolesMigration } from "@/lib/public-roles-database";

/**
 * The bug audit, phases 2 (stock), 4 (purchasing) and 7 (security), owner
 * 2026-10-27/28: found by browser checks on a local test database, Chrome and
 * the Safari engine, computer and phone; fixed on the owner's "garau".
 */
const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

describe("KR-BUG-005: a challan is made", () => {
  it("reads the shoe's name before the '::size' the box carries", async () => {
    const actions = await read("app/admin/stock/actions.ts");
    expect(actions).toContain("const design = textValue(formData, `line${index}Design`).split(\"::\")[0].trim();");
  });
});

describe("KR-BUG-007: the day's second challan is not taken for the first", () => {
  it("gives every challan its own key, kept across a double press", async () => {
    const screen = await read("app/admin/stock/WherePairsAre.tsx");
    expect(screen).toContain("if (!sendKey.current) sendKey.current = `trf-${newKey()}`;");
    expect(screen).toContain("crypto.randomUUID()");
  });
});

describe("KR-BUG-006: pairs on the road have a place", () => {
  it("counts them apart from 'no place' in the stock by place", async () => {
    const lib = await read("lib/stock-transfers.ts");
    expect(lib).toContain("WHERE t.status = 'Sent'");
    expect(lib).toContain("unplaced: total - factory - shop - onRoad,");
  });

  it("are neither 'no place' nor 'too many' on the dashboard", () => {
    // 30 pairs: 5 at the factory, 20 at the shop, 5 on a challan on the road.
    const stock = stockByShoe(
      [{ name: "Test Chappal", status: "Active", stock: 30, priceValue: 80000 }],
      [{ design: "Test Chappal", factory: 5, shop: 20, total: 30, onRoad: 5 }],
    );
    expect(stock.noPlace).toBe(0);
    expect(stock.over).toBe(0);
    expect(stock.onRoad).toBe(5);
    expect(stock.mismatched).toEqual([]);
  });

  it("still finds pairs truly without a place", () => {
    const stock = stockByShoe(
      [{ name: "Test Chappal", status: "Active", stock: 30, priceValue: 80000 }],
      [{ design: "Test Chappal", factory: 5, shop: 18, total: 30, onRoad: 5 }],
    );
    expect(stock.noPlace).toBe(2);
  });

  it("shows them on the dashboard's pairs bar", async () => {
    const board = await read("components/admin/OwnerDashboard.tsx");
    expect(board).toContain("stock.factory + stock.shop + stock.onRoad + stock.over + stock.noPlace");
    expect(board).toContain("text(`On the road ${stock.onRoad}`, `बाटोमा ${stock.onRoad}`)");
  });
});

describe("KR-BUG-008: Save is pressed on Safari", () => {
  it("clears the Enter hint after the click, not on the press", async () => {
    const form = await read("components/admin/EnterWalkForm.tsx");
    expect(form).toContain("if (!formRef.current?.contains(document.activeElement)) setHint(null);");
    expect(form).toContain("}, 300);");
    expect(form).not.toContain("if (!into || !formRef.current?.contains(into)) setHint(null);");
  });
});

describe("KR-BUG-012: a purchase bill and a supplier payment are filed once", () => {
  it("holds the purchase bill from the press until the save is over", async () => {
    const bill = await read("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx");
    expect(bill).toContain("if (saving.current) return;");
    expect(bill).toContain("saving.current = true;\n    startSaving(async () => {");
    expect(bill).toContain("if (!isSaving) saving.current = false;");
  });

  it("drops a second submit of a supplier payment pressed twice", async () => {
    const form = await read("components/admin/EnterWalkForm.tsx");
    expect(form).toContain("if (oncePerPress && now - lastSubmit.current < DOUBLE_PRESS_MS) {");
    expect(form).toContain("const DOUBLE_PRESS_MS = 800;");
    expect(form).toContain("oncePerPress = false,");
    expect(await read("app/admin/purchasing/_components/SupplierPaymentForm.tsx")).toContain("action={createSupplierTransactionAction} oncePerPress");
    expect(await read("app/admin/purchasing/supplier/[id]/page.tsx")).toContain("action={createSupplierTransactionAction} oncePerPress");
  });

  it("leaves the counter bill's own resend alone", async () => {
    // The bill asks ("from the factory?", "is that discount meant?") and sends
    // itself again on the answer; a guard there would swallow the answer.
    const bill = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(bill).toMatch(/<EnterWalkForm id=\{BILL_FORM_ID\} onSubmit=\{handleSubmit\}(?![^>]*oncePerPress)/);
  });
});

describe("KR-BUG-013: paying a supplier more than is owed says so", () => {
  it("sends the rule's words back to the form instead of an error page", async () => {
    const actions = await read("app/admin/purchasing/actions.ts");
    expect(actions).toContain("if (error instanceof Error && SUPPLIER_RULE.test(error.message)) refuseBack(returnTo, error.message);");
    expect(actions).toContain("redirect(`${target}${join}said=${encodeURIComponent(message.slice(0, 200))}`);");
    expect(actions).not.toContain('throw new Error("Supplier ledger and positive amount are required.");');
  });

  it("matches the supplier account's refusal and nothing else", async () => {
    const actions = await read("app/admin/purchasing/actions.ts");
    const source = actions.match(/const SUPPLIER_RULE = (\/.+\/);/)?.[1] ?? "";
    const rule = new RegExp(source.slice(1, -1));
    expect(rule.test("Test Supplier has only Rs. 800 supplier due. Cannot post Rs. 5800.")).toBe(true);
    expect(rule.test("connect ECONNREFUSED 127.0.0.1:5432")).toBe(false);
  });

  it("shows it on both payment forms", async () => {
    const note = await read("app/admin/purchasing/_components/RefusedNote.tsx");
    expect(note).toContain('useSearchParams().get("said")');
    expect(await read("app/admin/purchasing/_components/SupplierPaymentForm.tsx")).toContain("<RefusedNote />");
    expect(await read("app/admin/purchasing/supplier/[id]/SupplierPaymentFields.tsx")).toContain('<RefusedNote className="md:col-span-3" />');
  });
});

describe("KR-SEC-02: the public roles lose their table grants", () => {
  it("runs the migration file word for word, from an Owner button", async () => {
    const file = await read(`scripts/migrations/${publicRolesMigration.name}`);
    expect(publicRolesMigration.sql).toBe(file);
    const settings = await read("app/admin/settings/page.tsx");
    expect(settings).toContain("<form action={preparePublicRolesAction}");
    expect(settings).toContain('<input type="hidden" name="confirm" value="yes" />');
  });

  it("takes grants away and touches no row", () => {
    const sql = publicRolesMigration.sql.replace(/--[^\n]*/g, "");
    expect(sql).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated");
    expect(sql).not.toMatch(/\b(DELETE|UPDATE|DROP|TRUNCATE|INSERT)\b/i);
    // A copy of the database without Supabase's roles is left alone.
    expect(sql).toContain("IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')");
  });
});
