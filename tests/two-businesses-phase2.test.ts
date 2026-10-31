import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { billPrefix, nextBillNumber } from "@/lib/bill-number";
import { drawFromPlaces, placeChangesFor, placesFrom } from "@/lib/stock-rules";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/**
 * The factory and the shop as two businesses, part two (owner, 2026-10-31,
 * "garau"): Cut a bill chooses whose bill — 🛒 the shop's KRB or 🏭 the
 * factory's KRF — and nothing is billed in the other's name behind the
 * counter's back.
 */
describe("two businesses: whose bill", () => {
  it("counts the factory's bills apart from the shop's", () => {
    const existing = ["KRB005", "KRR002", "KRF002", "KRFR001"];
    expect(nextBillNumber("Sale", existing, "factory")).toBe("KRF003");
    expect(nextBillNumber("Return", existing, "factory")).toBe("KRFR002");
    expect(nextBillNumber("Sale", existing)).toBe("KRB006");
    expect(nextBillNumber("Return", existing)).toBe("KRR003");
    expect(nextBillNumber("Sale", [], "factory")).toBe("KRF001");
    expect(billPrefix("Sale", "factory")).toBe("KRF");
  });

  it("takes a bill's pairs from its own business's place first, whatever the channel", () => {
    expect(placesFrom("Wholesale", "Shop")).toEqual(["Shop", "Factory"]);
    expect(placesFrom("Retail", "Factory")).toEqual(["Factory", "Shop"]);
    expect(placesFrom("Wholesale")).toEqual(["Factory", "Shop"]);
    expect(drawFromPlaces("Retail", 3, { Shop: 5, Factory: 5 }, "Factory")).toEqual([{ place: "Factory", pairs: 3 }]);
    expect(placeChangesFor({ type: "Return In", pairs: 2, channel: "Retail" }, {}, "apply", "Factory")).toEqual([
      { place: "Factory", pairs: 2 },
    ]);
  });

  it("asks a short shop for a challan or the factory's bill, and tells a short factory", () => {
    const pos = read("lib/pos.ts");
    expect(pos).toContain('"shortAtShop",\n          short.map((group) => group.design),');
    expect(pos).toContain("Not enough at the factory");
    expect(pos).toContain("async function checkFactoryBill(channel: PosChannel, designs: string[])");
    // A website order turned into a bill is sent from wherever the pairs are.
    expect(pos).toContain('if (business && !(business === "shop" && input.answerFromFactory)) {');
    expect(read("app/admin/actions.ts")).toContain("answerFromFactory: true,");
    const form = read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('🚚 {text("Challan first", "पहिले challan गर्ने")}');
    expect(form).toContain('🏭 {text("Move to the factory\'s bill", "कारखानाको बिलमा सार्ने")}');
    expect(read("app/admin/stock/page.tsx")).toContain("moveFirst={moveFirst}");
  });

  it("puts a cancelled test bill's pairs back with its own business", () => {
    const cancel = read("lib/pos-void.ts");
    expect(cancel).toContain(
      'const home = bill.business === "factory" ? ("Factory" as const) : bill.business === "shop" ? ("Shop" as const) : undefined;',
    );
    expect(cancel).toContain("...(home ? { fromPlace: home } : {}),");
  });

  it("saves one paper in two parts together, and prints both", () => {
    expect(read("lib/pos.ts")).toContain("await createPosInvoicesTogetherPostgres(factory, shop)");
    expect(read("app/admin/pos/actions.ts")).toContain("const both = await createPosSplitBill({ ...billInput, items: shopItems, factoryItems });");
    const receipt = read("app/admin/pos/[id]/page.tsx");
    expect(receipt).toContain("<BillPaper invoice={bill} company={companyFor(bill)} sellerName={sellerFor(bill)} shopDomain={shopDomain} />");
  });

  it("asks about a shoe on the bill, never decides in silence", () => {
    const form = read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain("पसलको भाग थप्ने?");
    expect(form).toContain("कारखानाको बिलमा सार्ने?");
    expect(form).toContain("बनाएको हो कि किनेको?");
    expect(form).toContain('blocked = text("Answer the question on the bill first"');
  });
});
