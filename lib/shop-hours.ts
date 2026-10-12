/**
 * When the shop is open — written once (owner, 2026-10-13: 8 to 6, closed on
 * Monday). Checkout, the contact page and what search engines read all said
 * something different: checkout 8–6 closed Monday, the other two 10–7 Monday
 * to Saturday. A customer who came by on a Sunday on Google's word would have
 * found the shop open; one who came on a Monday, shut.
 */
export const shopHours = {
  /** schema.org openingHours: every day but Monday, 08:00–18:00. */
  schema: "Su,Tu-Sa 08:00-18:00",
  en: "8 AM – 6 PM. Closed every Monday.",
  ne: "बिहान ८ बजे – साँझ ६ बजे। हरेक सोमबार बन्द।",
} as const;
