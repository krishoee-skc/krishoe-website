import Link from "next/link";
import { businessContact, businessSocialProfiles } from "@/lib/seo";
import T from "@/components/T";

/**
 * The foot of the shop, rebuilt to the approved purple design.
 *
 * The old footer was green with two lopsided columns — ten quick links beside
 * four categories — so the eye read it as unfinished. The links are split into
 * two even columns of six (Shop and Company), the contact facts sit in the
 * fourth, and the whole thing moves to the storefront's deep purple with gold
 * headings, so it reads as one balanced, premium block. Privacy and Terms drop
 * to the bottom bar, where legal links belong.
 */
const shopLinks = [
  { href: "/shop/ladies-sandals", en: "Ladies Sandals", ne: "महिला सेन्डिल" },
  { href: "/shop/ladies-slippers", en: "Ladies Slippers", ne: "महिला चप्पल" },
  { href: "/shop/casual-shoes", en: "Casual Shoes", ne: "दैनिक जुत्ता" },
  { href: "/shop/party-heels", en: "Party Heels", ne: "पार्टी हिल" },
  { href: "/shop/kids-collection", en: "Kids", ne: "बालबालिका" },
  { href: "/shop/new-arrivals", en: "New Arrivals", ne: "नयाँ आगमन" },
];

const companyLinks = [
  { href: "/", en: "Home", ne: "गृह पृष्ठ" },
  { href: "/about", en: "Our Story", ne: "हाम्रो कथा" },
  { href: "/wholesale", en: "Wholesale", ne: "थोक बिक्री" },
  { href: "/track-order", en: "Track order", ne: "अर्डर ट्र्याक" },
  { href: "/faq", en: "FAQ", ne: "प्रश्न उत्तर" },
  { href: "/return-policy", en: "Return policy", ne: "साट्ने नियम" },
];

const PURPLE_GROUND =
  "radial-gradient(120% 90% at 100% 0%, rgba(200,160,77,.14), transparent 55%), linear-gradient(160deg,#4a2680 0%,#3C1A63 55%,#2B1049 100%)";

export default function Footer() {
  const socials = businessSocialProfiles();

  return (
    <footer className="text-white" style={{ background: PURPLE_GROUND }}>
      {/* First-order offer strip — the mockup's newsletter band, kept honest as
          a real link into the shop rather than a form with nowhere to submit. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-brand-gold/20 px-6 py-6">
        <div>
          <h3 className="font-display text-2xl font-bold text-white">
            <T en="10% off your first order" ne="पहिलो अर्डरमा १०% छुट" />
          </h3>
          <p className="mt-1 text-sm text-white/70">
            <T en="Explore the collection made in Nepal." ne="नेपालमै बनेको संग्रह हेर्नुहोस्।" />
          </p>
        </div>
        <Link
          href="/shop"
          className="inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-brand-gold-bright to-brand-gold px-6 text-sm font-black text-brand-purple-deep shadow-md transition hover:opacity-90"
        >
          <T en="Shop now" ne="पसल हेर्ने" />
        </Link>
      </div>

      {/* Four even columns. */}
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h2 className="font-display text-2xl font-black uppercase tracking-[0.22em] text-brand-gold-bright">
            KRISHOE
          </h2>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">
            Walk with Authority
          </p>
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/70">
            <T
              en="Premium footwear crafted for Nepal — style, comfort and quality in every step."
              ne="नेपालमै बनेको premium जुत्ता — हरेक पाइलामा style, comfort र quality।"
            />
          </p>
          {socials.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {socials.map((profile) => (
                <a
                  key={profile.label}
                  href={profile.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/80 transition hover:border-brand-gold hover:bg-brand-gold hover:text-brand-purple-deep"
                >
                  {profile.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-brand-gold-bright">
            <T en="Shop" ne="पसल" />
          </h3>
          <ul className="space-y-2.5 text-sm text-white/80">
            {shopLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-brand-gold-bright">
                  <T en={link.en} ne={link.ne} />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-brand-gold-bright">
            <T en="Company" ne="कम्पनी" />
          </h3>
          <ul className="space-y-2.5 text-sm text-white/80">
            {companyLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-brand-gold-bright">
                  <T en={link.en} ne={link.ne} />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-brand-gold-bright">
            <T en="Contact" ne="सम्पर्क" />
          </h3>
          <ul className="space-y-3 text-sm text-white/80">
            <li>
              {businessContact.streetAddress}, {businessContact.addressLocality}, {businessContact.addressRegion}
            </li>
            <li>
              <a href={`tel:${businessContact.phoneTel}`} className="transition hover:text-brand-gold-bright">
                {businessContact.phoneDisplay}
              </a>
            </li>
            <li>
              <a
                href={`https://wa.me/${businessContact.whatsappNumber}`}
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-brand-gold-bright"
              >
                WhatsApp: {businessContact.whatsappDisplay}
              </a>
            </li>
            <li>
              <a href={`mailto:${businessContact.email}`} className="transition hover:text-brand-gold-bright">
                {businessContact.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar: copyright, the legal links, and the ways to pay. */}
      <div className="border-t border-brand-gold/20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-5 text-xs text-white/60">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              © 2026 KRISHOE · {businessContact.addressLocality}, {businessContact.addressRegion}
            </span>
            <Link href="/privacy" className="transition hover:text-brand-gold-bright">
              <T en="Privacy" ne="गोपनीयता" />
            </Link>
            <Link href="/terms" className="transition hover:text-brand-gold-bright">
              <T en="Terms" ne="सर्तहरू" />
            </Link>
          </p>
          <div className="flex items-center gap-2">
            {["COD", "eSewa", "Khalti", "Bank"].map((method) => (
              <span
                key={method}
                className="rounded border border-white/15 bg-white/5 px-2.5 py-1 font-semibold text-white/70"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
