import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Enter walks the POS bill too, but not the scan box.
 *
 * The same request as the purchase form, at a busier counter: the cashier is
 * typing with one hand and handing over a shoe with the other, and Enter sits
 * on the number pad beside the digits.
 *
 * One box is deliberately left out, and it is the one Enter was already used
 * on. A barcode scanner types a code and presses Enter, and in the scan box
 * Enter has to keep meaning "add this item to the bill" — that is how several
 * pairs go onto a bill without a hand leaving the counter. Putting the scan
 * box on this walk would break scanning to save nine keystrokes.
 *
 * The order is the counter's: goods are scanned first, then who is buying,
 * then what the bill comes to. Discount and VAT before the amount paid,
 * because the amount paid is settled against a total that already includes
 * them.
 *
 * And Enter must never save. In a browser Enter in a text box submits the form
 * — W3C failure F36 — and at a counter with a customer waiting, a bill filed
 * half-typed by a mis-hit is the worst thing this screen could do.
 */
const FORM = "app/admin/pos/_components/PosBillForm.tsx";

/** The bill's own boxes, in the order they are filled at the counter. */
const BILL_WALK = [
  "cashier",
  "customerName",
  "phone",
  "customerAddress",
  "customerPan",
  "invoiceDiscount",
  "tax",
  "paidAmount",
  "paymentReference",
];

describe("the order Enter walks in", () => {
  it("follows the counter, with discount and VAT before the amount paid", async () => {
    const form = await readFile(FORM, "utf8");

    // Searched from the declaration onward: another `] as const;` earlier in
    // the file would slice this to nothing, which is how the purchase form's
    // version of this test first passed on an empty list.
    const start = form.indexOf("const BILL_WALK = [");
    expect(start, "BILL_WALK moved").toBeGreaterThan(-1);

    const list = form.slice(start, form.indexOf("] as const;", start));
    const order = [...list.matchAll(/"([a-zA-Z]+)"/g)].map((match) => match[1]);

    expect(order).toEqual(BILL_WALK);
  });

  it("reaches every box on that list", async () => {
    const form = await readFile(FORM, "utf8");

    for (const field of BILL_WALK) {
      expect(form, `${field} handler`).toContain(`handleFieldWalk(event, "${field}")`);
      expect(form, `${field} ref`).toContain(`boxes.current.set("${field}", element)`);
    }
  });
});

describe("the scan box, which Enter already belonged to", () => {
  it("is not on the walk", async () => {
    const form = await readFile(FORM, "utf8");

    // Nine inputs carry the handler, plus its own definition. A tenth call
    // would mean the scan box — or some other box — was added to the walk.
    const calls = form.match(/handleFieldWalk/g) ?? [];
    expect(calls.length, "something else joined the walk").toBe(BILL_WALK.length + 1);
  });

  it("still adds the scanned item on Enter", async () => {
    const form = await readFile(FORM, "utf8");
    const scan = form.slice(form.indexOf("Scan or type a code"), form.indexOf("Search item, SKU"));

    expect(scan.length, "the scan box moved").toBeGreaterThan(0);
    expect(scan).toContain('if (event.key === "Enter")');
    expect(scan).toContain("addByCode(scanCode)");
  });
});

describe("what Enter must never do", () => {
  it("never saves the bill", async () => {
    const form = await readFile(FORM, "utf8");
    const walk = form.slice(
      form.indexOf("function handleFieldWalk"),
      form.indexOf("const catalogByDesign"),
    );

    expect(walk.length, "the walk handler moved").toBeGreaterThan(0);
    // W3C F36. The last box on the walk stops; Save is the only way to file.
    expect(walk).toContain("event.preventDefault()");
    expect(walk).toContain("if (at < BILL_WALK.length - 1)");
  });

  it("leaves the note alone, where Enter means a new line", async () => {
    const form = await readFile(FORM, "utf8");
    const note = form.slice(form.indexOf('<textarea name="note"'), form.indexOf('<textarea name="note"') + 300);

    expect(note.length, "the note moved").toBeGreaterThan(0);
    expect(note).not.toContain("handleFieldWalk");
  });

  it("leaves Tab alone", async () => {
    const form = await readFile(FORM, "utf8");

    expect(form).not.toContain('key === "Tab"');
    expect(form).not.toMatch(/tabIndex=\{[1-9]/);
  });
});

describe("walking back", () => {
  it("goes backwards on Shift+Enter", async () => {
    const form = await readFile(FORM, "utf8");

    expect(form).toContain("if (event.shiftKey)");
    expect(form).toContain("BILL_WALK[at - 1]");
  });
});
