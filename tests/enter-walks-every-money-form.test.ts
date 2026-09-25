import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  confirmLine,
  enterStep,
  isWalkKey,
  isWalkStop,
  summaryPart,
} from "@/lib/enter-walk";

/**
 * Enter walks box to box on the forms that pay a worker, a supplier or a
 * salary, move stock, or set a rate — and asks before it saves. In those forms
 * Enter used to file the entry itself: type the amount, press Enter out of
 * habit, and a cash payment was saved before its date or note was looked at.
 */

describe("where Enter goes", () => {
  it("walks forward and back", () => {
    expect(enterStep(0, 4, false)).toEqual({ kind: "focus", index: 1 });
    expect(enterStep(2, 4, true)).toEqual({ kind: "focus", index: 1 });
  });

  it("asks from the last box instead of saving", () => {
    expect(enterStep(3, 4, false)).toEqual({ kind: "confirm" });
    expect(enterStep(0, 1, false)).toEqual({ kind: "confirm" });
  });

  it("stays on the first box rather than wrapping to the note", () => {
    expect(enterStep(0, 4, true)).toEqual({ kind: "stay" });
  });

  it("does nothing for an element that is not on the walk", () => {
    expect(enterStep(-1, 4, false)).toEqual({ kind: "stay" });
    expect(enterStep(0, 0, false)).toEqual({ kind: "stay" });
  });
});

describe("what the walk stops at", () => {
  it("stops at the boxes a figure is typed or chosen in", () => {
    expect(isWalkStop({ tag: "INPUT", type: "number" })).toBe(true);
    expect(isWalkStop({ tag: "INPUT" })).toBe(true);
    expect(isWalkStop({ tag: "SELECT" })).toBe(true);
    expect(isWalkStop({ tag: "TEXTAREA" })).toBe(true);
  });

  it("stops at the Nepali date button, which marks itself", () => {
    expect(isWalkStop({ tag: "BUTTON", walk: true })).toBe(true);
  });

  it("never stops at Save, a helper button, or a calendar day", () => {
    expect(isWalkStop({ tag: "BUTTON" })).toBe(false);
    expect(isWalkStop({ tag: "INPUT", type: "submit" })).toBe(false);
    expect(isWalkStop({ tag: "INPUT", type: "hidden" })).toBe(false);
    expect(isWalkStop({ tag: "INPUT", type: "file" })).toBe(false);
  });

  it("skips what cannot be typed in or is not on screen", () => {
    expect(isWalkStop({ tag: "INPUT", disabled: true })).toBe(false);
    expect(isWalkStop({ tag: "INPUT", readOnly: true })).toBe(false);
    expect(isWalkStop({ tag: "SELECT", hidden: true })).toBe(false);
    expect(isWalkStop({ tag: "INPUT", skip: true })).toBe(false);
    expect(isWalkStop({ tag: "INPUT", untabbable: true })).toBe(false);
  });
});

describe("which key presses are the walk's", () => {
  it("takes Enter and Shift+Enter", () => {
    expect(isWalkKey({ key: "Enter" })).toBe(true);
  });

  it("leaves Ctrl, Alt and Meta with Enter alone", () => {
    expect(isWalkKey({ key: "Enter", ctrlKey: true })).toBe(false);
    expect(isWalkKey({ key: "Enter", altKey: true })).toBe(false);
    expect(isWalkKey({ key: "Enter", metaKey: true })).toBe(false);
  });

  it("leaves Enter to a Nepali keyboard committing a word", () => {
    expect(isWalkKey({ key: "Enter", isComposing: true })).toBe(false);
  });

  it("ignores every other key", () => {
    expect(isWalkKey({ key: "Tab" })).toBe(false);
    expect(isWalkKey({ key: "a" })).toBe(false);
  });
});

describe("the question it asks", () => {
  it("reads back whose, what and how much", () => {
    expect(confirmLine([summaryPart("text", "Saturday Kharcha"), summaryPart("money", "2500")], "राम बहादुर"))
      .toBe("राम बहादुर · Saturday Kharcha · Rs. 2,500");
  });

  it("names pairs in the owner's word", () => {
    expect(summaryPart("pairs", "12", "जोडी")).toBe("12 जोडी");
  });

  it("leaves out what was not filled in", () => {
    expect(confirmLine([summaryPart("money", ""), summaryPart("text", "  ")])).toBe("");
  });
});

describe("the form that asks", () => {
  it("saves only from its Yes, through the form's own Save, never around a disabled one", async () => {
    const source = await readFile("components/admin/EnterWalkForm.tsx", "utf8");
    expect(source).toContain("if (!submitter) return;");
    expect(source).toContain("form.requestSubmit(submitter)");
    // Enter itself never submits: every walk path is preventDefault or a
    // dropdown, and the only requestSubmit is inside save().
    expect(source.match(/requestSubmit\(/g)).toHaveLength(1);
    expect(source).toContain("onClick={save}");
  });

  it("withdraws the question when a box is clicked, so a stale Save? cannot be answered", async () => {
    const source = await readFile("components/admin/EnterWalkForm.tsx", "utf8");
    expect(source).toMatch(/isWalkStop\(describe\(target\)\)\) return;\s*\/\/[^]*?setQuestion\(null\);/);
  });

  it("swallows Enter in a box the walk passes over, rather than let the browser save", async () => {
    const source = await readFile("components/admin/EnterWalkForm.tsx", "utf8");
    expect(source).toContain('target instanceof HTMLInputElement && !["submit", "button", "reset", "image"].includes(target.type)');
  });

  it("checks the required boxes before asking", async () => {
    const source = await readFile("components/admin/EnterWalkForm.tsx", "utf8");
    expect(source).toContain("if (!form.checkValidity())");
    expect(source).toContain("form.reportValidity();");
  });

  it("marks the Nepali date as a stop so Enter passes it instead of opening the calendar", async () => {
    const source = await readFile("components/admin/NepaliDateField.tsx", "utf8");
    expect(source).toContain("data-enter-walk");
  });

  it("draws a gold ring on the box the cursor is in", async () => {
    const css = await readFile("app/globals.css", "utf8");
    expect(css).toContain(".enter-walk :is(input, select, textarea, button[data-enter-walk]):focus");
  });
});

describe("the forms that walk", () => {
  const wrapped: Array<[string, number]> = [
    // Money going out.
    ["app/admin/operations/production-accounts/payments/page.tsx", 1],
    ["app/admin/factory/ledger/PieceLedger.tsx", 1],
    ["app/admin/factory/salary/StaffSalary.tsx", 1],
    ["app/admin/purchasing/_components/SupplierPaymentForm.tsx", 1],
    // Sales, stock and the customer ledger.
    ["app/admin/operations/_components/OperationsQuickEntry.tsx", 10],
    ["app/admin/OrdersClient.tsx", 2],
    // Rates and cost.
    ["app/admin/operations/production-accounts/rates/page.tsx", 2],
    ["app/admin/operations/production-accounts/lots/page.tsx", 7],
    ["app/admin/costing/page.tsx", 1],
    // The same money on the pages of one worker, supplier, customer or lot —
    // missed on the first pass, found on the recheck. The delete form and the
    // date filters stay plain <form>s.
    ["app/admin/purchasing/supplier/[id]/page.tsx", 1],
    ["app/admin/operations/ledger/[id]/page.tsx", 2],
    ["app/admin/operations/production-accounts/worker/[id]/page.tsx", 3],
    ["app/admin/operations/production-accounts/work-order/[id]/page.tsx", 7],
    ["app/admin/operations/_components/OperationsRecords.tsx", 6],
    // Counting, sending and receiving pairs; a new worker's pay; a discount.
    ["app/admin/stock/WherePairsAre.tsx", 3],
    ["app/admin/factory/workers/TeamList.tsx", 1],
    ["app/admin/coupons/page.tsx", 1],
    // The counter bill, rebuilt as tapped lines on 2026-09-25, gave up its own
    // walk for this one: Enter walks, and asks before it saves.
    ["app/admin/pos/_components/PosBillForm.tsx", 1],
  ];

  it("leaves every form with a figure in it walking, bar the ones that already walk", async () => {
    const { readdir } = await import("node:fs/promises");
    const files = (await readdir("app/admin", { recursive: true }))
      .map(String)
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => `app/admin/${file.replace(/\\/g, "/")}`);
    const unwalked: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      // A form that posts somewhere (server action or handler) and has a
      // number box, still drawn as a plain <form>.
      if (/shiftKey/.test(source)) continue; // walks by its own handler
      const plainForms = source.match(/<form\s+(action|onSubmit)=\{(?!deleteOperationRecordAction)[\s\S]*?<\/form>/g) ?? [];
      if (plainForms.some((form) => form.includes('type="number"'))) unwalked.push(file);
    }
    // None: a new form with a figure in it, drawn as a plain <form>, is one
    // where Enter saves by itself again.
    expect(unwalked).toEqual([]);
  });

  it.each(wrapped)("%s uses the walking form", async (file, count) => {
    const source = await readFile(file, "utf8");
    expect((source.match(/<EnterWalkForm\b/g) ?? []).length).toBe(count);
    expect((source.match(/<\/EnterWalkForm>/g) ?? []).length).toBe(count);
  });

  it("reads back the worker and the amount on every cash payment", async () => {
    for (const file of [
      "app/admin/operations/production-accounts/payments/page.tsx",
      "app/admin/factory/ledger/PieceLedger.tsx",
      "app/admin/factory/salary/StaffSalary.tsx",
      "app/admin/purchasing/_components/SupplierPaymentForm.tsx",
    ]) {
      const source = await readFile(file, "utf8");
      expect(source, file).toContain('data-summary="money"');
    }
  });

  it("leaves the two forms that already walk to their own handling", async () => {
    for (const file of [
      "app/admin/purchasing/_components/PurchaseInvoiceForm.tsx",
      "app/admin/factory/add-work/WorkEntryForm.tsx",
    ]) {
      const source = await readFile(file, "utf8");
      expect(source, file).not.toContain("EnterWalkForm");
    }
  });
});
