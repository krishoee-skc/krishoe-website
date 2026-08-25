import { absoluteUrl } from "@/lib/seo";

/**
 * Links that say where a shopper came from.
 *
 * Google groups Facebook, Instagram and TikTok into one bucket it calls Organic
 * Social, so the report can say "twenty-one from social" and never which of the
 * three. That is the difference between knowing an advert worked and knowing
 * WHICH advert worked — and for a shop deciding where to spend its next hour,
 * only the second one is useful.
 *
 * A `utm_source` on the link is the whole fix. The shopper never sees it; the
 * analytics does. It has to be added when the post is written, though, because
 * nothing can recover it afterwards — which is why this exists as a screen the
 * owner opens before posting rather than as advice in a document.
 */
export type CampaignPlace = {
  id: string;
  ne: string;
  en: string;
  path: string;
};

export type CampaignSource = {
  id: string;
  ne: string;
  en: string;
  /** What Google will call it once the tagged link is used. */
  showsAsNe: string;
  showsAsEn: string;
};

/** Where the link should land. Deep pages convert better than the front door. */
export const campaignPlaces: CampaignPlace[] = [
  { id: "shop", ne: "पसल — सबै जुत्ता", en: "Shop — all shoes", path: "/shop" },
  { id: "home", ne: "मुख्य पाना", en: "Home page", path: "/" },
  { id: "wholesale", ne: "थोक बिक्री", en: "Wholesale", path: "/wholesale" },
  { id: "ladies", ne: "महिलाको सयडल", en: "Ladies sandals", path: "/shop/ladies-sandals" },
  { id: "kids", ne: "बच्चाको", en: "Kids", path: "/shop/kids-collection" },
];

/**
 * Where the link is going to be posted.
 *
 * `utm_source` is a plain lowercase word by convention, and the convention
 * matters: Google matches these as strings, so "Facebook" and "facebook" would
 * arrive as two different sources and split one campaign in half.
 */
export const campaignSources: CampaignSource[] = [
  {
    id: "facebook",
    ne: "Facebook",
    en: "Facebook",
    showsAsNe: "Facebook छुट्टै लाइनमा",
    showsAsEn: "Facebook, on its own line",
  },
  {
    id: "instagram",
    ne: "Instagram",
    en: "Instagram",
    showsAsNe: "Instagram छुट्टै लाइनमा",
    showsAsEn: "Instagram, on its own line",
  },
  {
    id: "tiktok",
    ne: "TikTok",
    en: "TikTok",
    showsAsNe: "TikTok छुट्टै लाइनमा",
    showsAsEn: "TikTok, on its own line",
  },
  {
    id: "whatsapp",
    ne: "WhatsApp मा पठाउने",
    en: "Sent on WhatsApp",
    showsAsNe: "WhatsApp बाट आएको",
    showsAsEn: "Arrived from WhatsApp",
  },
  {
    id: "flyer",
    ne: "पर्चा · QR",
    en: "Printed flyer · QR",
    showsAsNe: "पर्चाको QR स्क्यान गरेर आएको",
    showsAsEn: "Scanned from a printed flyer",
  },
];

/**
 * The tagged link, absolute, ready to paste.
 *
 * `utm_medium` is set alongside the source because Google's channel grouping
 * reads the pair: a source with no medium can still land in "Unassigned",
 * which would leave the report exactly as vague as before.
 */
export function campaignUrl(path: string, sourceId: string): string {
  const source = campaignSources.find((entry) => entry.id === sourceId);
  const medium = source?.id === "flyer" ? "offline" : source?.id === "whatsapp" ? "message" : "social";

  const url = new URL(absoluteUrl(path));
  url.searchParams.set("utm_source", sourceId);
  url.searchParams.set("utm_medium", medium);

  return url.toString();
}
