import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  looksLikeShoe,
  shoesMatching,
  unknownCodeTyped,
  type ShoeOnBooks,
} from "@/app/admin/purchasing/_components/purchase-invoice-rules";

/**
 * The owner typed "magic shoe #122" on a purchase bill, 2026-09-28. The bill
 * knew a shoe only by its whole name spelled exactly, so it took the line for
 * a new raw material bound for the factory store. They chose from the sample:
 * find a shoe the way the POS does, ask when a new name reads like footwear,
 * and call the kind "shoes / slippers" rather than "ready-made shoe".
 */
const shoes: ShoeOnBooks[] = [
  { name: "magic shoe", stock: 40, codes: ["122"], nameNe: "म्याजिक जुत्ता" },
  { name: "magic sandal", stock: 12, codes: ["130"], nameNe: "" },
  { name: "bantu hill", stock: 50, codes: ["5566"], nameNe: "" },
];
const names = (list: ShoeOnBooks[]) => list.map((shoe) => shoe.name);

describe("finding a shoe on the books", () => {
  it("by its code, with or without #", () => {
    expect(names(shoesMatching(shoes, "#122"))).toEqual(["magic shoe"]);
    expect(names(shoesMatching(shoes, "122"))).toEqual(["magic shoe"]);
    expect(names(shoesMatching(shoes, "# 5566"))).toEqual(["bantu hill"]);
  });

  it("by a name with its code after it — what the owner typed", () => {
    expect(names(shoesMatching(shoes, "magic shoe #122"))[0]).toBe("magic shoe");
  });

  it("by part of the name, or the Nepali name", () => {
    expect(names(shoesMatching(shoes, "magic"))).toEqual(["magic shoe", "magic sandal"]);
    expect(names(shoesMatching(shoes, "म्याजिक"))).toEqual(["magic shoe"]);
  });

  it("offers nothing once the whole name is typed, or for one letter", () => {
    expect(shoesMatching(shoes, "Magic Shoe")).toEqual([]);
    expect(shoesMatching(shoes, "m")).toEqual([]);
    expect(shoesMatching(shoes, "")).toEqual([]);
  });
});

describe("a code no shoe carries", () => {
  it("is named, so it is not filed as a new item in silence", () => {
    expect(unknownCodeTyped(shoes, "magic shoe #999")).toBe("999");
    expect(unknownCodeTyped(shoes, "#122")).toBe("");
    expect(unknownCodeTyped(shoes, "leather black")).toBe("");
  });
});

describe("a new name that reads like footwear", () => {
  it("is asked about", () => {
    for (const name of ["sports shoe black", "Shoes", "ladies chappal", "sandal 7", "slipper", "जुत्ता", "नयाँ चप्पल", "abc #12"]) {
      expect(looksLikeShoe(name), name).toBe(true);
    }
  });

  it("is not, when it is plainly material", () => {
    for (const name of ["leather black", "sole PU", "gum", "shoelace", "thread"]) {
      expect(looksLikeShoe(name), name).toBe(false);
    }
  });
});

describe("the bill", () => {
  it("offers the matches, names a missing code, and asks before filing footwear as material", async () => {
    const form = await readFile("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx", "utf8");
    expect(form).toContain("const matches = shoesMatching(productStock, typed);");
    expect(form).toContain("onClick={() => setItemName(row, shoe.name)}");
    expect(form).toContain("कोड ${missingCode} भएको जुत्ता भेटिएन");
    expect(form).toContain('onClick={() => setKind(row, "Trading Goods")}');
    expect(form).toContain("यो बेच्ने जुत्ता/चप्पल हो?");
  });

  it("calls the kind shoes / slippers and says where each line goes", async () => {
    const form = await readFile("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx", "utf8");
    expect(form).not.toContain("Ready-made shoe");
    expect(form).toContain('text("👟 Shoes / slippers", "👟 जुत्ता / चप्पल")');
    expect(form).toContain('text("👟 Shoes/slippers", "👟 जुत्ता/चप्पल")');
    expect(form).toContain('"→ बेच्ने स्टकमा"');
    expect(form).toContain('"→ कारखानाको स्टोरमा (बेच्ने होइन)"');
  });

  it("gets each design's codes and Nepali name from the page", async () => {
    const page = await readFile("app/admin/purchasing/page.tsx", "utf8");
    expect(page).toContain("codes: [...(productCodesByName.get(name) ?? [])],");
  });
});
