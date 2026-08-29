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
  {
    slug: "leather-footwear-care",
    title: {
      en: "How to care for leather footwear so it lasts for years",
      ne: "छालाको जुत्ता वर्षौँ टिकाउन कसरी सम्हाल्ने",
    },
    description: {
      en: "Simple steps to clean, dry and protect leather shoes and sandals in Nepal — so a good pair lasts years, not one season.",
      ne: "नेपालमा छालाको जुत्ता/सयल कसरी सफा गर्ने, सुकाउने र जोगाउने — राम्रो जोडी एक season होइन, वर्षौँ टिकोस्।",
    },
    summary: {
      en: "Clean, dry and protect — the three-minute habit that doubles a pair's life.",
      ne: "सफा, सुकाउने, जोगाउने — जोडीको आयु दोब्बर बनाउने तीन-मिनेटे बानी।",
    },
    keywords: [
      "leather shoe care",
      "how to clean leather sandals",
      "make shoes last longer",
      "leather footwear Nepal",
      "shoe maintenance",
    ],
    published: "2026-08-29",
    updated: "2026-08-29",
    emoji: "👞",
    intro: {
      en: "Leather is a natural material — treated well it softens and lasts for years; ignored, it cracks in one wet season. None of the care is difficult. Here is the whole of it.",
      ne: "छाला प्राकृतिक सामग्री हो — राम्ररी हेरचाह गर्दा नरम भई वर्षौँ टिक्छ; बेवास्ता गर्दा एउटै ओसिलो season मा फुट्छ। हेरचाह गाह्रो केही छैन। पूरै यहाँ छ।",
    },
    blocks: [
      {
        heading: { en: "Wipe after wearing", ne: "लगाएपछि पुछ्नुहोस्" },
        body: [
          {
            en: "Dust and street grit dry out leather. A quick wipe with a soft, slightly damp cloth after a day out removes it before it does harm — the single most useful habit there is.",
            ne: "धूलो र सडकको फोहोरले छाला सुख्खा बनाउँछ। दिनभरपछि नरम, अलिकति ओसिलो कपडाले छिटो पुछ्दा हानि गर्नुअघि हट्छ — सबभन्दा उपयोगी बानी यही हो।",
          },
        ],
      },
      {
        heading: { en: "Dry slowly, never in the sun", ne: "बिस्तारै सुकाउनुहोस्, घाममा कहिल्यै होइन" },
        body: [
          {
            en: "Got caught in the rain? Wipe off the water and let the pair dry in the shade, away from direct sun and heaters. Stuff them with paper to hold their shape. Fast heat is what curls and cracks leather.",
            ne: "पानीमा भिज्नुभयो? पानी पुछेर छायाँमा, सीधा घाम र heater बाट टाढा सुकाउनुहोस्। आकार जोगाउन भित्र कागज कोच्नुहोस्। छिटो ताप नै छाला बटार्ने र फुटाउने कारण हो।",
          },
        ],
      },
      {
        heading: { en: "Feed it now and then", ne: "बेला-बेला पोषण दिनुहोस्" },
        body: [
          {
            en: "Every few weeks, a thin coat of leather conditioner or even a little natural oil keeps leather supple and water-resistant. A small amount, rubbed in and left overnight, is plenty.",
            ne: "केही हप्तामा एकपटक, leather conditioner वा अलिकति प्राकृतिक तेलको पातलो तह लगाउँदा छाला नरम र पानी-प्रतिरोधी रहन्छ। थोरै, मालिस गरेर रातभर छोड्दा पुग्छ।",
          },
        ],
      },
    ],
    ctaHref: "/shop/casual-shoes",
    ctaLabel: { en: "See KRISHOE shoes", ne: "KRISHOE का जुत्ता हेर्नुहोस्" },
  },
  {
    slug: "monsoon-footwear-nepal",
    title: {
      en: "The best footwear for Nepal's monsoon",
      ne: "नेपालको बर्खाका लागि उत्तम जुत्ता",
    },
    description: {
      en: "What to wear on wet, muddy streets in Nepal's monsoon — grippy, quick-drying footwear that keeps you steady and comfortable.",
      ne: "नेपालको बर्खामा ओसिलो, हिलो सडकमा के लगाउने — grip भएको, छिटो सुक्ने जुत्ता जसले स्थिर र आरामदायी राख्छ।",
    },
    summary: {
      en: "Grip, quick-dry and easy-clean — how to stay steady all monsoon.",
      ne: "Grip, छिटो सुक्ने, सजिलो सफा — बर्खाभरि स्थिर रहने तरिका।",
    },
    keywords: [
      "monsoon footwear Nepal",
      "rainy season shoes",
      "waterproof sandals Nepal",
      "best shoes for rain",
      "anti-slip footwear",
    ],
    published: "2026-08-29",
    updated: "2026-08-29",
    emoji: "🌧️",
    intro: {
      en: "For four months of the year, the right pair is the difference between a steady walk and a slip on a wet tile. Monsoon footwear has three jobs — grip, dry fast, and clean easily. Here is what to look for.",
      ne: "वर्षको चार महिना, ठीक जोडीले नै ओसिलो tile मा स्थिर हिँड्ने र चिप्लने बीचको फरक बनाउँछ। बर्खाको जुत्ताको तीन काम — grip, छिटो सुक्ने, सजिलो सफा। के हेर्ने, यहाँ छ।",
    },
    blocks: [
      {
        heading: { en: "Grip is everything", ne: "Grip नै सबथोक" },
        body: [
          {
            en: "A patterned rubber sole with deep grooves channels water away and holds a wet floor. Turn any pair over before buying — if the sole is flat and smooth, it will slide the first wet morning.",
            ne: "गहिरो grooves भएको pattern-rubber sole ले पानी बगाउँछ र ओसिलो भुइँ समात्छ। किन्नुअघि जोडी पल्टाएर हेर्नुहोस् — sole समथर र चिल्लो भए पहिलो ओसिलो बिहानै चिप्लन्छ।",
          },
        ],
      },
      {
        heading: { en: "Choose quick-drying materials", ne: "छिटो सुक्ने सामग्री छान्नुहोस्" },
        body: [
          {
            en: "For daily monsoon wear, rubber and synthetic straps beat fabric and thick padding — they shed water and dry by morning. Save the leather and cloth pairs for dry days.",
            ne: "दैनिक बर्खा प्रयोगका लागि, rubber र synthetic strap ले कपडा र बाक्लो padding लाई जित्छ — पानी झार्छ, बिहानसम्म सुक्छ। छाला र कपडाका जोडी सुख्खा दिनका लागि राख्नुहोस्।",
          },
        ],
      },
      {
        heading: { en: "Easy to clean matters", ne: "सजिलो सफा हुनु जरुरी" },
        body: [
          {
            en: "Mud is part of the season. A pair you can rinse under a tap and wipe dry gets worn again the same day — that convenience is what keeps a monsoon pair actually useful.",
            ne: "हिलो season कै भाग हो। धारामुनि पखालेर पुछ्न मिल्ने जोडी त्यही दिन फेरि लगाइन्छ — त्यो सजिलोपनले नै बर्खाको जोडीलाई साँच्चै उपयोगी राख्छ।",
          },
        ],
      },
    ],
    ctaHref: "/shop/ladies-sandals",
    ctaLabel: { en: "See grippy sandals", ne: "Grip भएका सयल हेर्नुहोस्" },
  },
  {
    slug: "sandals-vs-slippers",
    title: {
      en: "Sandals or slippers: which should you buy?",
      ne: "सयल कि चप्पल: कुन किन्ने?",
    },
    description: {
      en: "The real difference between sandals and slippers, and which suits your day — errands, office, home or travel — in Nepal.",
      ne: "सयल र चप्पलको वास्तविक फरक, अनि नेपालमा तपाईंको दिनलाई कुन सुहाउँछ — बजार, अफिस, घर वा यात्रा।",
    },
    summary: {
      en: "Support and hold vs. slip-on ease — pick by how your day actually goes.",
      ne: "Support र पकड बनाम slip-on सजिलो — दिन कस्तो हुन्छ त्यसैले छान्नुहोस्।",
    },
    keywords: [
      "sandals vs slippers",
      "difference sandal slipper",
      "which footwear to buy",
      "ladies sandals Nepal",
      "everyday slippers",
    ],
    published: "2026-08-29",
    updated: "2026-08-29",
    emoji: "🩴",
    intro: {
      en: "People use the words for each other, but they solve different problems. The choice is not about looks — it is about how much your feet move in a day. Here is how to decide.",
      ne: "मान्छे यी दुई शब्द एकअर्काको ठाउँमा प्रयोग गर्छन्, तर यिनले फरक समस्या समाधान गर्छन्। छनौट हेराइको होइन — दिनमा खुट्टा कति चल्छ त्यसको हो। कसरी छान्ने, यहाँ छ।",
    },
    blocks: [
      {
        heading: { en: "Sandals: hold and support", ne: "सयल: पकड र support" },
        body: [
          {
            en: "A sandal has a back strap or a strap over the foot, so it stays on when you walk fast, climb stairs or stand for hours. Choose sandals for errands, office, market days and travel — anywhere your feet keep moving.",
            ne: "सयलमा पछाडि strap वा खुट्टामाथि strap हुन्छ, त्यसैले छिटो हिँड्दा, भर्‍याङ चढ्दा वा घण्टौँ उभिँदा टिकिरहन्छ। बजार, अफिस, हाट र यात्रा — जहाँ खुट्टा चलिरहन्छ — त्यहाँ सयल छान्नुहोस्।",
          },
        ],
      },
      {
        heading: { en: "Slippers: slip-on ease", ne: "चप्पल: slip-on सजिलो" },
        body: [
          {
            en: "A slipper you step into and out of in a second — perfect for home, short trips to the shop, or the office desk. Less hold when you rush, but unbeatable for comfort and convenience close to home.",
            ne: "चप्पल एक सेकेन्डमा लगाइन्छ र फुकालिन्छ — घर, नजिकको पसल, वा अफिसको desk का लागि उत्तम। हतारमा पकड कम, तर घर वरिपरि आराम र सजिलोमा अतुलनीय।",
          },
        ],
      },
      {
        heading: { en: "Most people need one of each", ne: "धेरैलाई दुबै एक-एक चाहिन्छ" },
        body: [
          {
            en: "A sturdy sandal for the day out and a soft slipper for home covers almost every hour of the week. If you buy one pair, buy for the activity you do most.",
            ne: "बाहिरका लागि बलियो सयल र घरका लागि नरम चप्पल — हप्ताको लगभग हरेक घडी टारिन्छ। एउटा मात्र किन्ने भए, सबभन्दा बढी गर्ने कामका लागि किन्नुहोस्।",
          },
        ],
      },
    ],
    ctaHref: "/shop/ladies-sandals",
    ctaLabel: { en: "Browse sandals and slippers", ne: "सयल र चप्पल हेर्नुहोस्" },
  },
];

export function getGuide(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}
