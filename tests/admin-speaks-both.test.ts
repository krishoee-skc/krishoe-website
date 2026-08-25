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
  "app/admin/pos/_components/PosBillForm.tsx",
  "app/admin/factory/add-work/page.tsx",
  "app/admin/orders/page.tsx",
  "app/admin/stock/page.tsx",
  "app/admin/factory/workers/page.tsx",
  "app/admin/factory/salary/page.tsx",
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

/**
 * The line between a label and a value.
 *
 * A select's option carries both: what the reader sees, and what the server
 * stores. Turning the first is translation; turning the second silently writes
 * a word the database has never heard of — and on these screens that word
 * decides whether a bill is credit or cash, and whether a worker is paid by the
 * pair or by the month.
 */
describe("what must not move while the words do", () => {
  it("keeps the values the POS library matches bills on", async () => {
    const form = await readFile("app/admin/pos/_components/PosBillForm.tsx", "utf8");

    for (const value of [
      'value="Sale"',
      'value="Return"',
      'value="Retail"',
      'value="Wholesale"',
      'value="Online"',
      'value="Cash"',
      'value="Credit"',
      'value="Bank"',
    ]) {
      expect(form, value).toContain(value);
    }
  });

  it("keeps the values that decide how a worker is paid", async () => {
    const workers = await readFile("app/admin/factory/workers/page.tsx", "utf8");
    const salary = await readFile("app/admin/factory/salary/page.tsx", "utf8");

    for (const value of ['value="piece_rate"', 'value="daily_staff"', 'value="monthly_staff"']) {
      expect(workers, value).toContain(value);
    }
    for (const value of ['value="advance"', 'value="payment"']) {
      expect(salary, value).toContain(value);
    }
  });

  it("keeps every field name the bill form submits", async () => {
    const form = await readFile("app/admin/pos/_components/PosBillForm.tsx", "utf8");

    for (const field of [
      'name="kind"',
      'name="channel"',
      'name="paymentMethod"',
      'name="cashier"',
      'name="customerName"',
      'name="ledgerId"',
      'name="paidAmount"',
    ]) {
      expect(form, field).toContain(field);
    }
  });

  it("says शनिबारको खर्च where English had to borrow the word anyway", async () => {
    const workers = await readFile("app/admin/factory/workers/page.tsx", "utf8");

    // "Usual Saturday kharcha" was an English label built around a Nepali word,
    // because English has none for it. That is the clearest sign the screen was
    // written for the wrong reader.
    expect(workers).toContain("शनिबारको खर्च");
  });
});

/**
 * The second batch: the screens opened weekly rather than hourly.
 *
 * The report hub had the opposite fault to the rest — written Nepali-first,
 * with an English half already sitting unused in lib/reports.ts. titleEn,
 * detailEn, emptyEn, actionEn were all present and none of them rendered, so a
 * reader who pressed ENGLISH got a Nepali page. Same failure, mirrored.
 */
const WEEKLY = [
  "app/admin/dues/page.tsx",
  "app/admin/payments/page.tsx",
  "app/admin/customers/page.tsx",
  "app/admin/purchasing/page.tsx",
  "app/admin/operations/page.tsx",
  "app/admin/factory/ledger/page.tsx",
  "app/admin/reports/page.tsx",
];

describe("the screens opened every week", () => {
  it("writes its words as pairs too", async () => {
    for (const file of WEEKLY) {
      const source = await readFile(file, "utf8");
      const paired = /useLanguage|<T\s|<AlertText/.test(source);
      expect(paired, file).toBe(true);
    }
  });

  it("renders the English the report hub had been carrying unused", async () => {
    const hub = await readFile("app/admin/reports/page.tsx", "utf8");

    // Every English field that lib/reports.ts computes is now asked for.
    for (const field of ["card.titleEn", "card.detailEn", "card.emptyEn", "card.actionEn", "card.unitEn"]) {
      expect(hub, field).toContain(field);
    }
    for (const field of ["insight.titleEn", "insight.detailEn", "insight.actionEn"]) {
      expect(hub, field).toContain(field);
    }
  });

  it("gives a worker's ledger its Nepali, of all the screens", async () => {
    const ledger = await readFile("app/admin/factory/ledger/page.tsx", "utf8");

    // "How much have I earned, how much have I taken" — if one screen in this
    // app had to be readable by the person it is about, it was this one.
    expect(ledger).toContain("जम्मा कमाएको");
    expect(ledger).toContain("जम्मा पाएको");
  });
});
