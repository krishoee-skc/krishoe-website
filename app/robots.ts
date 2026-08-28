import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

// The one robots.txt for the shop.
//
// It lives here, in app/, and NOT as a static public/robots.txt. App Router
// serves this generated file; a second static one in public/ would shadow it
// with a hard-coded host, which is the very thing getSiteUrl() exists to avoid.
// There is exactly one source now.

// Pages with no reason to be in a search result, and every reason not to be:
// the admin, the API, the worker and customer areas, a single customer's order,
// and the three cart/checkout steps that only make sense mid-purchase. Blocking
// them keeps private URLs out of the index without hiding a single product.
//
// /_next/ is deliberately NOT blocked: Google renders a page with its own CSS
// and JavaScript before judging it, and a shop that hides those assets is
// judged on a broken render. The old static file blocked them, from an era
// when crawlers did not run scripts.
const disallow = [
  "/admin/",
  "/api/",
  "/worker/",
  "/account/",
  "/customer/dashboard",
  "/order/",
  "/cart/",
  "/checkout/",
  "/wishlist/",
];

// The crawlers behind the AI answers people now ask instead of searching —
// ChatGPT, Claude, Perplexity, Gemini, Apple, Meta — plus Common Crawl, which
// feeds many of them. A bare "User-agent: *" already permits every one of these;
// naming them is a plain, public statement that KRISHOE wants to be readable by
// the engines that summarise the web, and a few only follow rules addressed to
// them by name. Each gets exactly what "*" gets — nothing hidden, nothing extra.
const aiCrawlers = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...aiCrawlers.map((userAgent) => ({ userAgent, allow: "/", disallow })),
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
    host: getSiteUrl(),
  };
}
