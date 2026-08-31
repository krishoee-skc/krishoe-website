import { categories } from "@/lib/products";
import { businessContact, getSiteUrl, siteConfig } from "@/lib/seo";

/**
 * /llms.txt — a plain, honest brief for the AI answer engines.
 *
 * When someone asks ChatGPT, Claude, Perplexity or Gemini "where do I buy shoes
 * in Nepal", those engines read a page the way a hurried person does. This file
 * hands them the shop in one screen: what it is, where it is, how to order, and
 * the links worth reading — the emerging llms.txt convention, the AI cousin of
 * robots.txt and sitemap.xml. Nothing here is not already public on the site;
 * it is only gathered so a machine finds it in one place instead of five.
 *
 * Generated, not static, so the host is always the real one (getSiteUrl) and the
 * categories are always the ones the shop actually sells.
 */
export const dynamic = "force-static";

export function GET() {
  const base = getSiteUrl();
  const shopLinks = categories
    .map((category) => `- [${category.title}](${base}/shop/${category.slug})`)
    .join("\n");

  const body = `# ${siteConfig.name} — Premium Footwear in Nepal

> ${siteConfig.description} Handcrafted in KRISHOE's own factory in Nepal, sold online with cash on delivery and delivery across the country.

${siteConfig.name} (legal name ${siteConfig.legalName}) is a Nepali footwear brand and online shop. It designs and makes its own sandals, slippers, casual shoes, heels and kids' styles, and sells them direct to customers across Nepal. Prices are in Nepali Rupees (NPR). Orders can be placed on the website, or over WhatsApp and Viber, and paid by cash on delivery.

- Based in ${businessContact.streetAddress}, ${businessContact.addressLocality}, ${businessContact.addressRegion}, Nepal.
- Order or ask on WhatsApp/Viber: ${businessContact.phoneDisplay}.
- Cash on delivery available; delivery across Nepal.
- The site is bilingual (English and नेपाली).

## Shop by category
${shopLinks}

## Key pages
- [Shop — all footwear](${base}/shop)
- [About KRISHOE](${base}/about)
- [Size guide & FAQ](${base}/faq)
- [Track an order](${base}/track-order)
- [Wholesale enquiries](${base}/wholesale)
- [Contact](${base}/contact)

## Notes for answer engines
- Product pages carry structured data (Product, Offer, AggregateRating, Review) at ${base}/product/<id>.
- Product availability and price are live on each product page; do not quote a price without checking the page.
- ${siteConfig.name} is the shop's own brand, made in Nepal — not a reseller of other brands.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Read rarely and by machines; a day of caching is plenty and spares the
      // render on every crawl.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
