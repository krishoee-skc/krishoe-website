import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFile(file, "utf8");

/**
 * Owner, 2026-10-04 ("code garau ok"): on a laptop the shoe cards filled the
 * screen and the bill was squeezed; the size and its pairs read as one number
 * ("36¹" as 361). Same counter, new look, on the computer and the phone.
 */
describe("the bill screen's new look", () => {
  it("lists the shoes short, one column on a phone and two on a computer", async () => {
    const picker = await read("app/admin/pos/_components/PosProductPicker.tsx");
    expect(picker).toContain('<div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">');
    expect(picker).toContain("const inBill = cart.some((line) => line.design === item.design);");
  });

  it("gives the bill more room", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain("md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
  });

  it("puts each size above its pairs, in a box of their own", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('<span className="text-[10px] font-bold leading-none text-brand-muted lg:text-sm">{row.size || "—"}</span>');
    expect(form).toContain("border-[1.5px] border-brand-green bg-brand-green-wash");
  });

  it("says the wholesale minimum on the line, the server's own rule", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('if (channel !== "Wholesale" || kind !== "Sale") return 0;');
    expect(form).toContain('text("Add pairs", "जोडी थप्ने")');
    const page = await read("app/admin/pos/page.tsx");
    expect(page).toContain("minWholesaleQty: product.minWholesaleQty,");
    // the save still checks it itself
    const pos = await read("lib/pos.ts");
    expect(pos).toContain("wholesale minimum order is ${product.minWholesaleQty} pairs");
  });
});

/** Owner, 2026-10-04: Enter shows the exact cash; a big screen gives the bill half. */
describe("the cash box and the big screen", () => {
  it("puts the exact amount in an empty cash box on Enter, and lets the next Enter walk on", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('if (event.key !== "Enter" || event.shiftKey) return;');
    expect(form).toContain('if (received === "") {');
    expect(form).toContain("setReceived(String(amountDue + dueAmount));");
    // the walk stops for that one press only — EnterWalkForm skips a prevented key
    const walk = await read("components/admin/EnterWalkForm.tsx");
    expect(walk).toContain("if (event.defaultPrevented) return;");
  });

  it("gives the bill half of a big screen, in larger type", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain("{/* The total, beside Save (owner, 2026-10-04: the namuna's model). */}");
    expect(form).toContain("lg:text-6xl");
  });
});

/** Owner, 2026-10-04: after the exact amount, Enter did not reach Save. */
describe("Enter from the cash box", () => {
  it("goes to Save once the amount is in, unless Save is shut", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('const saveButton = document.querySelector<HTMLButtonElement>(`#${BILL_FORM_ID} button[type="submit"]`);');
    expect(form).toContain("if (!saveButton || saveButton.disabled) return;");
    expect(form).toContain("saveButton.focus();");
  });
});

/** Owner, 2026-10-04: Enter goes rate → phone → name → PAN → cash → Save; PAN optional. */
describe("Enter's way through a bill", () => {
  it("goes on from a rate to the next shoe without one, else to the customer's phone", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain("goOnFromRate(first.design);");
    expect(form).toContain('document.querySelector<HTMLInputElement>(`#${BILL_FORM_ID} input[type="tel"]`)?.focus()');
  });

  it("keeps the discount in rupees and the country off the way", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('aria-label={text("Discount in rupees", "छुट रकम")}\n                  // Off Enter\'s way to the customer and the cash (2026-10-04).\n                  data-enter-skip=""');
    const phone = await read("components/PhoneWithCountry.tsx");
    expect(phone).toContain('data-enter-skip=""');
  });

  it("says PAN is optional — the save never asked for it", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('text("PAN (optional — prints on the bill if given)"');
  });
});
