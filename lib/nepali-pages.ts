/**
 * The words of the Nepali pages under /ne (owner, 2026-10-01). The shop was
 * built for both languages, but the Nepali half lived only in the browser, so
 * a search engine read every page in English — 460 English words on the home
 * page against one in Nepali. These pages are the same shelves, built in
 * Nepali, with titles and descriptions a Nepali search is matched against.
 */
export const categoryNepali: Record<string, string> = {
  "ladies-sandals": "लेडिज स्यान्डल",
  "ladies-slippers": "लेडिज चप्पल",
  "ladies-close-shoes": "महिलाको बन्द जुत्ता",
  "ladies-shoes": "महिलाको जुत्ता",
  "casual-shoes": "क्याजुअल जुत्ता",
  "party-heels": "पार्टी हिल",
  "mens-collection": "पुरुषका जुत्ता",
  "mens-slippers": "पुरुषको चप्पल",
  "mens-shoes": "पुरुषको जुत्ता",
  "kids-shoes": "बच्चाको जुत्ता",
  "kids-slippers": "बच्चाको चप्पल",
  "kids-collection": "बालबालिकाका जुत्ता",
  "new-arrivals": "नयाँ आएका जुत्ता",
};

export const nepaliHome = {
  title: "KRISHOE | नेपालमै बनेका जुत्ता र चप्पल",
  description:
    "KRISHOE: नेपालमै बनेका लेडिज स्यान्डल, चप्पल, क्याजुअल जुत्ता, हिल र बालबालिकाका जुत्ता। नेपालभरि delivery, सामान पाएपछि पैसा (COD)।",
};

export const nepaliShop = {
  title: "पसल | KRISHOE नेपाल",
  description: "KRISHOE का सबै जुत्ता र चप्पल एकै ठाउँमा — मूल्य, साइज र स्टकसहित। नेपालभरि delivery, COD।",
};

export function nepaliCategory(slug: string, fallback: string) {
  const name = categoryNepali[slug] ?? fallback;
  return {
    title: `${name} | KRISHOE नेपाल`,
    description: `KRISHOE का ${name} — नेपालमै बनेका, सिधै कारखानाबाट। नेपालभरि delivery, सामान पाएपछि पैसा (COD)।`,
  };
}
