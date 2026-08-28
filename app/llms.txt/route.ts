import { categories } from "@/lib/products";
import { businessContact, getSiteUrl, siteConfig } from "@/lib/seo";

// /llms.txt — the shop, described for the engines that answer instead of search.
//
// robots.txt tells a crawler which doors are open; this tells an AI model what
// is behind them, in the plain markdown the llms.txt convention asks for. When
// ChatGPT, Claude, Perplexity or Gemini is asked "where do I buy sandals in
// Bharatpur", this is the page that lets it answer with KRISHOE, correctly.
//
// Every line here is a fact already public on the site — the same discipline as
// lib/ai/product-copy.ts: nothing about a supplier, a cost, or a customer. It is
// generated, not hand-written, so the host, the category list and the contact
// details cannot drift from the rest of the site the day one of them changes.

// Built once at deploy from static site facts, so it is served from the edge
// like any other file rather than rendered per request.
export const dynamic = "force-static";

export async function GET() {
  const site = getSiteUrl();

  const shopLines = categories
    .map(
      (category) =>
        `- [${category.title}](${site}/shop/${category.slug}): ${category.description}`,
    )
    .join("\n");

  const body = `# KRISHOE

> ${siteConfig.description} KRISHOE (${siteConfig.legalName}) is a footwear factory and shop in Narayangadh, Bharatpur, Chitwan, Nepal, making and selling its own sandals, slippers, casual shoes, heels, and kids footwear.

KRISHOE designs and manufactures its footwear in its own factory in Nepal and
sells it online and from its Bharatpur shop. Prices are in Nepali Rupees (NPR).
Orders are placed on the website or over WhatsApp and Viber, with cash on
delivery and in-person payment; delivery is across Nepal. The catalogue and
prices on the website are the source of truth.

## Shop by category
${shopLines}

## Pages
- [Shop — all footwear](${site}/shop): the full catalogue, filterable by category
- [About KRISHOE](${site}/about): the factory, the brand, and how the shoes are made
- [Frequently asked questions](${site}/faq): sizing, orders, payment, and delivery
- [Wholesale / bulk orders](${site}/wholesale): buying pairs in quantity for resale
- [Track an order](${site}/track-order): check the status of a placed order
- [Return policy](${site}/return-policy): how returns and exchanges work
- [Contact](${site}/contact): reach the shop directly

## Contact
- Shop phone: ${businessContact.phoneDisplay}
- WhatsApp / Viber orders: ${businessContact.whatsappDisplay}
- Email: ${businessContact.email}
- Address: ${businessContact.streetAddress}, ${businessContact.addressLocality}, ${businessContact.addressRegion}, Nepal ${businessContact.postalCode}
- Opening hours: ${businessContact.openingHours}
- Facebook: ${businessContact.facebook}
- Instagram: ${businessContact.instagram}
- TikTok: ${businessContact.tiktok}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
