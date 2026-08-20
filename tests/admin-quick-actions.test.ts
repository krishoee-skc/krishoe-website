import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The row of buttons on the admin home.
 *
 * It read "काम भर्ने · 💰 भुक्तानी · 📦 Orders · 🛒 POS Bill" — two languages
 * side by side and three emoji. The owner saw it as unpolished and chose one
 * language, English, with the shop's own icons.
 */
describe("the quick actions row", () => {
  it("speaks one language", async () => {
    const source = await readFile("components/admin/QuickAdminHome.tsx", "utf8");
    const row = source.slice(source.indexOf("Quick actions"));

    for (const label of ["Add Work", "Payments", "Orders", "Billing", "Stock"]) {
      expect(row, label).toContain(`\n          ${label}\n`);
    }
  });

  it("uses the shop's icons, not emoji", async () => {
    const source = await readFile("components/admin/QuickAdminHome.tsx", "utf8");
    const row = source.slice(source.indexOf('className="flex flex-wrap gap-3'));

    // An emoji is drawn by whatever font the phone carries, so the same screen
    // looked different on every device and never in the brand's colour.
    expect(row).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(row).toContain("<PlusIcon");
    expect(row).toContain("<CreditCardIcon");
    expect(row).toContain("<PackageIcon");
    expect(row).toContain("<ShoppingCartIcon");
  });

  it("gives every button a thumb-sized target", async () => {
    const source = await readFile("components/admin/QuickAdminHome.tsx", "utf8");
    const row = source.slice(source.indexOf('className="flex flex-wrap gap-3'));
    const buttons = [...row.matchAll(/className="inline-flex[^"]*"/g)];

    expect(buttons.length).toBeGreaterThanOrEqual(5);
    for (const button of buttons) {
      expect(button[0], button[0].slice(0, 40)).toContain("min-h-11");
    }
  });
});

describe("what the dashboard states as fact", () => {
  it("does not carry a hand-written worker total", async () => {
    const source = await readFile("components/admin/QuickAdminHome.tsx", "utf8");
    // Comments stripped: the one above the fix names the string it replaced,
    // and matching prose would fail the moment a change is explained well.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");

    // Twelve matched nothing. The shop has eight workers in the app and
    // twenty-five in the factory, so it was wrong the day it was typed and
    // gets wronger as workers are added.
    expect(code).not.toContain("/12 workers");
  });

  it("is written in Devanagari, not another script that looks close", async () => {
    const source = await readFile("components/admin/QuickAdminHome.tsx", "utf8");
    const bengali = [...source].filter((ch) => ch >= "\u0980" && ch <= "\u09FF");

    // "नयाँ অর्डर" carried two Bengali letters in the middle of a Nepali word.
    // It renders, so nothing complains — it simply looks wrong to anyone who
    // reads Nepali.
    expect(bengali.join("")).toBe("");
  });
});
