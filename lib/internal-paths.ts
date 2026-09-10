/**
 * The parts of the site that are the shop's own staff, not its customers.
 *
 * Kept in a module of its own because both a server and a browser need it, and
 * where it used to live — lib/google-analytics — signs a JWT with node:crypto.
 * Importing one constant from there pulled the whole module into the browser
 * bundle and the build stopped: "Reading from node:crypto is not handled".
 *
 * Anything under these paths is left out of the visitor counts and out of the
 * speed measurements. Admin is used from a desk on wifi, and counting it would
 * drag every average towards a speed no customer ever sees.
 */
export const INTERNAL_PATH_PREFIXES = ["/admin", "/worker"] as const;

/**
 * The name a shopkeeper would use for a page, given its address.
 *
 * The speed report printed the raw path, so the busiest page in the shop
 * appeared as "/" — a single character that names nothing. The owner asked
 * which page that was, which is the question a report should never leave you
 * with.
 *
 * Unknown paths keep their address rather than being forced into a label: an
 * honest "/guides/shoe-size-guide-nepal" tells you more than a guess.
 */
const PAGE_NAMES: Record<string, { en: string; ne: string }> = {
  "/": { en: "Home page", ne: "गृह पृष्ठ" },
  "/shop": { en: "Shop", ne: "पसल" },
  "/cart": { en: "Cart", ne: "बटुवा" },
  "/checkout": { en: "Checkout", ne: "भुक्तानी" },
  "/review": { en: "Leave a review", ne: "राय दिने" },
  "/track-order": { en: "Track order", ne: "अर्डर ट्र्याक" },
  "/about": { en: "Our story", ne: "हाम्रो कथा" },
  "/contact": { en: "Contact", ne: "सम्पर्क" },
  "/faq": { en: "FAQ", ne: "प्रश्न उत्तर" },
  "/wholesale": { en: "Wholesale", ne: "थोक बिक्री" },
  "/wishlist": { en: "Wishlist", ne: "मन परेको" },
  "/guides": { en: "Guides", ne: "जानकारी" },
  "/enter": { en: "Staff entrance", ne: "स्टाफ ढोका" },
  "/account": { en: "My account", ne: "मेरो खाता" },
  "/offline": { en: "Offline page", ne: "अफलाइन पाना" },
};

export function pageName(path: string): { en: string; ne: string } | null {
  const exact = PAGE_NAMES[path];
  if (exact) return exact;

  // A shoe's own page, a category, a guide: the address carries the detail, so
  // the label only says which kind of page it is.
  if (path.startsWith("/product/")) return { en: "A shoe's page", ne: "जुत्ताको पाना" };
  if (path.startsWith("/shop/")) return { en: "A category", ne: "एउटा वर्ग" };
  if (path.startsWith("/guides/")) return { en: "A guide", ne: "एउटा जानकारी" };
  if (path.startsWith("/order/")) return { en: "An order", ne: "एउटा अर्डर" };

  return null;
}
