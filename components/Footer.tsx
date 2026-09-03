import Link from "next/link";
import { businessContact, businessSocialProfiles } from "@/lib/seo";
import T from "@/components/T";

/**
 * The foot of the shop, in gold.
 *
 * Balanced columns, every link led by its own dark medallion, and the socials
 * carry their real marks — Facebook, Instagram, TikTok — rather than their
 * names in text. The ground is a warm champagne gold now, so the type turns
 * deep green to stay readable on it, and the medallions go dark green with a
 * gold glyph so they read as one premium set against the gold.
 */
const shopLinks = [
  { href: "/shop/ladies-sandals", en: "Ladies Sandals", ne: "महिला सेन्डिल" },
  { href: "/shop/ladies-slippers", en: "Ladies Slippers", ne: "महिला चप्पल" },
  { href: "/shop/casual-shoes", en: "Casual Shoes", ne: "दैनिक जुत्ता" },
  { href: "/shop/party-heels", en: "Party Heels", ne: "पार्टी हिल" },
  { href: "/shop/mens-collection", en: "Men's Collection", ne: "पुरुष कलेक्शन" },
  { href: "/shop/kids-collection", en: "Kids", ne: "बालबालिका" },
  { href: "/shop/new-arrivals", en: "New Arrivals", ne: "नयाँ आगमन" },
];

const companyLinks = [
  { href: "/", en: "Home", ne: "गृह पृष्ठ" },
  { href: "/about", en: "Our Story", ne: "हाम्रो कथा" },
  { href: "/guides", en: "Guides", ne: "जानकारी" },
  { href: "/wholesale", en: "Wholesale", ne: "थोक बिक्री" },
  { href: "/track-order", en: "Track order", ne: "अर्डर ट्र्याक" },
  { href: "/faq", en: "FAQ", ne: "प्रश्न उत्तर" },
  { href: "/return-policy", en: "Return policy", ne: "साट्ने नियम" },
];

const GOLD_GROUND =
  "radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,.28), transparent 45%), linear-gradient(160deg,#EBD79A 0%,#D6B24A 48%,#C0983B 100%)";

/** Each social platform's own mark, so a pill reads as the brand, not the word. */
function SocialGlyph({ label }: { label: string }) {
  const key = label.toLowerCase();
  if (key.includes("facebook")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M14 9h3V6h-3c-2 0-3.5 1.3-3.5 3.4V11H8v3h2.5v6h3v-6H16l.5-3h-3V9.6c0-.4.3-.6.7-.6Z" />
      </svg>
    );
  }
  if (key.includes("instagram")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (key.includes("tiktok")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M16.5 3c.4 2.6 1.9 4.2 4.5 4.4v3c-1.7 0-3.2-.5-4.5-1.5v6.1a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.1a2.6 2.6 0 1 0 1.7 2.4V3h3Z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
    </svg>
  );
}

const linkMedallion =
  "grid h-6 w-6 flex-none place-items-center rounded-md bg-brand-green text-brand-gold-bright transition group-hover/link:bg-brand-green-ink";

export default function Footer() {
  const socials = businessSocialProfiles();

  return (
    <footer className="text-brand-green-ink" style={{ background: GOLD_GROUND }}>
      {/* First-order offer strip. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-brand-green-ink/15 px-6 py-6">
        <div>
          <h3 className="font-display text-2xl font-bold text-brand-green-ink">
            <T en="5% off your first order" ne="पहिलो अर्डरमा ५% छुट" />
          </h3>
          <p className="mt-1 text-sm text-brand-green-ink/70">
            <T en="Explore the collection made in Nepal." ne="नेपालमै बनेको संग्रह हेर्नुहोस्।" />
          </p>
        </div>
        <Link
          href="/shop"
          className="inline-flex min-h-11 items-center rounded-full bg-brand-green px-6 text-sm font-black text-white shadow-md transition hover:bg-brand-green-ink"
        >
          <T en="Shop now" ne="पसल हेर्ने" />
        </Link>
      </div>

      {/* Four even columns. */}
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h2 className="font-display text-2xl font-black uppercase tracking-[0.22em] text-brand-green-ink">
            KRISHOE
          </h2>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-brand-green-ink/55">
            Walk with Authority
          </p>
          <p className="mt-4 max-w-xs text-sm leading-6 text-brand-green-ink/75">
            <T
              en="Premium footwear crafted for Nepal — style, comfort and quality in every step."
              ne="नेपालमै बनेको premium जुत्ता — हरेक पाइलामा style, comfort र quality।"
            />
          </p>
          {socials.length ? (
            <div className="mt-5 flex flex-wrap gap-2.5">
              {socials.map((profile) => (
                <a
                  key={profile.label}
                  href={profile.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={profile.label}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-brand-green text-brand-gold-bright shadow-sm transition hover:bg-brand-green-ink"
                >
                  <SocialGlyph label={profile.label} />
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-brand-green-ink">
            <T en="Shop" ne="पसल" />
          </h3>
          <ul className="space-y-2.5 text-sm text-brand-green-ink/85">
            {shopLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="group/link flex items-center gap-2.5 font-semibold transition hover:text-brand-green">
                  <span className={linkMedallion}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                    </svg>
                  </span>
                  <T en={link.en} ne={link.ne} />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-brand-green-ink">
            <T en="Company" ne="कम्पनी" />
          </h3>
          <ul className="space-y-2.5 text-sm text-brand-green-ink/85">
            {companyLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="group/link flex items-center gap-2.5 font-semibold transition hover:text-brand-green">
                  <span className={linkMedallion}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                    </svg>
                  </span>
                  <T en={link.en} ne={link.ne} />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-brand-green-ink">
            <T en="Contact" ne="सम्पर्क" />
          </h3>
          <ul className="space-y-3.5 text-sm font-semibold text-brand-green-ink/85">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-md bg-brand-green text-brand-gold-bright">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.3" /></svg>
              </span>
              {/* The address opens the place in Google Maps, so tapping it gives
                  directions rather than being dead text next to a live phone
                  and email. */}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${businessContact.streetAddress}, ${businessContact.addressLocality}, ${businessContact.addressRegion}`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-brand-green"
              >
                {businessContact.streetAddress}, {businessContact.addressLocality}, {businessContact.addressRegion}
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-md bg-brand-green text-brand-gold-bright">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M4 4h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 2 6a2 2 0 0 1 2-2Z" /></svg>
              </span>
              <a href={`tel:${businessContact.phoneTel}`} className="transition hover:text-brand-green">{businessContact.phoneDisplay}</a>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-md bg-brand-green text-brand-gold-bright">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M12 2a10 10 0 0 0-8.7 15l-1.3 5 5.1-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-1.6-.6-3.6-2.5-4.4-4-.2-.4-.8-1.1-.8-2 0-.9.5-1.4.7-1.6.2-.2.4-.2.6-.2h.4c.2 0 .3 0 .5.4l.7 1.6c0 .2.1.3 0 .5l-.4.5c-.2.2-.3.3-.1.6.5.8 1 1.3 1.8 1.8.3.2.5.1.6 0l.6-.7c.2-.2.3-.2.5-.1l1.5.8c.2.1.4.2.4.3.1.2.1.5 0 .8Z" /></svg>
              </span>
              <a href={`https://wa.me/${businessContact.whatsappNumber}`} target="_blank" rel="noreferrer" className="transition hover:text-brand-green">WhatsApp: {businessContact.whatsappDisplay}</a>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-md bg-brand-green text-brand-gold-bright">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
              </span>
              <a href={`mailto:${businessContact.email}`} className="transition hover:text-brand-green">{businessContact.email}</a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar — a dark green band under the gold. */}
      <div className="bg-brand-green-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-5 text-xs text-white/70">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>© 2026 KRISHOE · {businessContact.addressLocality}, {businessContact.addressRegion}</span>
            <Link href="/privacy" className="transition hover:text-brand-gold-bright"><T en="Privacy" ne="गोपनीयता" /></Link>
            <Link href="/terms" className="transition hover:text-brand-gold-bright"><T en="Terms" ne="सर्तहरू" /></Link>
          </p>
          <div className="flex items-center gap-2">
            {["COD", "eSewa", "Khalti", "Bank"].map((method) => (
              <span key={method} className="rounded border border-white/15 bg-white/10 px-2.5 py-1 font-semibold text-white/80">{method}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
