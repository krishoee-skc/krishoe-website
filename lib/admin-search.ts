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
  /**
   * The same two in English, for the rows that are ours to translate.
   *
   * Only the page entries carry these. A worker's name and a customer's
   * phone number are data, not language — "ankus" is "ankus" on both sides,
   * and inventing an English half for it would be inventing a second name.
   */
  titleEn?: string;
  detailEn?: string;
  href: string;
  /** Everything typed that should find this row. */
  terms: string[];
  /** Pages only: which part of the shop the page belongs to, for the list
   *  shown before anything is typed. */
  group?: AdminSearchGroup;
};

/**
 * The four parts of the shop the page list is shown in, before anything is
 * typed. It was one list of twenty-six pages, each marked "Pages".
 */
export type AdminSearchGroup = "factory" | "shop" | "money" | "settings";

export const ADMIN_SEARCH_GROUPS: { id: AdminSearchGroup; icon: string; label: string; labelEn: string }[] = [
  { id: "factory", icon: "🏭", label: "कारखाना", labelEn: "Factory" },
  { id: "shop", icon: "🛒", label: "पसल", labelEn: "Shop" },
  { id: "money", icon: "💰", label: "पैसा र हिसाब", labelEn: "Money and accounts" },
  { id: "settings", icon: "⚙️", label: "सेटिङ र सुरक्षा", labelEn: "Settings and safety" },
];

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
  { kind: "page", title: "काम टिप्ने", titleEn: "Add work", detail: "कामदारको दैनिक काम र ज्याला", detailEn: "A worker's day and what it earned", href: "/admin/factory/add-work", terms: ["काम टिप्ने", "add work", "factory entry", "kaam", "wage", "ज्याला"], group: "factory" },
  { kind: "page", title: "कामदारको फोटो", titleEn: "Workers' photos", detail: "कामदारले पठाएको फोटो र कुरा जाँच्ने", detailEn: "Check the photos and questions workers send", href: "/admin/factory/photos", terms: ["फोटो", "photo", "photos", "कामदारको फोटो", "worker photo", "request", "पेस्की"], group: "factory" },
  { kind: "page", title: "कामदार", titleEn: "Workers", detail: "नाम, चरण, ज्यालाको किसिम", detailEn: "Name, stage, how they are paid", href: "/admin/factory/workers", terms: ["कामदार", "workers", "worker", "staff", "kamdar"], group: "factory" },
  { kind: "page", title: "कामदारको खाता", titleEn: "Worker ledger", detail: "कसले कति कमायो, कति पाए", detailEn: "Who earned what, and what they were paid", href: "/admin/factory/ledger", terms: ["खाता", "ledger", "khata", "balance", "हिसाब", "कामदार"], group: "factory" },
  { kind: "page", title: "तलब", titleEn: "Salary", detail: "मासिक तलब र भुक्तानी", detailEn: "Monthly salary and payment", href: "/admin/factory/salary", terms: ["तलब", "salary", "talab", "pay"], group: "factory" },
  { kind: "page", title: "कारखानाका item", titleEn: "Factory items", detail: "जुत्ताको सूची र दर", detailEn: "The list of shoes and their rates", href: "/admin/factory/items", terms: ["item", "items", "कारखाना", "factory item", "rate", "दर"], group: "factory" },
  { kind: "page", title: "कति माल छ", titleEn: "Stock", detail: "कति माल छ, कहाँ छ", detailEn: "How much there is, and where", href: "/admin/stock", terms: ["स्टक", "stock", "maal", "माल", "kati maal"], group: "shop" },
  { kind: "page", title: "उत्पादन र स्टक", titleEn: "Operations", detail: "यो हप्ता बनेको, आज स्टकमा चढेको", detailEn: "Made this week, into stock today", href: "/admin/operations", terms: ["operations", "उत्पादन", "utpadan", "stock flow"], group: "factory" },
  { kind: "page", title: "सामान", titleEn: "Products", detail: "जुत्ता, मूल्य, फोटो", detailEn: "Shoes, prices, photographs", href: "/admin/products", terms: ["सामान", "products", "product", "saman", "जुत्ता", "मूल्य", "price"], group: "shop" },
  { kind: "page", title: "अर्डर", titleEn: "Orders", detail: "ग्राहकका अर्डर", detailEn: "Customer orders", href: "/admin/orders", terms: ["अर्डर", "orders", "order"], group: "shop" },
  { kind: "page", title: "बिल काट्ने", titleEn: "POS billing", detail: "पसलमै बेचेको बिल", detailEn: "Billing a sale made at the counter", href: "/admin/pos", terms: ["बिल", "pos", "bill", "billing", "invoice"], group: "shop" },
  { kind: "page", title: "चेक खाता", titleEn: "Cheques", detail: "लिएको र दिएको चेक, बैंक र मिति", detailEn: "Cheques taken and given, bank and date", href: "/admin/cheques", terms: ["चेक", "cheque", "check", "chek", "bank", "बैंक", "bounce"], group: "money" },
  { kind: "page", title: "भुक्तानी", titleEn: "Payments", detail: "पैसा आयो कि आएन", detailEn: "Whether the money arrived", href: "/admin/payments", terms: ["भुक्तानी", "payments", "payment", "paisa", "पैसा"], group: "money" },
  { kind: "page", title: "किनमेल", titleEn: "Purchasing", detail: "कच्चा पदार्थ र साहु", detailEn: "Raw materials and suppliers", href: "/admin/purchasing", terms: ["किनमेल", "purchasing", "purchase", "supplier", "साहु"], group: "money" },
  { kind: "page", title: "ग्राहक", titleEn: "Customers", detail: "ग्राहक र उनीहरूको किनमेल", detailEn: "Customers and what they bought", href: "/admin/customers", terms: ["ग्राहक", "customers", "customer", "grahak"], group: "shop" },
  { kind: "page", title: "हिसाब र नाफा", titleEn: "Reports and profit", detail: "बिक्री, नाफा, ग्राहक", detailEn: "Sales, profit, customers", href: "/admin/analytics", terms: ["हिसाब", "analytics", "नाफा", "profit", "report"], group: "money" },
  { kind: "page", title: "निगरानी", titleEn: "Monitoring", detail: "app ठीक छ कि छैन", detailEn: "Whether the app is well", href: "/admin/monitoring", terms: ["निगरानी", "monitoring", "health", "error"], group: "settings" },
  { kind: "page", title: "सेटिङ", titleEn: "Settings", detail: "पसलको नाम, ठेगाना, शाखा", detailEn: "Shop name, address, branches", href: "/admin/settings", terms: ["सेटिङ", "settings", "setting"], group: "settings" },
  { kind: "page", title: "कुन फोन/computer", titleEn: "Login devices", detail: "कहाँबाट login भएको", detailEn: "Where a sign-in came from", href: "/admin/devices", terms: ["devices", "login", "passkey", "फोन"], group: "settings" },
  // Search is what makes moving a screen out of the menu safe rather than a
  // way to lose it. Eight of these were reachable only from the menu, so
  // taking them out of it without adding them here would have hidden them.
  { kind: "page", title: "ग्राहकको आवाज", titleEn: "Customer voice", detail: "राय, सोधपुछ, गुनासो — सबै एकै ठाउँ", detailEn: "Reviews, questions, complaints — all in one place", href: "/admin/inbox", terms: ["राय", "review", "गुनासो", "feedback", "सोधपुछ", "message", "सन्देश", "inbox", "grahak", "customer voice"], group: "shop" },
  { kind: "page", title: "सुरु गर्ने", titleEn: "Getting started", detail: "पहिलो पटक के-के मिलाउने", detailEn: "What to set up the first time", href: "/admin/getting-started", terms: ["सुरु", "getting started", "suru", "setup", "सेटअप", "help"], group: "settings" },
  { kind: "page", title: "मापन सेटअप", titleEn: "Measurement setup", detail: "Meta Pixel, Google Analytics, TikTok", detailEn: "Meta Pixel, Google Analytics, TikTok", href: "/admin/measurement", terms: ["मापन", "measurement", "pixel", "analytics", "ga4", "tiktok", "meta", "मापन सेटअप", "tracking"], group: "settings" },
  { kind: "page", title: "सुरक्षा केन्द्र", titleEn: "Security Center", detail: "सबै सुरक्षा पेज एउटै ठाउँ", detailEn: "Every safety page in one place", href: "/admin/security-overview", terms: ["सुरक्षा केन्द्र", "security center", "safety", "surakshya kendra", "overview"], group: "settings" },
  { kind: "page", title: "सुरक्षा / CCTV", titleEn: "Security / CCTV", detail: "पसलको सुरक्षा", detailEn: "Keeping the shop safe", href: "/admin/security", terms: ["सुरक्षा", "security", "cctv", "camera", "surakshya"], group: "settings" },
  { kind: "page", title: "को ले के गर्‍यो", titleEn: "Activity", detail: "कसले कहिले के बदल्यो", detailEn: "Who changed what, and when", href: "/admin/activity", terms: ["activity", "log", "इतिहास", "history", "audit", "kasle"], group: "settings" },
  { kind: "page", title: "सूचना", titleEn: "Notifications", detail: "पठाइएका इमेल र notification", detailEn: "Emails and notifications sent", href: "/admin/notifications", terms: ["सूचना", "notification", "email", "इमेल", "push", "suchana"], group: "settings" },
  { kind: "page", title: "चेतावनी", titleEn: "Alerts", detail: "ध्यान दिनुपर्ने कुरा", detailEn: "Things that need looking at", href: "/admin/alerts", terms: ["चेतावनी", "alert", "warning", "chetawani"], group: "settings" },
  { kind: "page", title: "मोबाइल सन्देश", titleEn: "SMS", detail: "SMS पठाउने", detailEn: "Sending an SMS", href: "/admin/sms", terms: ["sms", "मोबाइल सन्देश", "text", "message"], group: "settings" },
  // Named for what it shows, not "Customer Voice" — that name belongs to the
  // inbox now, and two screens sharing it is how the owner ended up opening
  // the wrong one.
  { kind: "page", title: "कुन जुत्ता राम्रो", titleEn: "Which shoes do well", detail: "राय र फिर्ता — कुन design सुधार्ने", detailEn: "Reviews and returns — which design to improve", href: "/admin/insights", terms: ["insight", "राय", "फिर्ता", "return", "design", "kun jutta", "सुधार", "rating"], group: "shop" },
  // In the menu but not in search, found on 2026-09-28: a page the menu can
  // reach and search cannot is a page the owner types and gives up on.
  { kind: "page", title: "कारखाना आज", titleEn: "Factory today", detail: "आजको काम एकै ठाउँ", detailEn: "Today's work in one place", href: "/admin/factory", terms: ["कारखाना आज", "factory today", "karkhana", "आज"], group: "factory" },
  { kind: "page", title: "माल चढाउने", titleEn: "Post to stock", detail: "बनेको जोडी स्टकमा", detailEn: "Finished pairs into stock", href: "/admin/factory/add-work", terms: ["माल चढाउने", "post to stock", "maal chadaune", "chadaune", "स्टकमा"], group: "factory" },
  { kind: "page", title: "ज्याला र खर्च", titleEn: "Wages & kharcha", detail: "यो हप्ता, शनिबारको भुक्तानी", detailEn: "This week, Saturday's payment", href: "/admin/operations/production-accounts", terms: ["ज्याला", "wages", "kharcha", "खर्च", "jyala", "हप्ता"], group: "factory" },
  { kind: "page", title: "ज्याला दर", titleEn: "Wage rates", detail: "जुत्ता र काम अनुसार दर", detailEn: "Rates by shoe and work", href: "/admin/operations/production-accounts/rates", terms: ["दर", "wage rate", "rates", "dar"], group: "factory" },
  { kind: "page", title: "एक जोडीको लागत", titleEn: "Cost of a pair", detail: "लागत र बेच्ने दर", detailEn: "Cost and selling rate", href: "/admin/operations/production-accounts/lots", terms: ["लागत", "cost of a pair", "cost", "lagat", "मूल्य"], group: "factory" },
  { kind: "page", title: "कामदार QR", titleEn: "Worker QR", detail: "कामदारको फोनमा खोल्ने", detailEn: "Open on a worker's phone", href: "/admin/factory/worker-portal-qr", terms: ["qr", "worker qr", "पोस्टर"], group: "factory" },
  { kind: "page", title: "थोक", titleEn: "Wholesale", detail: "थोकको सोधपुछ", detailEn: "Wholesale enquiries", href: "/admin/wholesale", terms: ["थोक", "wholesale", "thok", "होलसेल"], group: "shop" },
  { kind: "page", title: "छुटको कोड", titleEn: "Discount codes", detail: "छुट दिने कोड", detailEn: "Codes that give a discount", href: "/admin/coupons", terms: ["छुट", "discount", "coupon", "chhut", "code"], group: "shop" },
  { kind: "page", title: "उधारो", titleEn: "Credit / Dues", detail: "कसको कति बाँकी", detailEn: "Who owes what", href: "/admin/dues", terms: ["उधारो", "credit", "dues", "udharo", "बाँकी", "baki"], group: "money" },
  { kind: "page", title: "लागत र नाफा", titleEn: "Costing", detail: "सामानको लागत र नाफा", detailEn: "What things cost and earn", href: "/admin/costing", terms: ["costing", "लागत", "नाफा", "lagat"], group: "money" },
  { kind: "page", title: "रिपोर्ट", titleEn: "Report", detail: "सबै रिपोर्ट एकै ठाउँ", detailEn: "Every report in one place", href: "/admin/reports", terms: ["रिपोर्ट", "report", "reports", "हिसाब"], group: "money" },
  { kind: "page", title: "मुख्य पाना", titleEn: "Dashboard", detail: "आजको पसल एक नजरमा", detailEn: "The shop today at a glance", href: "/admin", terms: ["dashboard", "मुख्य", "home", "गृह"], group: "settings" },
];

/** What each kind is called on screen, and the mark beside it. */
export const ADMIN_SEARCH_LABELS: Record<
  AdminSearchKind,
  { icon: string; label: string; labelEn: string }
> = {
  worker: { icon: "👷", label: "कामदार", labelEn: "Workers" },
  factoryItem: { icon: "🏭", label: "कारखानाका item", labelEn: "Factory items" },
  product: { icon: "👟", label: "सामान", labelEn: "Products" },
  customer: { icon: "👥", label: "ग्राहक", labelEn: "Customers" },
  order: { icon: "📦", label: "अर्डर", labelEn: "Orders" },
  invoice: { icon: "🧾", label: "बिल", labelEn: "Bills" },
  supplier: { icon: "🚚", label: "साहु", labelEn: "Suppliers" },
  page: { icon: "📄", label: "पाना", labelEn: "Pages" },
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
