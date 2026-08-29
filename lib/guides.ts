// Buyer guides — the pages a shopper reaches by searching a question ("how to
// choose sandals", "shoe size Nepal") rather than a product name. Each answers a
// real question well, then points to the part of the shop that fulfils it, so an
// organic visitor arrives already close to a purchase. Content is bilingual the
// same way the rest of the storefront is: an English string and its Nepali pair.
//
// Kept as data (not MDX files) so the guide index, each guide page, the sitemap
// and the JSON-LD all read from one source and cannot drift.

export type GuideBlock = {
  heading: { en: string; ne: string };
  body: { en: string; ne: string }[];
};

export type Guide = {
  slug: string;
  title: { en: string; ne: string };
  // The search-result description. Google shows ~155 characters, so the promise
  // of the page comes first.
  description: { en: string; ne: string };
  // A short line under the title on the page and the index card.
  summary: { en: string; ne: string };
  keywords: string[];
  published: string; // ISO date
  updated: string; // ISO date
  emoji: string;
  intro: { en: string; ne: string };
  blocks: GuideBlock[];
  // Where the guide sends a ready reader. A category slug or "/shop".
  ctaHref: string;
  ctaLabel: { en: string; ne: string };
};

export const guides: Guide[] = [
  {
    slug: "choosing-sandals",
    title: {
      en: "How to choose the right sandals and slippers",
      ne: "आफ्नो लागि ठीक सयल र चप्पल कसरी छान्ने",
    },
    description: {
      en: "A simple guide to choosing comfortable, long-lasting sandals and slippers in Nepal — by comfort, material, sole grip and daily use.",
      ne: "नेपालमा आरामदायी, टिकाउ सयल र चप्पल कसरी छान्ने — आराम, सामग्री, sole grip र दैनिक प्रयोग अनुसार सजिलो guide।",
    },
    summary: {
      en: "Comfort, material, grip and fit — what actually matters before you buy.",
      ne: "आराम, सामग्री, grip र fit — किन्नुअघि साँच्चै के हेर्ने।",
    },
    keywords: [
      "how to choose sandals",
      "best sandals Nepal",
      "comfortable slippers",
      "ladies sandal buying guide",
      "sandal material",
    ],
    published: "2026-08-29",
    updated: "2026-08-29",
    emoji: "👡",
    intro: {
      en: "A good pair of sandals is worn every single day, so a small choice made well pays back for months. Here is what to look at before you buy — the same things we check when we make a pair at KRISHOE.",
      ne: "राम्रो सयल त हरेक दिन लगाइन्छ, त्यसैले सानो कुरा राम्ररी छान्दा महिनौँसम्म फाइदा हुन्छ। किन्नुअघि के हेर्ने — KRISHOE मा जोडी बनाउँदा हामी जे जाँच्छौँ, त्यही यहाँ छ।",
    },
    blocks: [
      {
        heading: { en: "1. Comfort comes first", ne: "१. पहिले आराम" },
        body: [
          {
            en: "Press the footbed with your thumb. It should give a little and come back — too hard tires the foot by evening, too soft gives no support. A gently cushioned footbed is what keeps a pair wearable all day.",
            ne: "footbed लाई औँलाले थिच्नुहोस्। अलिकति दबेर फर्किनुपर्छ — धेरै कडा भए बेलुकीसम्म खुट्टा थाक्छ, धेरै नरम भए support हुँदैन। हल्का cushion भएको footbed नै दिनभर लगाउन मिल्ने बनाउँछ।",
          },
        ],
      },
      {
        heading: { en: "2. Look at the material", ne: "२. सामग्री हेर्नुहोस्" },
        body: [
          {
            en: "The strap is where a cheap pair fails first. A soft strap that does not cut into the skin, and stitching (not only glue) where the strap meets the sole, is what lasts. Run a finger along the edge — it should feel finished, not sharp.",
            ne: "सस्तो जोडी पहिले strap मै बिग्रन्छ। छालामा नकाट्ने नरम strap, अनि strap र sole जोडिने ठाउँमा सिलाई (गुँद मात्र होइन) भए टिक्छ। किनारमा औँला घुमाउनुहोस् — sharp होइन, finished महसुस हुनुपर्छ।",
          },
        ],
      },
      {
        heading: { en: "3. Check the sole grip", ne: "३. Sole को grip जाँच्नुहोस्" },
        body: [
          {
            en: "Nepal's floors and streets are wet for months. Turn the pair over: a patterned sole with real grooves grips a wet tile; a flat, smooth sole slides. This one thing prevents most slips.",
            ne: "नेपालको भुइँ र सडक महिनौँ ओसिलो हुन्छ। जोडी पल्टाएर हेर्नुहोस्: grooves भएको pattern-sole ले ओसिलो tile समात्छ; समथर, चिल्लो sole चिप्लन्छ। यही एउटा कुराले धेरैजसो चिप्लने रोक्छ।",
          },
        ],
      },
      {
        heading: { en: "4. Get the fit right", ne: "४. Fit ठीक बनाउनुहोस्" },
        body: [
          {
            en: "Your foot should sit inside the sole with a small margin at the toe and heel — not spilling over the edge. If you are between sizes, size up for sandals: a strap can be adjusted, a too-small sole cannot.",
            ne: "खुट्टा sole भित्र, औँला र कुर्कुच्चातिर अलिकति ठाउँ छोडेर बस्नुपर्छ — किनारबाट बाहिर ननिस्कोस्। दुई size को बीचमा हुनुहुन्छ भने सयलमा ठूलो size लिनुहोस्: strap मिलाउन मिल्छ, सानो sole मिल्दैन।",
          },
        ],
      },
    ],
    ctaHref: "/shop/ladies-sandals",
    ctaLabel: { en: "See KRISHOE sandals", ne: "KRISHOE का सयल हेर्नुहोस्" },
  },
  {
    slug: "shoe-size-guide-nepal",
    title: {
      en: "Shoe and sandal size guide for Nepal",
      ne: "नेपालका लागि जुत्ता र सयलको size guide",
    },
    description: {
      en: "How to measure your foot at home and pick the right shoe or sandal size in Nepal — with a simple centimetre-to-size guide.",
      ne: "घरमै खुट्टा कसरी नाप्ने र नेपालमा जुत्ता/सयलको ठीक size कसरी छान्ने — सजिलो centimetre-to-size guide सहित।",
    },
    summary: {
      en: "Measure once at home and order the right size with confidence.",
      ne: "घरमै एकपटक नापेर, ठीक size आत्मविश्वासले order गर्नुहोस्।",
    },
    keywords: [
      "shoe size guide Nepal",
      "how to measure foot size",
      "sandal size chart",
      "footwear size Nepal",
      "measure foot at home",
    ],
    published: "2026-08-29",
    updated: "2026-08-29",
    emoji: "📏",
    intro: {
      en: "Most returns happen for one reason: the size was a guess. Measuring your foot takes two minutes and settles it. Here is how to do it at home, with nothing but a ruler and a wall.",
      ne: "धेरैजसो फिर्ता एउटै कारणले हुन्छ: size अनुमान थियो। खुट्टा नाप्न दुई मिनेट लाग्छ र कुरा टुंगिन्छ। घरमै — रुलर र भित्तो मात्रले — कसरी गर्ने, यहाँ छ।",
    },
    blocks: [
      {
        heading: { en: "Measure your foot in 4 steps", ne: "४ चरणमा खुट्टा नाप्नुहोस्" },
        body: [
          {
            en: "1. Stand on a piece of paper with your heel against a wall. 2. Mark the tip of your longest toe. 3. Measure from the wall edge of the paper to the mark, in centimetres. 4. Measure both feet and use the longer one — feet are rarely identical.",
            ne: "१. कागजमा उभिनुहोस्, कुर्कुच्चा भित्तामा टेकाएर। २. सबभन्दा लामो औँलाको टुप्पोमा चिन्ह लगाउनुहोस्। ३. कागजको भित्तापट्टिको किनारदेखि चिन्हसम्म centimetre मा नाप्नुहोस्। ४. दुबै खुट्टा नापेर लामो वालाको प्रयोग गर्नुहोस् — खुट्टा विरलै बराबर हुन्छन्।",
          },
        ],
      },
      {
        heading: { en: "Turn centimetres into a size", ne: "Centimetre लाई size मा बदल्नुहोस्" },
        body: [
          {
            en: "As a rough guide: 23 cm ≈ size 36, 24 cm ≈ 37, 25 cm ≈ 38, 26 cm ≈ 39, 27 cm ≈ 40, 28 cm ≈ 41, 29 cm ≈ 42. Add about half a centimetre of room so the toe is never pressed against the front.",
            ne: "मोटामोटी guide: 23 cm ≈ size 36, 24 cm ≈ 37, 25 cm ≈ 38, 26 cm ≈ 39, 27 cm ≈ 40, 28 cm ≈ 41, 29 cm ≈ 42। अगाडि औँला नठोक्कियोस् भन्नाका लागि करिब आधा centimetre ठाउँ थप्नुहोस्।",
          },
        ],
      },
      {
        heading: { en: "When you are between sizes", ne: "दुई size को बीचमा हुँदा" },
        body: [
          {
            en: "For closed shoes, take the smaller size if the fit is snug, the larger if you wear socks. For sandals and slippers, take the larger size — the strap adjusts, and a little room is comfortable, never a problem.",
            ne: "बन्द जुत्तामा, snug fit भए सानो, मोजा लगाउने भए ठूलो लिनुहोस्। सयल र चप्पलमा ठूलो लिनुहोस् — strap मिल्छ, अनि अलिकति ठाउँ आरामदायी हुन्छ, कहिल्यै समस्या होइन।",
          },
        ],
      },
    ],
    ctaHref: "/shop",
    ctaLabel: { en: "Shop by your size", ne: "आफ्नो size अनुसार किन्नुहोस्" },
  },
];

export function getGuide(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}
