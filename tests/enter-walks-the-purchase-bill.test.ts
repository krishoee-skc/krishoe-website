import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Enter walks the whole purchase bill, not just its middle.
 *
 * The owner asked for Enter to do what Tab does, and they are typing with one
 * hand: the other is holding the supplier's paper bill. Enter sits on the
 * number pad beside the digits; Tab is across the keyboard. Every bill book
 * and every accounting package this shop has used works that way.
 *
 * It half worked already. Enter walked item → quantity → rate inside the item
 * table — three of the form's twenty boxes — and did nothing at the supplier,
 * the bill number, the discount, the VAT or the amount paid. The cursor fell
 * out of the walk exactly where the arithmetic starts.
 *
 * Two things decided how this was built.
 *
 * The order is the paper bill's, not the screen's. Discount and VAT sit below
 * the amount paid on screen, but they are printed above it and are calculated
 * before it, so the walk visits them first. Following the screen would send
 * the cursor back up the page halfway through a bill.
 *
 * And Enter must never save. In a browser, Enter in a text box submits the
 * form — W3C records this as failure F36, and a half-typed purchase filed by a
 * mis-hit is worse than every keystroke it could save. Every path calls
 * preventDefault, and the last box on the walk simply stops. The Save button
 * stays the only way a bill is filed.
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

/** The boxes outside the item table, in the order the paper bill is read. */
const FIELD_WALK = [
  "supplierName",
  "phone",
  "supplierBillNo",
  "discount",
  "tax",
  "paidAmount",
  "paymentReference",
];

describe("the order Enter walks in", () => {
  it("follows the paper bill, with discount and VAT before the amount paid", async () => {
    const form = await screen();
    // Searched from the declaration onward: WALK is declared above it and its
    // own "] as const;" comes first in the file, which sliced to nothing.
    const start = form.indexOf("const FIELD_WALK = [");
    const list = form.slice(start, form.indexOf("] as const;", start));

    const order = [...list.matchAll(/"([a-zA-Z]+)"/g)].map((match) => match[1]);
    expect(order).toEqual(FIELD_WALK);
  });

  it("reaches every box on that list", async () => {
    const form = await screen();

    // A name in the list with no handler on the input is a box the cursor
    // walks into and cannot leave.
    for (const field of FIELD_WALK) {
      expect(form, `${field} handler`).toContain(`handleFieldWalk(event, "${field}")`);
      expect(form, `${field} ref`).toContain(`boxes.current.set("${field}", element)`);
    }
  });

  it("joins the item table to the boxes on either side of it", async () => {
    const form = await screen();

    // Enter on the bill number drops into the first line...
    expect(form).toContain('if (field === "supplierBillNo" && rows.length > 0)');
    // ...and Enter on the rate of a line nobody typed into comes back out to
    // the discount rather than growing another empty row to circle in.
    expect(form).toContain("if (!rowIsTouched(rows[index]))");
    expect(form).toContain('pendingFocus.current = "discount"');
  });
});

describe("what Enter must never do", () => {
  it("never submits the bill", async () => {
    const form = await screen();
    const walk = form.slice(form.indexOf("function handleFieldWalk"), form.indexOf("function handleWalk"));

    // W3C failure F36: a form that submits itself when the last field is
    // filled. Here the last box on the walk stops, and Save is the only way
    // a bill is filed.
    expect(walk).toContain("event.preventDefault()");
    expect(walk).toContain("if (at < FIELD_WALK.length - 1)");
  });

  it("leaves Enter alone in the note, where it means a new line", async () => {
    const form = await screen();
    const note = form.slice(form.indexOf("<textarea"), form.indexOf("<textarea") + 400);

    expect(note.length, "the note textarea moved").toBeGreaterThan(0);
    // A vehicle number and a gate pass belong on separate lines; a walk here
    // would make the note a single-line box in practice.
    expect(note).not.toContain("handleFieldWalk");
  });

  it("leaves Tab alone, for whoever already uses it", async () => {
    const form = await screen();

    // A form that hijacks Tab is a form a keyboard user cannot escape, and
    // tabindex above 0 breaks the browser's own order.
    expect(form).not.toContain('key === "Tab"');
    expect(form).not.toMatch(/tabIndex=\{[1-9]/);
  });
});

describe("walking back out of a mistake", () => {
  it("goes backwards on Shift+Enter", async () => {
    const form = await screen();

    // Overshooting a box should not mean reaching for the mouse.
    expect(form).toContain("if (event.shiftKey)");
    expect(form).toContain("FIELD_WALK[at - 1]");
  });

  it("retraces the same path through the item table", async () => {
    const form = await screen();
    const rowWalk = form.slice(form.indexOf("function handleWalk"), form.indexOf("function handleSubmit"));

    // Back out of the discount lands on the last line's rate; back out of the
    // first item box lands on the bill number. The same doorways, in reverse.
    expect(form).toContain('pendingFocus.current = boxKey(rows[rows.length - 1].key, "rate")');
    expect(rowWalk).toContain('previousRow ? boxKey(previousRow.key, "rate") : "supplierBillNo"');
  });
});
