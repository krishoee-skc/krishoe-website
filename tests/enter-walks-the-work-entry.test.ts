import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Enter walks the work entry, which is the form that pays a worker.
 *
 * It first walked the four typed boxes only — pairs, colour, size, rejects —
 * and skipped the worker, the work and the shoe, the first three things
 * entered. The owner asked for Enter to do Tab's job the whole way, so the walk
 * now runs worker → work → shoe → pairs → colour → size → rejects → Save.
 *
 * What has not changed is that Enter never files a wage by itself. In a browser
 * Enter in a text box submits the form — W3C failure F36 — and this form puts a
 * number into somebody's wages. Enter on Save shows what is about to be written
 * and asks; only a second, deliberate Enter on "Yes" saves.
 */
const FORM = "app/admin/factory/add-work/WorkEntryForm.tsx";
const RULES = "app/admin/factory/add-work/work-entry-rules.ts";

// The screen is two files: the form that draws the boxes, and the rules it
// follows. The walk order is a rule, so it reads the pair as one screen.
async function screen() {
  const [form, rules] = await Promise.all([readFile(FORM, "utf8"), readFile(RULES, "utf8")]);
  return form + "\n" + rules;
}

/** Every stop, in the order the work is counted out, ending on Save. */
const WORK_WALK = ["worker", "stage", "item", "pairs", "colour", "size", "rejected", "save"];

describe("the order Enter walks in", () => {
  it("counts out the work: who, what, which shoe, pairs, colour, size, rejects, Save", async () => {
    const form = await screen();

    // Searched from the declaration onward — an earlier `] as const;` in the
    // file would slice this to an empty list and pass on nothing.
    const start = form.indexOf("const WORK_WALK = [");
    expect(start, "WORK_WALK moved").toBeGreaterThan(-1);

    const list = form.slice(start, form.indexOf("] as const;", start));
    const order = [...list.matchAll(/"([a-zA-Z]+)"/g)].map((match) => match[1]);

    expect(order).toEqual(WORK_WALK);
  });

  it("reaches every stop on that list", async () => {
    const form = await screen();

    for (const field of WORK_WALK) {
      expect(form, `${field} handler`).toContain(`handleFieldWalk(event, "${field}")`);
      expect(form, `${field} ref`).toContain(`walkRefs.current.set("${field}", element)`);
    }
  });

  it("steps over a box that cannot take the cursor", async () => {
    const form = await screen();
    const walk = form.slice(form.indexOf("function handleFieldWalk"), form.indexOf("const repeatLast"));

    expect(walk).toContain(".disabled");
  });
});

describe("what Enter must never do", () => {
  it("never saves the entry by itself", async () => {
    const form = await screen();
    const walk = form.slice(form.indexOf("function handleFieldWalk"), form.indexOf("const repeatLast"));

    expect(walk.length, "the walk handler moved").toBeGreaterThan(0);
    expect(walk).toContain("event.preventDefault()");
    // Enter on Save asks; it does not write.
    expect(walk).toContain("requestSave(true)");
    expect(walk).not.toContain("saveEntry(");

    // From the keyboard the question is always asked.
    const request = form.slice(form.indexOf("const requestSave"), form.indexOf("const cancelConfirm"));
    expect(request).toMatch(/if \(fromKeyboard \|\| duplicate\)[\s\S]*?setConfirming/);
  });

  it("leaves Tab alone", async () => {
    const form = await screen();

    expect(form).not.toContain('key === "Tab"');
    expect(form).not.toMatch(/tabIndex=\{[1-9]/);
  });

  it("lets Esc take the question back", async () => {
    const form = await screen();

    expect(form).toContain('event.key === "Escape"');
    expect(form).toContain("cancelConfirm()");
  });
});

describe("walking back", () => {
  it("goes backwards on Shift+Enter", async () => {
    const form = await screen();

    expect(form).toContain("const step = event.shiftKey ? -1 : 1;");
  });
});

/**
 * All three forms walk the same way, and this is what holds them together.
 *
 * What all three must share is the rule that Enter does not file the document
 * by itself, and the courtesy that Shift+Enter goes back.
 */
describe("the three forms agree on the rule", () => {
  const FORMS = [
    "app/admin/purchasing/_components/PurchaseInvoiceForm.tsx",
    FORM,
  ];

  it("the POS bill walks by the shared rule", async () => {
    const source = await readFile("app/admin/pos/_components/PosBillForm.tsx", "utf8");
    expect(source).toContain("<EnterWalkForm");
  });

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
      expect(source, file).toMatch(/event\.shiftKey/);
    }
  });
});
