import { hasNoPhoto, isSamplePhoto, photoAdvice } from "@/lib/product-photo";
import type { Product } from "@/lib/products";

/**
 * What a shoe still needs before it can go on the shop (owner, 2026-10-07).
 *
 * Four shoes were on sale and twenty-one sat in Draft, and the list said only
 * "Draft" beside each — nothing about which were nearly done or what was
 * missing, so none moved. Each need is a pair of words, English and Nepali.
 *
 * `blocking` keeps a shoe off the shop: a customer would see the wrong shoe,
 * no price, no size to choose, or order a pair that is not there. `advice`
 * would sell it better but does not stop it.
 */
export type ShoeNeed = { key: string; en: string; ne: string };

export type ShoeReadiness = { ready: boolean; blocking: ShoeNeed[]; advice: ShoeNeed[] };

type ReadinessFields = Pick<Product, "image" | "gallery" | "priceValue" | "sizes" | "stock" | "description" | "nameNe">;

/** "25, 26, 27" → "25–27" when it runs without a gap; otherwise the list. */
function sizeWords(sizes: string[]) {
  const numbers = sizes.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (numbers.length > 2 && numbers.every((size, index) => index === 0 || size === numbers[index - 1] + 1)) {
    return `${numbers[0]}–${numbers[numbers.length - 1]}`;
  }
  return numbers.join(", ");
}

/**
 * @param stockSizes the real sizes the shoe's stock holds pairs in, when it is
 * kept size by size; empty when the stock is one pile (sizes unknown).
 */
export function shoeReadiness(product: ReadinessFields, stockSizes: string[] = []): ShoeReadiness {
  const blocking: ShoeNeed[] = [];
  const advice: ShoeNeed[] = [];

  if (hasNoPhoto(product.image) || isSamplePhoto(product.image)) {
    blocking.push({ key: "photo", en: "a real photo", ne: "असली फोटो" });
  }
  if (!(product.priceValue > 0)) {
    blocking.push({ key: "price", en: "a price", ne: "मूल्य" });
  }
  const sizes = product.sizes.map((size) => size.trim()).filter(Boolean);
  if (sizes.length === 0) {
    blocking.push({ key: "sizes", en: "sizes", ne: "साइज" });
  }
  if (!(product.stock > 0)) {
    blocking.push({ key: "stock", en: "pairs in stock", ne: "स्टकमा जोडी" });
  }

  // The sizes a customer can pick must be sizes there are pairs of.
  if (sizes.length > 0 && stockSizes.length > 0) {
    const onShoe = new Set(sizes);
    const missingFromShoe = stockSizes.filter((size) => !onShoe.has(size));
    if (missingFromShoe.length === stockSizes.length) {
      blocking.push({
        key: "size-match",
        en: `sizes to match the stock (stock is ${sizeWords(stockSizes)}, the shoe says ${sizeWords(sizes)})`,
        ne: `साइज stock सँग मिलाउने (stock ${sizeWords(stockSizes)} छ, जुत्तामा ${sizeWords(sizes)} लेखिएको छ)`,
      });
    } else if (missingFromShoe.length > 0) {
      advice.push({
        key: "size-more",
        en: `size ${sizeWords(missingFromShoe)} is in stock but not on the shoe`,
        ne: `साइज ${sizeWords(missingFromShoe)} stock मा छ तर जुत्तामा छैन`,
      });
    }
  }

  if (photoAdvice(product).some((item) => item.en.startsWith("One photo"))) {
    advice.push({ key: "more-photos", en: "2–4 more photos", ne: "अझ २–४ फोटो" });
  }
  if (!product.description?.trim()) {
    advice.push({ key: "description", en: "a few words about it", ne: "छोटो विवरण" });
  }
  if (!product.nameNe?.trim()) {
    advice.push({ key: "name-ne", en: "a Nepali name", ne: "नेपाली नाम" });
  }

  return { ready: blocking.length === 0, blocking, advice };
}
