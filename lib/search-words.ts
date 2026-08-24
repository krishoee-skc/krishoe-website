/**
 * The words Nepali shoppers actually type.
 *
 * The shop was described to Google in Devanagari — जुत्ता, चप्पल, नेपाली जुत्ता —
 * and almost nobody types Devanagari into a search box. They type Romanised
 * Nepali: jutta, chappal, bachha ko jutta. The evidence is in this shop's own
 * history: the Instagram account was called shree_krishna_chhapal, the TikTok
 * is s.k.c.shoes666, and the owner writes to me in Roman every day.
 *
 * So a shopper searching "nepali chappal online" met a shop that had never
 * written the word chappal in a form they would recognise, and a shop nobody
 * searches for is a shop nobody finds.
 *
 * Spellings vary because there is no standard: chappal, chapal, chhapal all
 * refer to the same thing and all three get typed. Listing them costs nothing.
 */

/** How this shop and its town are written, in every form people use. */
export const PLACE_WORDS = [
  "Nepal",
  "Narayangadh",
  "Narayanghat",
  "Bharatpur",
  "Chitwan",
  "नेपाल",
  "नारायणगढ",
  "चितवन",
];

/** Footwear, in Devanagari, in Roman, and in English. */
export const FOOTWEAR_WORDS = [
  // Devanagari — read by Nepali readers, typed by few.
  "जुत्ता",
  "चप्पल",
  "नेपाली जुत्ता",
  // Roman — what actually gets typed into a search box.
  "jutta",
  "juta",
  "chappal",
  "chapal",
  "chhapal",
  "nepali jutta",
  "nepali chappal",
  "jutta nepal",
  "chappal nepal",
  // English — the diaspora, and buyers outside Nepal.
  "shoes",
  "sandals",
  "slippers",
  "footwear",
  "Nepal footwear",
  "made in Nepal shoes",
  "handmade shoes Nepal",
];

/** Per category, the words someone looking for that shelf would type. */
export const CATEGORY_WORDS: Record<string, string[]> = {
  "ladies-sandals": [
    "महिलाको सयडल",
    "ladies sandal",
    "mahila sandal",
    "sandal nepal",
    "women sandals Nepal",
  ],
  "ladies-slippers": [
    "महिलाको चप्पल",
    "ladies chappal",
    "mahila chappal",
    "women slippers Nepal",
  ],
  "casual-shoes": [
    "दैनिक जुत्ता",
    "casual jutta",
    "casual shoes nepal",
    "office shoes Nepal",
  ],
  "kids-collection": [
    "बच्चाको जुत्ता",
    "बच्चाको चप्पल",
    "bachha ko jutta",
    "bachha ko chappal",
    "kids shoes Nepal",
    "school shoes Nepal",
  ],
  "party-heels": ["हिल", "party heels", "heels nepal"],
  "new-arrivals": ["नयाँ जुत्ता", "naya jutta", "new shoes Nepal"],
};

/**
 * The keyword list for one product.
 *
 * Deduplicated, because a repeated keyword helps nothing and reads as padding
 * to the crawler that has to sort it.
 */
export function productSearchWords(input: {
  name: string;
  category: string;
  categorySlug?: string;
}): string[] {
  return [
    ...new Set([
      input.name,
      input.category,
      "KRISHOE",
      ...(input.categorySlug ? (CATEGORY_WORDS[input.categorySlug] ?? []) : []),
      ...FOOTWEAR_WORDS,
      ...PLACE_WORDS,
    ]),
  ].filter(Boolean);
}

/**
 * Alt text for a product photograph.
 *
 * Every product image said alt="KRISHOE", which tells a screen reader nothing
 * about the shoe in front of it and hands Google Images a page of identical
 * captions. The name, the kind of shoe and where it was made is what both are
 * looking for.
 */
export function productImageAlt(input: { name: string; category: string }): string {
  return `${input.name} — ${input.category}, KRISHOE, Narayangadh Nepal`;
}
