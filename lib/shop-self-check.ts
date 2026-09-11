import { queryPostgres } from "@/lib/postgres/client";
import { reportError } from "@/lib/report-error";

/**
 * The shop looking for its own faults, so the owner does not have to.
 *
 * Every problem in this file is one the owner found by hand, or that a hand
 * audit turned up, over the last three days:
 *
 *   180 pairs of stock in the catalogue that no movement stood behind
 *   two test designs left sitting in the shop's own product list
 *   a ★ 4.8 on every shoe when not one review was published for it
 *   17 factory items, none of them linked to a shoe a customer can buy
 *   a salaried worker written into the piece-wage summary
 *   a checkout asking for money with no bank account set
 *   reviews still pointing at shoes that were deleted
 *
 * Each was found by a person reading a screen and thinking "that cannot be
 * right". That is the part worth automating: not the fixing, the noticing.
 *
 * The rule every check here follows — count first, claim second. A check
 * reports only what it can count, names the number, and links to the screen
 * where it is fixed. None of them guesses, and none of them fires on an empty
 * shop, because "you have no stock" is not a fault in a shop that has not
 * opened yet.
 */

export type SelfCheckSeverity = "critical" | "warning" | "info";

export type SelfCheck = {
  id: string;
  severity: SelfCheckSeverity;
  title: string;
  titleNe: string;
  /** What was counted, in words — never a bare number. */
  detail: string;
  detailNe: string;
  /** Where to go and put it right. */
  href: string;
  action: string;
  actionNe: string;
  count: number;
};

type CountRow = { n: number };

async function count(sql: string): Promise<number> {
  const rows = await queryPostgres<CountRow>("self check", sql);
  return Number(rows[0]?.n ?? 0);
}

/**
 * Every check, run together, cheapest first.
 *
 * One failing check must not take the others down with it — a screen that says
 * nothing because one query broke is exactly the silence this exists to end.
 */
export async function runShopSelfCheck(): Promise<SelfCheck[]> {
  const found: SelfCheck[] = [];

  const checks: Array<() => Promise<SelfCheck | null>> = [
    // 1. Stock with nothing behind it. This is how 180 invented pairs came to
    //    sit in the catalogue: typed into a form, never made, never bought.
    async () => {
      const n = await count(`
        SELECT count(*)::int AS n FROM products p
        WHERE p.stock > 0
          AND NOT EXISTS (
            SELECT 1 FROM finished_stock f WHERE lower(f.design) = lower(p.name)
          )`);
      if (n === 0) return null;
      return {
        id: "unbacked-stock",
        severity: "critical",
        title: `${n} shoes show stock nothing was made or bought for`,
        titleNe: `${n} जुत्तामा आधार नभएको स्टक देखिन्छ`,
        detail:
          "The shop would sell a pair it cannot send. Every pair should arrive through Operations, where a record follows it.",
        detailNe:
          "नभएको जुत्ता बिक्री हुन सक्छ। हरेक जोर Operations बाट आउनुपर्छ, जहाँ रेकर्ड रहन्छ।",
        href: "/admin/products",
        action: "Check the catalogue",
        actionNe: "क्याटलग हेर्ने",
        count: n,
      };
    },

    // 2. Test designs. The live stock tests used to leave their probe products
    //    behind; they clean up now, but a leftover would still be here.
    async () => {
      const n = await count(`
        SELECT count(*)::int AS n FROM products
        WHERE name ILIKE 'ZZ %' OR name ILIKE 'ZZ_%'`);
      if (n === 0) return null;
      return {
        id: "test-residue",
        severity: "warning",
        title: `${n} test products are in the shop's catalogue`,
        titleNe: `${n} वटा test सामान पसलको क्याटलगमा छन्`,
        detail: "Left behind by a test. They are not real shoes and should be removed.",
        detailNe: "Test ले छोडेको हो। यी साँचो जुत्ता होइनन्, हटाउनुपर्छ।",
        href: "/admin/products",
        action: "Remove them",
        actionNe: "हटाउने",
        count: n,
      };
    },

    // 3. A star with nothing behind it. The shop decided months ago never to
    //    show invented praise; the product page kept one line that did.
    async () => {
      const n = await count(`
        SELECT count(*)::int AS n FROM products p
        WHERE p.status = 'Active'
          AND COALESCE(p.rating, '0') NOT IN ('0', '')
          AND NOT EXISTS (
            SELECT 1 FROM customer_voice v
            WHERE v.product_id = p.id AND v.kind = 'review' AND v.published = true
          )`);
      if (n === 0) return null;
      return {
        id: "rating-without-reviews",
        severity: "warning",
        title: `${n} shoes show a star rating with no published review`,
        titleNe: `${n} जुत्तामा राय नभई तारा देखिन्छ`,
        detail:
          "A shopper reads that as other customers' opinion. Nobody has given it yet.",
        detailNe:
          "ग्राहकले त्यो अरूको राय ठान्छन्। तर अहिलेसम्म कसैले दिएकै छैन।",
        href: "/admin/inbox",
        action: "See the reviews",
        actionNe: "राय हेर्ने",
        count: n,
      };
    },

    // 4. Reviews for a shoe that no longer exists — written by a real customer
    //    and now visible to nobody.
    async () => {
      const n = await count(`
        SELECT count(*)::int AS n FROM customer_voice v
        WHERE v.kind = 'review' AND v.published = true AND v.product_id <> ''
          AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = v.product_id)`);
      if (n === 0) return null;
      return {
        id: "orphan-reviews",
        severity: "info",
        title: `${n} published reviews are for a shoe that was removed`,
        titleNe: `${n} प्रकाशित राय हटाइएको जुत्ताका हुन्`,
        detail:
          "A real customer wrote them and nobody can see them. Move them to the shoe that replaced it, or leave them as a record.",
        detailNe:
          "साँचो ग्राहकले लेखेका, तर कसैले देख्न पाउँदैनन्। नयाँ जुत्तामा सार्न सकिन्छ।",
        href: "/admin/inbox",
        action: "Open the inbox",
        actionNe: "Inbox खोल्ने",
        count: n,
      };
    },

    // 5. The factory's shoes not joined to the shop's. Until this is done, a
    //    finished pair cannot reach the shop by itself — and it is hand-typed
    //    stock that put the invented pairs in the catalogue.
    async () => {
      const n = await count(`
        SELECT count(*)::int AS n FROM production_items
        WHERE status = 'Active' AND catalog_product_id IS NULL`);
      if (n === 0) return null;
      return {
        id: "production-not-linked",
        severity: "warning",
        title: `${n} factory items are not linked to a shoe in the shop`,
        titleNe: `${n} कारखानाका सामान पसलको जुत्तासँग जोडिएका छैनन्`,
        detail:
          "A finished pair will not reach the shop on its own; the count has to be typed in, which is how wrong counts start.",
        detailNe:
          "बनेको जुत्ता आफैं पसलमा पुग्दैन; हातले हाल्नुपर्छ, अनि गलत संख्या त्यहीँबाट सुरु हुन्छ।",
        href: "/admin/operations/production-accounts/lots",
        action: "Link them",
        actionNe: "जोड्ने",
        count: n,
      };
    },

    // 6. A salaried worker in the piece-wage summary reads as owing the shop a
    //    month's pay. Fixed in the code; this watches that it stays fixed.
    async () => {
      const n = await count(`
        SELECT count(*)::int AS n FROM factory_monthly_summary s
        JOIN factory_workers w ON w.id = s.worker_id
        WHERE w.worker_type <> 'piece_rate'`);
      if (n === 0) return null;
      return {
        id: "staff-in-piece-summary",
        severity: "critical",
        title: `${n} salaried staff appear in the piece-wage summary`,
        titleNe: `${n} मासिक तलब पाउने piece-wage हिसाबमा परेका छन्`,
        detail:
          "That summary counts pairs and piece wages, so a salaried person reads as owing the shop a month's pay.",
        detailNe:
          "त्यो हिसाबले जोर र piece ज्याला गन्छ, त्यसैले तलब पाउने मान्छे पसललाई तिर्न बाँकी जस्तो देखिन्छ।",
        href: "/admin/factory/reports",
        action: "Open the payroll",
        actionNe: "Payroll हेर्ने",
        count: n,
      };
    },

    // 7. Checkout offering a bank transfer with no account to transfer to.
    //    Only a fault once there is something to sell.
    async () => {
      const sellable = await count(
        `SELECT count(*)::int AS n FROM products WHERE status = 'Active' AND stock > 0`,
      );
      if (sellable === 0) return null;

      const set = await count(`
        SELECT count(*)::int AS n FROM company_settings
        WHERE id = 'default' AND COALESCE(bank_account_number, '') <> ''`);
      if (set > 0) return null;

      return {
        id: "no-bank-account",
        severity: "critical",
        title: "Checkout has no bank account to pay into",
        titleNe: "Checkout मा पैसा पठाउने bank खाता छैन",
        detail:
          "Customers can order with cash on delivery, but nobody can pay by transfer or QR.",
        detailNe:
          "ग्राहकले सामान बुझेर तिर्न सक्छन्, तर bank वा QR बाट तिर्न सक्दैनन्।",
        href: "/admin/settings",
        action: "Add the account",
        actionNe: "खाता हाल्ने",
        count: 1,
      };
    },
  ];

  for (const check of checks) {
    try {
      const result = await check();
      if (result) found.push(result);
    } catch (error) {
      // One broken query must not silence the rest.
      reportError("shop self check", error);
    }
  }

  const order: Record<SelfCheckSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return found.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
}
