import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

/**
 * The purchase screen used to be three forms: the bill, a "New supplier" form
 * beside it, and a supplier payment below that. A delivery from a new supplier
 * with money handed over meant filling all three, in three places, with three
 * saves — and the owner's own account was that one of the three got forgotten,
 * usually the payment.
 *
 * These hold the shape that replaced it, and the two things about it that are
 * easy to undo by accident: the serial number is derived, and Enter moves the
 * cursor instead of submitting.
 */

const FORM = "app/admin/purchasing/_components/PurchaseInvoiceForm.tsx";
const RULES = "app/admin/purchasing/_components/purchase-invoice-rules.ts";

// The screen is two files: the form that draws the bill, and the rules it
// follows. Which of the two holds a given line is housekeeping, so these
// read the pair as one screen.
async function screen() {
  const [form, rules] = await Promise.all([readFile(FORM, "utf8"), readFile(RULES, "utf8")]);
  return form + "\n" + rules;
}
const PAGE = "app/admin/purchasing/page.tsx";

describe("one bill, one place", () => {
  it("names a supplier inside the bill", async () => {
    const form = await screen();

    expect(form).toContain('name="supplierLedgerId"');
    expect(form).toContain('name="supplierName"');
    expect(form).toContain('name="phone"');
  });

  it("has no separate New supplier form left on the page", async () => {
    const page = await readFile(PAGE, "utf8");

    // Its action went with it: an exported Server Action is a reachable
    // endpoint, and one nothing calls is surface with no purpose.
    expect(page).not.toContain("createSupplierLedgerAction");

    const actions = await readFile("app/admin/purchasing/actions.ts", "utf8");
    expect(actions).not.toContain("export async function createSupplierLedgerAction");
  });

  it("keeps the payment form for settling an old due", async () => {
    // Paying for a bill as it arrives is part of the bill. Paying off what was
    // owed from last month is a different act on a different day, and still
    // needs somewhere to happen.
    const page = await readFile(PAGE, "utf8");
    expect(page).toContain("SupplierPaymentForm");
  });
});

describe("the item lines", () => {
  it("numbers each line from its position, never from a field", async () => {
    const form = await screen();

    // A hand-kept number and the bill it numbers can disagree. This cannot:
    // it is the row's index, so removing line 2 renumbers what follows.
    expect(form).toContain("{index + 1}");
    expect(form).not.toMatch(/name="item\d*SerialNo"|serialNumber:/);
  });

  it("works the amount out rather than accepting one", async () => {
    const form = await screen();

    // Quantity times rate, shown but never typed into, so a line and the bill
    // total cannot tell different stories.
    expect(form).toContain("(Number(row.quantity) || 0) * (Number(row.rate) || 0)");
  });

  it("offers the shop's own names rather than a blank box", async () => {
    const form = await screen();

    // "Doctor Chappal moto" spelled a second way is a second item in the stock
    // ledger, so what exists is offered before anything new is created.
    // One list for both kinds: the name typed decides whether it is material
    // or a ready-made shoe.
    expect(form).toContain('<datalist id="purchase-items">');
    expect(form).toContain('list="purchase-items"');
  });

  it("still sends the server every field it reads", async () => {
    const form = await screen();

    // The one visible item box resolves to these behind it — an existing
    // material by id, or a new one by name and unit; a catalog design, or a new
    // one. The server contract did not change, only what the shopkeeper types.
    for (const field of [
      "Kind",
      "MaterialId",
      "MaterialName",
      "MaterialUnit",
      "Design",
      "SizeRun",
      "Quantity",
      "Rate",
      "Note",
    ]) {
      expect(form, field).toContain(`item\${index}${field}`);
    }
    expect(form).toContain('name="itemCount"');
  });
});

describe("Enter walks down the bill", () => {
  it("moves the cursor instead of submitting the form", async () => {
    const form = await screen();

    // Enter in a form submits it. On a bill book it means "next box", and a
    // half-typed bill saved by a reflex keystroke is the cost of the default.
    expect(form).toContain('if (event.key !== "Enter") return;');
    expect(form).toContain("event.preventDefault();");
  });

  it("walks the row and then drops to the next serial number", async () => {
    const form = await screen();

    expect(form).toContain('const WALK = ["item", "quantity", "rate"] as const;');
    // From the last box of a row, to the item box of the row below — not
    // sideways into the amount, which cannot be typed into anyway.
    expect(form).toContain('boxKey(nextRow.key, "item")');
  });

  it("can reach a row that did not exist when Enter was pressed", async () => {
    const form = await screen();

    // The row is added and focused in the same gesture, so the focus target has
    // to survive until after the render that creates it.
    expect(form).toContain("pendingFocus");
    expect(form).toContain("boxKey(grownKey, \"item\")");
  });
});

describe("how it was paid", () => {
  it("offers all four ways, QR included", async () => {
    const form = await screen();

    for (const method of ['id: "Cash"', 'id: "Credit"', 'id: "Cheque"', 'id: "QR"']) {
      expect(form, method).toContain(method);
    }
  });

  it("refuses to let a credit bill carry a paid amount", async () => {
    const form = await screen();

    // The server rejects it, so the form should not let it be typed — an error
    // after a save is a worse way to learn a rule than a box that will not take
    // the number.
    expect(form).toContain('disabled={paymentMethod === "Credit"}');
    expect(form).toContain('if (id === "Credit") setPaidAmount("");');
  });

  it("shows what is still owed before the bill is saved", async () => {
    const form = await screen();

    // The number this whole screen exists to make visible. It was a
    // consequence of two boxes already on the screen and was shown nowhere.
    expect(form).toContain("const due = Math.max(0, totals.total - paid);");
    expect(form).toContain("उधारो रहन्छ");
    expect(form).toContain("Still owed");
  });
});
