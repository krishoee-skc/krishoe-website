import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The switch was working. There was nothing for it to switch.
 *
 * The owner pressed नेपाली, then ENGLISH, on the products screen and got the
 * identical page both times — "Product Name" sitting beside "नेपालीमा नाम",
 * "Min Wholesale Qty (pairs)" beside "० जोडी". Not a broken button: of 168
 * admin and factory files, exactly one had ever called useLanguage, and that
 * one was the button itself. A switch can only turn words that were written as
 * a pair, and none of these were.
 *
 * The mixture is the worst of the three states. A screen in English can be read
 * by an English reader and a screen in Nepali by a Nepali one; a screen in both
 * can be read fully by neither, and the person at the counter is the one who
 * gives up.
 *
 * This is the daily-screens list. The other 160 admin screens open once a month
 * and are a later job; these are the ones opened fifty times a day, by staff
 * and workers as well as the owner.
 */
const DAILY = [
  "app/admin/ProductForm.tsx",
  "app/admin/products/page.tsx",
];

describe("the screens opened every day", () => {
  it("writes its words as pairs, so the switch has something to turn", async () => {
    for (const file of DAILY) {
      const source = await readFile(file, "utf8");
      const paired = /useLanguage|<T\s|<T$/.test(source);
      expect(paired, file).toBe(true);
    }
  });

  it("has no English label left stranded on the product form", async () => {
    const form = (await readFile("app/admin/ProductForm.tsx", "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

    // Every visible label went through text(). If one is added later without
    // it, this catches the stranded string rather than the eye having to.
    const labels = form.match(/<span className="text-sm font-medium">([^<]*)</g) ?? [];
    for (const label of labels) {
      expect(label, label).toContain("text(");
    }
  });

  it("leaves the words the device owns in English", async () => {
    const form = await readFile("app/admin/ProductForm.tsx", "utf8");

    // Per the shop's own rule: KRISHOE's words turn, the phone's do not. A
    // Nepali "Save" sends the reader hunting for a system button that is not
    // there. SKU is the code printed on the box.
    expect(form).toContain('text("SKU"');
  });

  it("never renames a field, only its label", async () => {
    const form = await readFile("app/admin/ProductForm.tsx", "utf8");

    // name="…" is what the server action reads. Translating a label is
    // cosmetic; translating a field name silently drops the value.
    for (const field of [
      'name="name"',
      'name="nameNe"',
      'name="sku"',
      'name="priceRupees"',
      'name="wholesalePriceRupees"',
      'name="minWholesaleQty"',
      'name="status"',
      'name="featured"',
    ]) {
      expect(form, field).toContain(field);
    }
  });

  it("keeps the values the database stores, whatever the reader sees", async () => {
    const form = await readFile("app/admin/ProductForm.tsx", "utf8");

    // The status column has a CHECK constraint on exactly these two strings.
    expect(form).toContain('<option value="Active">');
    expect(form).toContain('<option value="Draft">');
  });
});
