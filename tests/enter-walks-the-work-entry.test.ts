import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Enter walks the work entry, which is the form that pays a worker.
 *
 * The third and last of the forms the owner asked for. This one had no Enter
 * handling at all — none of its six boxes — so counting out a day's work meant
 * reaching for Tab between every number.
 *
 * Only four boxes are on the walk, and the four are the ones that are typed.
 * The worker, the stage, the product and the lot are chosen from dropdowns,
 * where Enter already means "open this" or "take this" — taking that over
 * would make choosing a worker harder than it is today. The colour and size
 * have tap-chips above them; the boxes here are the "or type it" ones beside
 * those chips.
 *
 * Rejected pairs is last because it is usually left at zero, so on most days
 * the walk effectively ends at the size.
 *
 * And Enter must never save. In a browser Enter in a text box submits the form
 * — W3C failure F36 — and this form puts a number into somebody's wages. A
 * half-typed entry filed by a mis-hit is a wrong payment.
 */
const FORM = "app/admin/factory/add-work/WorkEntryForm.tsx";

/** The typed boxes, in the order the work is counted out. */
const WORK_WALK = ["pairs", "colour", "size", "rejected"];

describe("the order Enter walks in", () => {
  it("counts out the work: pairs, colour, size, then rejects", async () => {
    const form = await readFile(FORM, "utf8");

    // Searched from the declaration onward — an earlier `] as const;` in the
    // file would slice this to an empty list and pass on nothing.
    const start = form.indexOf("const WORK_WALK = [");
    expect(start, "WORK_WALK moved").toBeGreaterThan(-1);

    const list = form.slice(start, form.indexOf("] as const;", start));
    const order = [...list.matchAll(/"([a-zA-Z]+)"/g)].map((match) => match[1]);

    expect(order).toEqual(WORK_WALK);
  });

  it("reaches every box on that list", async () => {
    const form = await readFile(FORM, "utf8");

    for (const field of WORK_WALK) {
      expect(form, `${field} handler`).toContain(`handleFieldWalk(event, "${field}")`);
      expect(form, `${field} ref`).toContain(`boxes.current.set("${field}", element)`);
    }
  });

  it("stays off the dropdowns", async () => {
    const form = await readFile(FORM, "utf8");

    // Four inputs carry the handler, plus its own definition. A fifth would
    // mean a select had been taken over, where Enter already has a job.
    const calls = form.match(/handleFieldWalk/g) ?? [];
    expect(calls.length, "something else joined the walk").toBe(WORK_WALK.length + 1);
  });
});

describe("what Enter must never do", () => {
  it("never saves the entry", async () => {
    const form = await readFile(FORM, "utf8");
    const walk = form.slice(
      form.indexOf("function handleFieldWalk"),
      form.indexOf("const [items, setItems]"),
    );

    expect(walk.length, "the walk handler moved").toBeGreaterThan(0);
    // W3C F36. The last box stops; Save is the only way an entry is filed,
    // and this entry is a worker's wages.
    expect(walk).toContain("event.preventDefault()");
    expect(walk).toContain("if (at < WORK_WALK.length - 1)");
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
    expect(form).toContain("WORK_WALK[at - 1]");
  });
});

/**
 * All three forms now walk the same way, and this is what holds them together.
 *
 * Three separate implementations, because the three forms are genuinely
 * different — one has an item table, one has a barcode scanner, one is four
 * boxes beside a row of tap-chips. What they must share is the rule that Enter
 * does not file the document, and the courtesy that Shift+Enter goes back.
 */
describe("the three forms agree on the rule", () => {
  const FORMS = [
    "app/admin/purchasing/_components/PurchaseInvoiceForm.tsx",
    "app/admin/pos/_components/PosBillForm.tsx",
    FORM,
  ];

  it("none of them lets Enter submit", async () => {
    for (const file of FORMS) {
      const source = await readFile(file, "utf8");
      const walk = source.slice(source.indexOf("function handleFieldWalk"));

      expect(walk.length, `${file} has no walk`).toBeGreaterThan(0);
      expect(walk.slice(0, 400), file).toContain("event.preventDefault()");
    }
  });

  it("all of them walk back on Shift+Enter", async () => {
    for (const file of FORMS) {
      const source = await readFile(file, "utf8");
      expect(source, file).toContain("if (event.shiftKey)");
    }
  });
});
