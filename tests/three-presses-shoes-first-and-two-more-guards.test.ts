import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  BIG_DISCOUNT_SHARE,
  LOW_SIZE_LEFT,
  bigDiscount,
  billTotals,
  lowSizesAfterBill,
  type CartLine,
  type SellableItem,
} from "@/app/admin/pos/_components/pos-bill-rules";

/**
 * Owner, 2026-10-20, the five-rules sample: 1, 2 and 3.
 *  1 A cash bill in three presses: ⚡ in the size sheet saves the first pair of
 *    a retail sale in cash.
 *  2 The shop's shoes on a phone's first screen: one heading line, the filters
 *    behind ⚙ Filter.
 *  3 A discount over 20% is asked about; a size nearly gone is said on its line.
 */
const line = (over: Partial<CartLine> = {}): CartLine =>
  ({ key: "k", design: "Lose Hill Panja", sku: "KR-206", size: "36", color: "Cherry", quantity: 1, rate: 950, listRate: 950, ...over }) as CartLine;

describe("rule 3 · a big discount is asked about", () => {
  it("over a fifth of the list price, by discount or by a lowered rate", () => {
    expect(BIG_DISCOUNT_SHARE).toBe(0.2);
    expect(bigDiscount(billTotals([line()], 900, 0))).toEqual({ off: 900, percent: 95 });
    expect(bigDiscount(billTotals([line({ rate: 95 })], 0, 0))).toEqual({ off: 855, percent: 90 });
    expect(bigDiscount(billTotals([line()], 190, 0))).toBeNull();
    expect(bigDiscount(billTotals([line()], 191, 0))?.percent).toBe(20);
    expect(bigDiscount(billTotals([], 0, 0))).toBeNull();
  });

  it("asks before saving, and the yes belongs to this bill as it stands", async () => {
    const form = await readFile("app/admin/pos/_components/PosBillForm.tsx", "utf8");
    expect(form).toContain("if (bigOff && discountYes !== discountKey) {");
    expect(form).toContain("const discountKey = JSON.stringify([answerKey, totals.discount]);");
    expect(form).toContain('text("Yes, give this discount", "हो, यति नै छुट दिने")');
    expect(form).toContain('const bigOff = kind === "Return" ? null : bigDiscount(totals);');
  });
});

describe("rule 3 · a size nearly gone is said on its line", () => {
  const item = { design: "Lose Hill Panja", sizeStock: { "36": 4, "37": 9, "38": 1 } } as unknown as SellableItem;

  it("counted sizes under five once this bill is out", () => {
    expect(LOW_SIZE_LEFT).toBe(5);
    expect(lowSizesAfterBill(item, [line()], ["36"])).toEqual([{ size: "36", left: 3 }]);
    expect(lowSizesAfterBill(item, [line({ size: "38" })], ["38"])).toEqual([{ size: "38", left: 0 }]);
    expect(lowSizesAfterBill(item, [line({ size: "37" })], ["37"])).toEqual([]);
    // A pile with unknown sizes says nothing.
    expect(lowSizesAfterBill(item, [line({ size: "40" })], ["40"])).toEqual([]);
  });

  it("is drawn on the bill's line, not on a return", async () => {
    const form = await readFile("app/admin/pos/_components/PosBillForm.tsx", "utf8");
    expect(form).toContain("const lowSizes = !back && !isReturn && item ? lowSizesAfterBill(item, cart, group.lines.map((row) => row.size)) : [];");
    expect(form).toContain("साइज ${size}: यो बिलपछि ${left} मात्र बाँकी");
  });
});

describe("rule 1 · ⚡ a cash bill from the size sheet", () => {
  it("is offered only for the first pair of a retail sale with a price", async () => {
    const form = await readFile("app/admin/pos/_components/PosBillForm.tsx", "utf8");
    expect(form).toContain('const offersQuickCash = kind === "Sale" && channel === "Retail" && cart.length === 0;');
    expect(form).toContain("offersQuickCash && !isReturn && !isExchange && rateForChannel(channel, picking) > 0");
    // The same save as the button: cash, the exact amount, the bill's own questions.
    expect(form).toContain('setPayment("Cash");');
    expect(form).toContain("setReceived(\"\");");
  });

  it("chooses the size first, then one press saves or adds", async () => {
    const sheet = await readFile("app/admin/pos/_components/PosSizeSheet.tsx", "utf8");
    expect(sheet).toContain("onClick={() => (quick ? setChosen(choice.size) : onPick(choice.size, color))}");
    expect(sheet).toContain("नगदमा बिल राख्ने");
    expect(sheet).toContain("बिलमा थप्ने (धेरै जोडी, उधारो, नाम)");
  });

  it("opens the bill on a phone when the save is refused or asks a question", async () => {
    const form = await readFile("app/admin/pos/_components/PosBillForm.tsx", "utf8");
    expect(form.match(/setCartOpen\(true\);/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});

describe("rule 2 · shoes on the first screen", () => {
  it("one heading line with the count; the paragraph from a tablet up", async () => {
    const page = await readFile("app/shop/ShopCatalog.tsx", "utf8");
    expect(page).not.toContain("Premium pairs, ready to browse.");
    expect(page).toContain('ne={`${shoes} जुत्ता`}');
    expect(page).toContain('<T en="COD · Nepal delivery" ne="सामान पाएपछि पैसा · नेपालभरि" />');
    expect(page).toContain("hidden max-w-2xl text-sm leading-7 text-brand-muted md:block");
  });

  it("a phone shows the box and ⚙ Filter; the rest opens behind it", async () => {
    const controls = await readFile("app/shop/ShopCatalogControls.tsx", "utf8");
    expect(controls).toContain('const onPhone = filtersOpen ? "" : "max-md:hidden";');
    expect(controls).toContain("aria-expanded={filtersOpen}");
    expect(controls).toContain("md:grid-cols-3 md:gap-6 lg:grid-cols-4");
  });
});
