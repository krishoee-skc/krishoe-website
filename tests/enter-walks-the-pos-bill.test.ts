import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Enter walks the POS bill too, but not the scan box.
 *
 * The cashier types with one hand and hands over a shoe with the other, and
 * Enter sits on the number pad beside the digits. On the bill Enter moves to
 * the next box, Shift+Enter to the one before, and on the last box it asks
 * "Save?" — a second Enter saves, Esc goes back. That is EnterWalkForm, the
 * same rule every money form in the app follows (lib/enter-walk.ts, tested in
 * enter-walks-every-money-form.test.ts), so the bill is checked here for using
 * it and for the three places it must not reach.
 *
 * The scan box. A barcode scanner types a code and presses Enter, and there
 * Enter has to keep meaning "add this shoe" — that is how several pairs go on
 * a bill without a hand leaving the counter. It sits outside the bill's form,
 * on the shelf side, so the walk cannot reach it.
 *
 * The rate box. Enter there means "this is the bargained rate", and must
 * neither walk away nor save.
 *
 * The note, where Enter is a new line.
 *
 * And Enter must never save on its own. In a browser Enter in a text box
 * submits the form — W3C failure F36 — and at a counter with a customer
 * waiting, a bill filed half-typed by a mis-hit is the worst thing this screen
 * could do.
 */
const FORM = "app/admin/pos/_components/PosBillForm.tsx";
const PICKER = "app/admin/pos/_components/PosProductPicker.tsx";

describe("the bill walks on Enter and asks before it saves", () => {
  it("is an EnterWalkForm", async () => {
    const form = await readFile(FORM, "utf8");
    expect(form).toContain('import EnterWalkForm from "@/components/admin/EnterWalkForm"');
    expect(form).toContain("<EnterWalkForm");
    expect(form).not.toMatch(/<form[\s>]/);
  });

  it("reads the total back in the question", async () => {
    const form = await readFile(FORM, "utf8");
    // The money the counter is about to take: the bill, the old credit taken
    // with it, or what an exchange still costs.
    expect(form).toContain('data-summary="money" value={isExchange ? settle.toPay : totals.total + dueAmount}');
  });
});

describe("the scan box, which Enter already belonged to", () => {
  it("is not inside the bill's form", async () => {
    const [form, picker] = await Promise.all([readFile(FORM, "utf8"), readFile(PICKER, "utf8")]);
    // The picker is drawn beside the form, not in it.
    const formStart = form.indexOf("<EnterWalkForm");
    const formEnd = form.indexOf("</EnterWalkForm>");
    const pickerAt = form.indexOf("<PosProductPicker");
    expect(pickerAt, "the picker moved").toBeGreaterThan(-1);
    expect(pickerAt < formStart || pickerAt > formEnd).toBe(true);
    expect(picker).not.toContain("EnterWalkForm");
  });

  it("still adds the scanned shoe on Enter", async () => {
    const picker = await readFile(PICKER, "utf8");
    const scan = picker.slice(picker.indexOf("ref={searchRef}"), picker.indexOf("enterKeyHint"));
    expect(scan.length, "the scan box moved").toBeGreaterThan(0);
    expect(scan).toContain('if (event.key === "Enter")');
    expect(scan).toContain("event.preventDefault()");
    expect(scan).toContain("onSubmitQuery(query, shown)");
  });
});

describe("what Enter must never do", () => {
  it("never walks away from, or saves, a rate being bargained", async () => {
    const form = await readFile(FORM, "utf8");
    const rate = form.slice(form.indexOf("editingRate === line.key ?"), form.indexOf("onBlur={(event)"));
    expect(rate.length, "the rate box moved").toBeGreaterThan(0);
    expect(rate).toContain('if (event.key === "Enter")');
    expect(rate).toContain("event.preventDefault()");
  });

  it("leaves the note alone, where Enter means a new line", async () => {
    const form = await readFile(FORM, "utf8");
    const note = form.slice(form.indexOf("data-enter-skip"), form.indexOf('name="note"'));
    expect(note.length, "the note moved out of its skip").toBeGreaterThan(0);
    expect(note).toContain("<textarea");
  });

  it("leaves Tab alone", async () => {
    const form = await readFile(FORM, "utf8");
    expect(form).not.toContain('key === "Tab"');
    expect(form).not.toMatch(/tabIndex=\{[1-9]/);
  });

  it("saves only through the form's own submit, F9 included", async () => {
    const form = await readFile(FORM, "utf8");
    // F9 asks the form to submit, which runs the same checks as the button.
    expect(form).toContain('if (event.key === "F9")');
    expect(form).toContain("?.requestSubmit()");
    // One path files a bill: the submit handler, which stops on `blocked`.
    expect(form.match(/createPosInvoiceAction\(/g)?.length).toBe(1);
    const submit = form.slice(form.indexOf("function handleSubmit"), form.indexOf("createPosInvoiceAction(state"));
    expect(submit).toContain("if (blocked)");
  });
});
