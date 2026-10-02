import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { addedLine, sizeChoices } from "@/components/SizeSheet";
import { reframeBox } from "@/lib/photo-reframe";
import { withSizeStock } from "@/lib/stock-by-size";
import type { FinishedStock } from "@/lib/operations";

const read = (file: string) => readFile(file, "utf8");

/**
 * Owner, 2026-10-02: "I tapped the cart on my phone to buy a 38 and could
 * not." The card's bag put the first size, a 36, in the cart without asking.
 */
describe("the card asks for the size", () => {
  it("opens the size sheet instead of adding the first size", async () => {
    const source = await read("components/ProductCardActions.tsx");
    expect(source).toContain("if (product.sizes.length > 1 || product.colors.length > 1) {");
    expect(source).toContain("setSheetOpen(true);");
  });

  it("adds every chosen size as its own line of one pair, and nothing before a size is chosen", async () => {
    const sheet = await read("components/SizeSheet.tsx");
    expect(sheet).toContain("for (const size of ordered) addToCart({ productId: live.id, size, color, quantity: 1 });");
    expect(sheet).toContain("if (ordered.length === 0) return;");
    expect(sheet).toContain("disabled={ordered.length === 0}");
  });

  it("says which sizes went in", () => {
    expect(addedLine("Doctor Chappal", ["37", "38"])).toEqual({
      en: "Added · Doctor Chappal · Size 37, 38",
      ne: "थपियो · Doctor Chappal · साइज 37, 38",
    });
  });

  it("strikes a size the shelf has none of, warns when few are left, and opens every size when stock is not kept by size", () => {
    expect(sizeChoices({ sizes: ["38", "39", "40"], sizeStock: { "38": 5, "39": 1, "40": 0 } })).toEqual([
      { size: "38", soldOut: false, few: null },
      { size: "39", soldOut: false, few: 1 },
      { size: "40", soldOut: true, few: null },
    ]);
    expect(sizeChoices({ sizes: ["38", "39"] }).every((choice) => !choice.soldOut && choice.few === null)).toBe(true);
  });

  it("gives a shoe pairs per size only when all its stock is kept by size", () => {
    const row = (sizeRun: string, stockPairs: number) => ({ design: "Doctor Chappal", sizeRun, stockPairs }) as unknown as FinishedStock;
    const shoe = { name: "Doctor Chappal", sizes: ["38", "39"] };
    expect(withSizeStock([shoe], [row("38", 4), row("39", 0)])[0].sizeStock).toEqual({ "38": 4, "39": 0 });
    // A "Mixed" pile could hold any size: say nothing rather than wrongly "sold out".
    expect(withSizeStock([shoe], [row("38", 4), row("Mixed", 10)])[0].sizeStock).toBeUndefined();
    expect(withSizeStock([shoe], [])[0].sizeStock).toBeUndefined();
  });

  it("lets the cart change a line's size, joining the line already in that size", async () => {
    const provider = await read("components/commerce/CommerceProvider.tsx");
    expect(provider).toContain("const changeSize = useCallback((key: string, size: string) => {");
    expect(provider).toContain("quantity: Math.min(item.quantity + moving.quantity, 9)");
    expect(await read("components/CartClient.tsx")).toContain("moveSize(item.key, item.productId, item.color, event.target.value)");
  });
});

describe("old photos with bars", () => {
  it("frames a tall photo padded into a square from the picture inside the bars", () => {
    // Doctor Chappal as it is stored: 360 of 640 across is photo, the rest bars.
    expect(reframeBox(640, 640, { left: 140, top: 0, width: 360, height: 640 })).toEqual({
      width: 640,
      height: 640,
      left: 140,
      top: 95,
      cropWidth: 360,
      cropHeight: 450,
    });
  });

  it("leaves a photo without real bars alone", () => {
    expect(reframeBox(640, 640, { left: 20, top: 0, width: 600, height: 640 })).toBeNull();
    expect(reframeBox(640, 640, { left: 0, top: 0, width: 640, height: 640 })).toBeNull();
  });

  it("shows the result first, keeps the old photo, and fetches only the shop's own stores", async () => {
    const actions = await read("app/admin/products/photos/actions.ts");
    expect(actions).toContain("gallery: [url, ...product.gallery.filter((item) => item !== url)]");
    expect(actions).toContain('url.hostname.endsWith(".blob.vercel-storage.com")');
    expect(await read("app/admin/products/photos/page.tsx")).toContain("<FixFramedPhotos />");
  });
});
