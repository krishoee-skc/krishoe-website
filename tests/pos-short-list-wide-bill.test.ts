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
    expect(picker).toContain('<div className="grid gap-1.5 sm:grid-cols-2">');
    expect(picker).toContain("const inBill = cart.some((line) => line.design === item.design);");
  });

  it("gives the bill more room", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain("lg:grid-cols-[minmax(0,1fr)_470px]");
  });

  it("puts each size above its pairs, in a box of their own", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('<span className="text-[10px] font-bold leading-none text-brand-muted min-[1600px]:text-sm">{row.size || "—"}</span>');
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
    expect(form).toContain('if (event.key !== "Enter" || event.shiftKey || received !== "") return;');
    expect(form).toContain("setReceived(String(amountDue + dueAmount));");
    // the walk stops for that one press only — EnterWalkForm skips a prevented key
    const walk = await read("components/admin/EnterWalkForm.tsx");
    expect(walk).toContain("if (event.defaultPrevented) return;");
  });

  it("gives the bill half of a big screen, in larger type", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain("min-[1600px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
    expect(form).toContain("min-[1600px]:text-6xl");
  });
});
