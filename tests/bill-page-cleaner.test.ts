import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The counter's bill page, from the owner's full copy of 2026-09-30: a note
 * that stayed up, "No price" shoes that made Rs. 0 lines, a cheque under
 * "Walk-in Customer", lines with no word of their size, seven equal payment
 * buttons, sold-out shoes taking a shelf's room, and fourteen bills below.
 */
describe("the bill page, tidied", () => {
  it("lets a note go after a few seconds", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('const timer = window.setTimeout(() => setNote(""), 6000);');
  });

  it("marks a shoe with no price and opens its rate box once it is on the bill", async () => {
    const picker = await read("app/admin/pos/_components/PosProductPicker.tsx");
    // the short list (2026-10-04) says it in fewer words
    expect(picker).toContain('text("Set price", "मूल्य लेख्ने")');
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain("if (!(rateForChannel(channel, item) > 0)) setAskRateFor(item.design);");
    expect(form).toContain("(askRateFor === first.design && !(group.rate > 0) && !back)");
  });

  it("asks a cheque for the customer's name, on the form and on the server — cash and QR need none", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('} else if (!isReturn && payment === "Cheque" && !customerName.trim()) {');
    const actions = await read("app/admin/pos/actions.ts");
    expect(actions).toContain('if (kind === "Sale" && paidByCheque && !textValue(formData, "customerName")) {');
  });

  it("reads in three steps, says wholesale or retail on the bill, and a line's missing size", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    for (const step of ['{text("Shoes", "जुत्ता")}', '{text("Customer", "ग्राहक")}', '{text("Payment", "भुक्तानी")}']) {
      expect(form).toContain(step);
    }
    expect(form).toContain('channel === "Wholesale" ? text("Wholesale", "थोक")');
    expect(form).toContain("साइज नगनिएको ×${pairs}");
  });

  it("keeps the usual payments open and the rest under More", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('const MAIN_PAYMENTS: Payment[] = ["Cash", "QR", "eSewa", "Credit"];');
    expect(form).toContain('{text("More ▾", "अरू ▾")}');
  });

  it("folds sold-out shoes, and lists only today's bills below the bill", async () => {
    const picker = await read("app/admin/pos/_components/PosProductPicker.tsx");
    expect(picker).toContain("const tiles = foldSoldOut && !showSoldOut ? shown.filter((item) => pairsLeft(item, cart) > 0) : shown;");
    const page = await read("app/admin/pos/page.tsx");
    expect(page).toContain("pos.recentInvoices.filter((invoice) => kathmanduDay(invoice.createdAt) === todayKey)");
    expect(page).toContain('<T en="All bills and the month → Reports" ne="सबै बिल र महिनाको हिसाब → Reports" />');
  });
});
