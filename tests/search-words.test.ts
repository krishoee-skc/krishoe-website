import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_WORDS,
  FOOTWEAR_WORDS,
  PLACE_WORDS,
  productImageAlt,
  productSearchWords,
} from "@/lib/search-words";
import { createPageMetadata } from "@/lib/seo";

/**
 * The shop described itself to Google in Devanagari alone — जुत्ता, चप्पल,
 * नेपाली जुत्ता — and almost nobody types Devanagari into a search box. Nepali
 * shoppers type Roman: jutta, chappal, bachha ko jutta.
 *
 * The proof is in this shop's own history. Its Instagram was called
 * shree_krishna_chhapal. Its TikTok is s.k.c.shoes666. The owner writes to me
 * in Roman every day. A shopper searching "nepali chappal online" met a shop
 * that had never written the word in a form they would recognise.
 */
describe("the words a Nepali shopper types", () => {
  it("carries the Roman spellings, not only Devanagari", () => {
    for (const word of ["jutta", "chappal", "nepali jutta", "nepali chappal"]) {
      expect(FOOTWEAR_WORDS, word).toContain(word);
    }
    // The Devanagari stays. Some people do type it, and it is what the page
    // itself reads in.
    expect(FOOTWEAR_WORDS).toContain("जुत्ता");
    expect(FOOTWEAR_WORDS).toContain("चप्पल");
  });

  it("allows for spellings that vary, because there is no standard", () => {
    // chappal, chapal, chhapal all get typed and all mean the same thing.
    expect(FOOTWEAR_WORDS).toContain("chapal");
    expect(FOOTWEAR_WORDS).toContain("chhapal");
    expect(FOOTWEAR_WORDS).toContain("juta");
  });

  it("names the town the way people write it", () => {
    // Narayangadh and Narayanghat are both in daily use.
    expect(PLACE_WORDS).toContain("Narayangadh");
    expect(PLACE_WORDS).toContain("Narayanghat");
    expect(PLACE_WORDS).toContain("Chitwan");
  });

  it("gives each shelf the words someone looking for it would use", () => {
    expect(CATEGORY_WORDS["kids-collection"]).toContain("bachha ko jutta");
    expect(CATEGORY_WORDS["ladies-sandals"]).toContain("ladies sandal");
  });
});

describe("what every page tells a search engine", () => {
  it("puts those words on the shop and category pages, which had none", () => {
    const shop = createPageMetadata({ title: "Shop", description: "…", path: "/shop" });
    const words = (shop.keywords as string[]) ?? [];

    expect(words).toContain("chappal");
    expect(words).toContain("jutta");
    expect(words).toContain("Narayangadh");
  });

  it("adds the shelf's own words when it is a category page", () => {
    const kids = createPageMetadata({
      title: "Kids",
      description: "…",
      path: "/shop/kids-collection",
      categorySlug: "kids-collection",
    });

    expect((kids.keywords as string[]) ?? []).toContain("bachha ko jutta");
  });

  it("does not repeat a word, which reads as padding", () => {
    const words = productSearchWords({
      name: "Bachha Rubber (Kids)",
      category: "Kids Collection",
      categorySlug: "kids-collection",
    });

    expect(new Set(words).size).toBe(words.length);
  });
});

/**
 * Every product photograph said alt="KRISHOE" — nothing about the shoe for a
 * screen reader, and a page of identical captions for Google Images.
 */
describe("what a photograph says it is", () => {
  it("names the shoe, its kind, and where it was made", () => {
    const alt = productImageAlt({ name: "close shoes", category: "Casual Shoes" });

    expect(alt).toContain("close shoes");
    expect(alt).toContain("Casual Shoes");
    expect(alt).toContain("Narayangadh");
  });

  it("is what the product card actually uses", async () => {
    const card = await readFile("components/ProductCard.tsx", "utf8");

    expect(card).toContain("alt={productImageAlt(product)}");
  });
});
