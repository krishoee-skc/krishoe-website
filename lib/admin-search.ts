/**
 * Finding anything in the shop by typing part of it.
 *
 * The admin search looked in five places — products, customers, suppliers, POS
 * bills, purchase bills — and the owner typed "ank" looking for their worker
 * ankus. Workers were never in the list, and neither were factory items or
 * customer orders, so the search reported nothing for a name the shop uses
 * every day. A search that can only find some of what exists teaches its user
 * to stop opening it.
 *
 * The matching lives here, apart from the screen that draws it, so the ranking
 * can be tested without a browser.
 *
 * Every stored name in this shop is written in Roman letters — all eight
 * workers, all ten factory items, all seven products, all five customers,
 * checked rather than assumed. So records match on what was typed, with no
 * transliteration. The page list is the exception: those labels are Nepali on
 * screen, so both scripts are searched there.
 */

export type AdminSearchKind =
  | "worker"
  | "factoryItem"
  | "product"
  | "customer"
  | "order"
  | "invoice"
  | "supplier"
  | "page";

export type AdminSearchRecord = {
  kind: AdminSearchKind;
  /** What the owner reads. */
  title: string;
  /** The line under it — a stage, a phone number, a total. */
  detail: string;
  href: string;
  /** Everything typed that should find this row. */
  terms: string[];
};

export type AdminSearchHit = AdminSearchRecord & { rank: number };

/** Trimmed, single-spaced, lowercased — the same shape used to match designs. */
export function searchKey(value: string) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * How well one term answers what was typed. Lower sorts first; -1 is no match.
 *
 * Three grades, because "ank" should reach ankus before it reaches a note that
 * happens to contain those letters mid-word:
 *   0  the term starts with it        — ankus for "ank"
 *   1  a word inside the term does    — "bag open" for "open"
 *   2  it appears anywhere at all     — "chappal" for "happ"
 */
function termRank(term: string, needle: string) {
  const haystack = searchKey(term);
  if (!haystack || !needle) return -1;
  if (haystack.startsWith(needle)) return 0;
  if (haystack.split(" ").some((word) => word.startsWith(needle))) return 1;
  return haystack.includes(needle) ? 2 : -1;
}

/**
 * Rank a record against every word typed.
 *
 * Every word has to match something, so "ankus upper" finds the worker only if
 * they are in Upper — otherwise typing more would widen the results instead of
 * narrowing them, which is the opposite of what anyone means by it.
 */
export function rankRecord(record: AdminSearchRecord, query: string): number {
  const words = searchKey(query).split(" ").filter(Boolean);
  if (words.length === 0) return -1;

  let total = 0;
  for (const word of words) {
    const best = record.terms.reduce((least, term) => {
      const rank = termRank(term, word);
      return rank < 0 ? least : Math.min(least, rank);
    }, Number.POSITIVE_INFINITY);

    if (!Number.isFinite(best)) return -1;
    total += best;
  }

  return total;
}

export function searchRecords(records: AdminSearchRecord[], query: string, limit = 40) {
  const hits: AdminSearchHit[] = [];

  for (const record of records) {
    const rank = rankRecord(record, query);
    if (rank >= 0) hits.push({ ...record, rank });
  }

  // Ties keep the order they were built in, which is the order the sections are
  // meant to read: people, then what they make, then what was sold.
  return hits.sort((left, right) => left.rank - right.rank).slice(0, limit);
}

/**
 * The screens themselves, searchable by name.
 *
 * Half of what anyone types into a search box is not a record at all — it is a
 * place. "stock", "काम टिप्ने", "salary". Without these the owner types a page
 * name, gets nothing, and goes back to hunting through the menu.
 *
 * Both scripts here, unlike the records: these labels are written in Nepali on
 * screen and in English in the code, and either is a fair thing to type.
 */
export const ADMIN_SEARCH_PAGES: AdminSearchRecord[] = [
  { kind: "page", title: "काम टिप्ने", detail: "कामदारको दैनिक काम र ज्याला", href: "/admin/factory/add-work", terms: ["काम टिप्ने", "add work", "factory entry", "kaam", "wage", "ज्याला"] },
  { kind: "page", title: "कामदार", detail: "नाम, चरण, ज्यालाको किसिम", href: "/admin/factory/workers", terms: ["कामदार", "workers", "worker", "staff", "kamdar"] },
  { kind: "page", title: "कामदारको खाता", detail: "कसले कति कमायो, कति पाए", href: "/admin/factory/ledger", terms: ["खाता", "ledger", "khata", "balance", "हिसाब"] },
  { kind: "page", title: "तलब", detail: "मासिक तलब र भुक्तानी", href: "/admin/factory/salary", terms: ["तलब", "salary", "talab", "pay"] },
  { kind: "page", title: "कारखानाका item", detail: "जुत्ताको सूची र दर", href: "/admin/factory/items", terms: ["item", "items", "कारखाना", "factory item", "rate", "दर"] },
  { kind: "page", title: "स्टक", detail: "कति माल छ, चढाउने", href: "/admin/operations", terms: ["स्टक", "stock", "operations", "maal", "माल"] },
  { kind: "page", title: "सामान", detail: "जुत्ता, मूल्य, फोटो", href: "/admin/products", terms: ["सामान", "products", "product", "saman", "जुत्ता", "मूल्य", "price"] },
  { kind: "page", title: "अर्डर", detail: "ग्राहकका अर्डर", href: "/admin/orders", terms: ["अर्डर", "orders", "order"] },
  { kind: "page", title: "बिल काट्ने", detail: "पसलमै बेचेको बिल", href: "/admin/pos", terms: ["बिल", "pos", "bill", "billing", "invoice"] },
  { kind: "page", title: "भुक्तानी", detail: "पैसा आयो कि आएन", href: "/admin/payments", terms: ["भुक्तानी", "payments", "payment", "paisa", "पैसा"] },
  { kind: "page", title: "किनमेल", detail: "कच्चा पदार्थ र साहु", href: "/admin/purchasing", terms: ["किनमेल", "purchasing", "purchase", "supplier", "साहु"] },
  { kind: "page", title: "ग्राहक", detail: "ग्राहक र उनीहरूको किनमेल", href: "/admin/customers", terms: ["ग्राहक", "customers", "customer", "grahak"] },
  { kind: "page", title: "हिसाब र नाफा", detail: "बिक्री, नाफा, ग्राहक", href: "/admin/analytics", terms: ["हिसाब", "analytics", "नाफा", "profit", "report"] },
  { kind: "page", title: "निगरानी", detail: "app ठीक छ कि छैन", href: "/admin/monitoring", terms: ["निगरानी", "monitoring", "health", "error"] },
  { kind: "page", title: "सेटिङ", detail: "पसलको नाम, ठेगाना, शाखा", href: "/admin/settings", terms: ["सेटिङ", "settings", "setting"] },
  { kind: "page", title: "कुन फोन/computer", detail: "कहाँबाट login भएको", href: "/admin/devices", terms: ["devices", "login", "passkey", "फोन"] },
  // Search is what makes moving a screen out of the menu safe rather than a
  // way to lose it. Eight of these were reachable only from the menu, so
  // taking them out of it without adding them here would have hidden them.
  { kind: "page", title: "ग्राहकको आवाज", detail: "राय, सोधपुछ, गुनासो — सबै एकै ठाउँ", href: "/admin/inbox", terms: ["राय", "review", "गुनासो", "feedback", "सोधपुछ", "message", "सन्देश", "inbox", "grahak", "customer voice"] },
  { kind: "page", title: "सुरु गर्ने", detail: "पहिलो पटक के-के मिलाउने", href: "/admin/getting-started", terms: ["सुरु", "getting started", "suru", "setup", "सेटअप", "help"] },
  { kind: "page", title: "मापन सेटअप", detail: "Meta Pixel, Google Analytics, TikTok", href: "/admin/measurement", terms: ["मापन", "measurement", "pixel", "analytics", "ga4", "tiktok", "meta", "मापन सेटअप", "tracking"] },
  { kind: "page", title: "फोनमा खोल्ने", detail: "app जसरी फोनमा राख्ने", href: "/admin/open-on-phone", terms: ["फोन", "phone", "mobile", "install", "app", "qr"] },
  { kind: "page", title: "सुरक्षा / CCTV", detail: "पसलको सुरक्षा", href: "/admin/security", terms: ["सुरक्षा", "security", "cctv", "camera", "surakshya"] },
  { kind: "page", title: "को ले के गर्‍यो", detail: "कसले कहिले के बदल्यो", href: "/admin/activity", terms: ["activity", "log", "इतिहास", "history", "audit", "kasle"] },
  { kind: "page", title: "सूचना", detail: "पठाइएका इमेल र notification", href: "/admin/notifications", terms: ["सूचना", "notification", "email", "इमेल", "push", "suchana"] },
  { kind: "page", title: "चेतावनी", detail: "ध्यान दिनुपर्ने कुरा", href: "/admin/alerts", terms: ["चेतावनी", "alert", "warning", "chetawani"] },
  { kind: "page", title: "मोबाइल सन्देश", detail: "SMS पठाउने", href: "/admin/sms", terms: ["sms", "मोबाइल सन्देश", "text", "message"] },
  // Named for what it shows, not "Customer Voice" — that name belongs to the
  // inbox now, and two screens sharing it is how the owner ended up opening
  // the wrong one.
  { kind: "page", title: "कुन जुत्ता राम्रो", detail: "राय र फिर्ता — कुन design सुधार्ने", href: "/admin/insights", terms: ["insight", "राय", "फिर्ता", "return", "design", "kun jutta", "सुधार", "rating"] },
];

/** What each kind is called on screen, and the mark beside it. */
export const ADMIN_SEARCH_LABELS: Record<AdminSearchKind, { icon: string; label: string }> = {
  worker: { icon: "👷", label: "कामदार" },
  factoryItem: { icon: "🏭", label: "कारखानाका item" },
  product: { icon: "👟", label: "सामान" },
  customer: { icon: "👥", label: "ग्राहक" },
  order: { icon: "📦", label: "अर्डर" },
  invoice: { icon: "🧾", label: "बिल" },
  supplier: { icon: "🚚", label: "साहु" },
  page: { icon: "📄", label: "पाना" },
};

/**
 * The Nepali and English words for a kind, so typing the category finds
 * everything in it.
 *
 * Every name this shop has stored is Roman — checked, all thirty of them — so
 * typing "अंकुस" cannot find "ankus" without transliterating, and Nepali
 * romanisation is ambiguous enough (स, श and ष all become s) that guessing
 * would return the wrong worker with confidence. What does work, and is what
 * the owner meant, is the category: "कामदार" should list the workers, "जुत्ता"
 * the shoes, "बिल" the bills.
 */
export const ADMIN_SEARCH_KIND_TERMS: Record<AdminSearchKind, string[]> = {
  worker: ["कामदार", "worker", "workers", "kamdar", "मान्छे", "staff"],
  factoryItem: ["item", "कारखाना", "factory", "डिजाइन", "design"],
  product: ["सामान", "जुत्ता", "product", "products", "shoe", "saman"],
  customer: ["ग्राहक", "customer", "grahak", "buyer"],
  order: ["अर्डर", "order", "orders"],
  invoice: ["बिल", "bill", "invoice", "पैसा"],
  supplier: ["साहु", "supplier", "sahu", "किनमेल", "purchase"],
  page: ["पाना", "page", "screen"],
};

/** A record with its category words folded in, so the kind is searchable too. */
export function withKindTerms(record: AdminSearchRecord): AdminSearchRecord {
  return { ...record, terms: [...record.terms, ...ADMIN_SEARCH_KIND_TERMS[record.kind]] };
}
