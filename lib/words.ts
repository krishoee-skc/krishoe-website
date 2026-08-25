/**
 * The shop's own words, one per thing.
 *
 * Every screen here was translated by hand, one string at a time, which is the
 * right way to do it — and it is also how a shop ends up calling the same thing
 * three names. "जोडी" in the factory and "जुत्ता" in the bill; "साट्ने" on one
 * page and "फिर्ता" on the next, for two different things a customer must not
 * confuse; "उधारो" at the counter and "credit" in the ledger.
 *
 * A shopper does not notice a good translation. They notice an inconsistent
 * one, and it reads as carelessness — which is exactly what the owner meant by
 * asking for something that felt premium rather than machine-made. Machine
 * translation cannot fix this; a shop that has decided what it calls things
 * can.
 *
 * So this is the decision, in one place. Two rules govern it:
 *
 *   1. Translate what KRISHOE says. Never translate what the phone says —
 *      Save, Login, OK, Share, Install are the device's words, and a Nepali
 *      button where the reader expects the system's own sends them looking for
 *      a control that is not there.
 *
 *   2. One word per thing, forever. If a word here turns out to be wrong, it
 *      changes here and changes everywhere. That is the point of the file.
 *
 * Nothing is imported from here by force. Existing screens keep their strings;
 * this is what new work reaches for, and what settles an argument about which
 * word is right.
 */

export type Word = { en: string; ne: string };

/**
 * A whole sentence the app says, in both languages.
 *
 * Same shape as a Word, a different thing: a Word is what the shop calls
 * something and lives in this file; a Said is a sentence built at runtime —
 * "3 more sales and we can say", "your review already reached us" — and lives
 * wherever it is worked out. It travels in both halves because the code that
 * builds it (a server action, a forecast) cannot know which language the
 * reader chose; only the browser can.
 */
export type Said = { en: string; ne: string };

/** What the shop sells, and how it is counted. */
export const goods = {
  pair: { en: "pair", ne: "जोडी" },
  pairs: { en: "pairs", ne: "जोडी" },
  shoe: { en: "shoe", ne: "जुत्ता" },
  slipper: { en: "slipper", ne: "चप्पल" },
  sandal: { en: "sandal", ne: "सयडल" },
  size: { en: "size", ne: "साइज" },
  colour: { en: "colour", ne: "रङ" },
  design: { en: "design", ne: "design" },
  stock: { en: "stock", ne: "स्टक" },
  soldOut: { en: "sold out", ne: "सकियो" },
} satisfies Record<string, Word>;

/** Buying, and what happens after. */
export const trade = {
  order: { en: "order", ne: "अर्डर" },
  bill: { en: "bill", ne: "बिल" },
  price: { en: "price", ne: "मूल्य" },
  total: { en: "total", ne: "जम्मा" },
  discount: { en: "discount", ne: "छुट" },
  delivery: { en: "delivery", ne: "डेलिभरी" },
  payment: { en: "payment", ne: "भुक्तानी" },
  paid: { en: "paid", ne: "तिरेको" },
  /** Money still owed to the shop. Never "credit" in Nepali text. */
  credit: { en: "credit", ne: "उधारो" },
  instalment: { en: "instalment", ne: "किस्ता" },
  /** Cash on delivery, which is how almost every order here is paid. */
  cashOnDelivery: { en: "cash on delivery", ne: "सामान पाएपछि पैसा" },
  wholesale: { en: "wholesale", ne: "थोक" },
  retail: { en: "retail", ne: "खुद्रा" },
  customer: { en: "customer", ne: "ग्राहक" },
  /** A customer's running account, not a book. */
  account: { en: "account", ne: "खाता" },
} satisfies Record<string, Word>;

/**
 * Two different promises that must never be worded the same.
 *
 * An exchange sends another size and keeps the sale; a return sends the money
 * back. Calling both "फिर्ता" is how a shop ends up in an argument it cannot
 * win, because the customer read the word that suited them.
 */
export const afterSale = {
  exchange: { en: "exchange", ne: "साट्ने" },
  return: { en: "return", ne: "फिर्ता" },
  review: { en: "review", ne: "राय" },
  complaint: { en: "complaint", ne: "गुनासो" },
} satisfies Record<string, Word>;

/** The factory floor, in the words the factory already uses. */
export const factory = {
  factory: { en: "factory", ne: "कारखाना" },
  worker: { en: "worker", ne: "कामदार" },
  /** Piece wage — what a worker earns per pair, not a monthly salary. */
  pieceWage: { en: "piece wage", ne: "ज्याला" },
  /** Monthly salary — what staff are paid, not piece work. */
  salary: { en: "salary", ne: "तलब" },
  advance: { en: "advance", ne: "पेश्की" },
  addWork: { en: "add work", ne: "काम टिप्ने" },
  rate: { en: "rate", ne: "दर" },
  rawMaterial: { en: "raw material", ne: "कच्चा पदार्थ" },
  supplier: { en: "supplier", ne: "साहु" },
} satisfies Record<string, Word>;

/**
 * The device's words, kept in English on purpose.
 *
 * Listed so that the decision is written down rather than re-argued every time
 * somebody notices an English word on a Nepali screen. A Nepali "Save" where
 * the phone says Save sends the reader hunting for a button that is not there.
 */
export const deviceWords = [
  "Save",
  "Login",
  "Logout",
  "OK",
  "Cancel",
  "Share",
  "Install",
  "Download",
  "Email",
  "Password",
  "WhatsApp",
  "Viber",
  "QR",
] as const;

/** Everything above, in one object, for a screen that needs several. */
export const words = { ...goods, ...trade, ...afterSale, ...factory };

export type WordKey = keyof typeof words;
