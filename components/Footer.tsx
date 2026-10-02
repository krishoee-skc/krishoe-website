import Link from "next/link";
import { businessContact, businessSocialProfiles } from "@/lib/seo";
import T from "@/components/T";
import FooterGroups, { type FooterGroup, type FooterLink } from "@/components/FooterGroups";
import { ReturnIcon, StarIcon, StoreIcon, TruckIcon } from "@/components/Icons";

/**
 * The foot of the shop, in gold, framed.
 *
 * Grouped (owner, 2026-10-02): once six new shelves came in, twenty-one links
 * ran in one heap — "Kids Slippers" beside "Home" beside "Our Story". Now:
 *
 *   the top line   the name, the first-order offer, the shop's social
 *                  accounts and Shop now — the socials moved up here, so the
 *                  contact column below is no longer the tallest thing
 *   four groups    Women, Men, Kids, Shop: columns on a computer; on a phone,
 *                  rows that open on a tap (components/FooterGroups.tsx)
 *   contact        four tappable tiles — call, WhatsApp, directions, email —
 *                  two by two; on a phone, three big buttons at the top
 *   help           Track order, Return policy, Leave a review, Our Story, in
 *                  one row of pills along the bottom
 *   the green band the year, Privacy, Terms, the team's lock, the ways to pay,
 *                  and a way back to the top
 *
 * Every link of before is still here except Home, which the logo and the tab
 * bar already are (owner's choice). Nothing else went: the map link, phone,
 * WhatsApp, email, socials, offer, lock and payment pills all stayed.
 *
 * Contrast, measured when the gold was set: deep green type is kept at full
 * strength on this ground — at 55-85% it fell below WCAG AA (4.5) at the
 * gradient's darker end — and the end stop was lifted to #CBA544 to carry it.
 */

/** The shelves, by who they are for. "All …" opens the whole collection. */
const footerGroups: FooterGroup[] = [
  {
    key: "women",
    en: "Women",
    ne: "महिला",
    links: [
      { href: "/shop/ladies-sandals", en: "Sandals", ne: "स्यान्डल" },
      { href: "/shop/ladies-slippers", en: "Slippers", ne: "चप्पल" },
      { href: "/shop/ladies-close-shoes", en: "Close Shoes", ne: "बन्द जुत्ता" },
      { href: "/shop/ladies-shoes", en: "Shoes", ne: "जुत्ता" },
      { href: "/shop/party-heels", en: "Party Heels", ne: "पार्टी हिल" },
    ],
  },
  {
    key: "men",
    en: "Men",
    ne: "पुरुष",
    links: [
      { href: "/shop/mens-slippers", en: "Slippers", ne: "चप्पल" },
      { href: "/shop/mens-shoes", en: "Shoes", ne: "जुत्ता" },
      { href: "/shop/mens-collection", en: "All men's", ne: "पुरुषका सबै", all: true },
    ],
  },
  {
    key: "kids",
    en: "Kids",
    ne: "बच्चा",
    links: [
      { href: "/shop/kids-shoes", en: "Shoes", ne: "जुत्ता" },
      { href: "/shop/kids-slippers", en: "Slippers", ne: "चप्पल" },
      { href: "/shop/kids-collection", en: "All kids", ne: "बच्चाका सबै", all: true },
    ],
  },
  {
    key: "shop",
    en: "Shop",
    ne: "पसल",
    links: [
      { href: "/shop/new-arrivals", en: "New Arrivals", ne: "नयाँ आगमन" },
      { href: "/shop/casual-shoes", en: "Casual Shoes", ne: "दैनिक जुत्ता" },
      { href: "/wholesale", en: "Wholesale", ne: "थोक बिक्री" },
      { href: "/guides", en: "Guides", ne: "जानकारी" },
      { href: "/faq", en: "FAQ", ne: "प्रश्न उत्तर" },
    ],
  },
];

/** Help, along the bottom, each with its own mark. */
const helpLinks: Array<FooterLink & { icon: "truck" | "return" | "star" | "story" }> = [
  { href: "/track-order", en: "Track order", ne: "अर्डर ट्र्याक", icon: "truck" },
  { href: "/return-policy", en: "Return policy", ne: "साट्ने नियम", icon: "return" },
  { href: "/review", en: "Leave a review", ne: "राय दिनुहोस्", icon: "star" },
  { href: "/about", en: "Our Story", ne: "हाम्रो कथा", icon: "story" },
];

function HelpMark({ icon }: { icon: (typeof helpLinks)[number]["icon"] }) {
  const className = "h-3.5 w-3.5 text-brand-green";
  if (icon === "truck") return <TruckIcon className={className} />;
  if (icon === "return") return <ReturnIcon className={className} />;
  if (icon === "star") return <StarIcon className={className} />;
  return <StoreIcon className={className} />;
}

const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${businessContact.streetAddress}, ${businessContact.addressLocality}, ${businessContact.addressRegion}`,
)}`;

/**
 * The gold ground, lifted at its dark end so deep-green type clears WCAG AA
 * across all of it. Measured against #1A4238 at full strength:
 * #EFDFAD 8.42, #DCBC5C 6.06, #CBA544 4.79 — all above the 4.5 body-text bar.
 * The old end stop, #C0983B, reached only 4.15 even at full strength.
 */
const GOLD_GROUND =
  "radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,.30), transparent 48%), linear-gradient(160deg,#EFDFAD 0%,#DCBC5C 52%,#CBA544 100%)";

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
  if (key.includes("youtube")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8A26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
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

/**
 * The shop's social accounts as round stones: green with a gold hairline, a
 * lift and the name on hover, a press on touch (owner, 2026-10-02 — the
 * square tiles looked flat). Only the accounts the shop has set are drawn.
 */
function Socials({ socials, size }: { socials: ReturnType<typeof businessSocialProfiles>; size: "sm" | "md" }) {
  if (socials.length === 0) return null;
  const box = size === "md" ? "h-11 w-11" : "h-10 w-10";
  return (
    <div className="flex items-center gap-2">
      {socials.map((profile) => (
        <a
          key={profile.label}
          href={profile.url}
          target="_blank"
          rel="noreferrer"
          aria-label={profile.label}
          title={profile.label}
          className={`${box} grid place-items-center rounded-full bg-gradient-to-br from-brand-green to-brand-green-ink text-brand-gold-bright shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_0_0_1.5px_rgba(233,196,106,.75),0_6px_14px_rgba(14,82,64,.28)] transition duration-300 hover:-translate-y-0.5 hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_0_0_2px_rgba(233,196,106,1),0_10px_22px_rgba(14,82,64,.35)] active:translate-y-0 active:scale-95`}
        >
          <SocialGlyph label={profile.label} />
        </a>
      ))}
    </div>
  );
}

const contactTile =
  "grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2.5 rounded-xl border border-white/60 bg-white/40 px-2.5 py-2 text-brand-green-ink transition hover:-translate-y-0.5 hover:bg-white/70 active:scale-[0.98]";
const contactMark = "grid h-8 w-8 place-items-center rounded-lg bg-brand-green text-brand-gold-bright";
const quickButton =
  "flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[13px] font-extrabold transition active:scale-95";

const phoneSvg = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M4 4h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 2 6a2 2 0 0 1 2-2Z" /></svg>
);
const whatsappSvg = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 2a10 10 0 0 0-8.7 15l-1.3 5 5.1-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-1.6-.6-3.6-2.5-4.4-4-.2-.4-.8-1.1-.8-2 0-.9.5-1.4.7-1.6.2-.2.4-.2.6-.2h.4c.2 0 .3 0 .5.4l.7 1.6c0 .2.1.3 0 .5l-.4.5c-.2.2-.3.3-.1.6.5.8 1 1.3 1.8 1.8.3.2.5.1.6 0l.6-.7c.2-.2.3-.2.5-.1l1.5.8c.2.1.4.2.4.3.1.2.1.5 0 .8Z" /></svg>
);
const pinSvg = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.3" /></svg>
);
const mailSvg = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
);

export default function Footer() {
  const socials = businessSocialProfiles();

  return (
    <footer
      className="border-x-[3px] border-t-[3px] border-brand-gold text-brand-green-ink"
      style={{ background: GOLD_GROUND }}
    >
      {/* The brand, the offer, the socials and Shop now, on one line. */}
      <div className="border-b border-brand-green-ink/25">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:py-4">
          <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
            <div>
              <h2 className="font-display text-lg font-black uppercase tracking-[0.22em] text-brand-green-ink sm:text-xl">
                KRISHOE
              </h2>
              <p className="mt-0.5 hidden text-[9.5px] font-bold uppercase tracking-[0.28em] text-brand-green-ink sm:block">
                Walk with Authority
              </p>
            </div>
            <span aria-hidden="true" className="hidden h-9 w-px bg-brand-green-ink/25 sm:block" />
            <div>
              <p className="font-display text-[13px] font-black text-brand-green-ink sm:text-[17px]">
                <T en="5% off your first order" ne="पहिलो अर्डरमा ५% छुट" />
              </p>
              <p className="mt-0.5 hidden text-[12.5px] text-brand-green-ink sm:block">
                <T en="Explore the collection made in Nepal." ne="नेपालमै बनेको संग्रह हेर्नुहोस्।" />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            {socials.length ? (
              <div className="hidden items-center gap-3 lg:flex">
                <span className="text-[10.5px] font-black uppercase tracking-[0.2em] text-brand-green-ink">
                  <T en="Follow" ne="फलो गर्नुहोस्" />
                </span>
                <Socials socials={socials} size="md" />
              </div>
            ) : null}
            <Link
              href="/shop"
              className="inline-flex min-h-11 flex-none items-center whitespace-nowrap rounded-full bg-brand-green px-5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-brand-green-ink sm:px-6"
            >
              <T en="Shop now" ne="पसल हेर्ने" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[4fr_1.9fr] lg:gap-6 lg:py-5">
        {/* On a phone: the three things a shopper reaches for, first. */}
        <div className="grid grid-cols-3 gap-2 lg:hidden">
          <a href={`tel:${businessContact.phoneTel}`} className={`${quickButton} bg-brand-green text-white shadow-md`}>
            {phoneSvg}
            <T en="Call" ne="फोन" />
          </a>
          <a href={`https://wa.me/${businessContact.whatsappNumber}`} target="_blank" rel="noreferrer" className={`${quickButton} bg-brand-green text-white shadow-md`}>
            {whatsappSvg}
            WhatsApp
          </a>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className={`${quickButton} border-[1.5px] border-brand-green bg-white/70 text-brand-green`}>
            {pinSvg}
            <T en="Map" ne="नक्सा" />
          </a>
        </div>

        <FooterGroups groups={footerGroups} />

        {/* On a computer: contact as four tiles, two by two. */}
        <div className="hidden lg:block">
          <h3 className="mb-2 flex items-center gap-2 border-b-[1.5px] border-brand-green-ink/20 pb-2 text-xs font-black uppercase tracking-[0.18em] text-brand-green-ink">
            <span aria-hidden="true" className="h-0.5 w-3.5 rounded bg-brand-green" />
            <T en="Contact" ne="सम्पर्क" />
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <a href={`tel:${businessContact.phoneTel}`} className={contactTile}>
              <span className={contactMark}>{phoneSvg}</span>
              <span className="min-w-0">
                <b className="block truncate text-[13px] font-extrabold">{businessContact.phoneDisplay}</b>
                <span className="block truncate text-[11px]"><T en="Call the shop" ne="पसलमा फोन" /></span>
              </span>
            </a>
            <a href={`https://wa.me/${businessContact.whatsappNumber}`} target="_blank" rel="noreferrer" className={contactTile}>
              <span className={contactMark}>{whatsappSvg}</span>
              <span className="min-w-0">
                <b className="block truncate text-[13px] font-extrabold">{businessContact.whatsappDisplay}</b>
                <span className="block truncate text-[11px]">WhatsApp</span>
              </span>
            </a>
            {/* The address opens the place in Google Maps, so tapping it gives
                directions rather than being dead text. */}
            <a href={mapsUrl} target="_blank" rel="noreferrer" className={contactTile}>
              <span className={contactMark}>{pinSvg}</span>
              <span className="min-w-0">
                <b className="block truncate text-[13px] font-extrabold">{businessContact.streetAddress}</b>
                <span className="block truncate text-[11px]"><T en="Get directions" ne="बाटो हेर्ने" /></span>
              </span>
            </a>
            <a href={`mailto:${businessContact.email}`} className={contactTile}>
              <span className={contactMark}>{mailSvg}</span>
              <span className="min-w-0">
                <b className="block truncate text-[13px] font-extrabold"><T en="Email us" ne="इमेल गर्नुहोस्" /></b>
                <span className="block truncate text-[11px]">{businessContact.email}</span>
              </span>
            </a>
          </div>
        </div>

        {/* On a phone: where the shop is, and its socials, on one line. */}
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <div className="flex min-w-0 flex-col text-xs font-semibold leading-5 text-brand-green-ink">
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-xs">
              {businessContact.streetAddress}, {businessContact.addressLocality}
            </a>
            <a href={`mailto:${businessContact.email}`} className="truncate text-xs">{businessContact.email}</a>
          </div>
          <Socials socials={socials} size="sm" />
        </div>
      </div>

      {/* Help, in one row of pills along the bottom (owner, 2026-10-02); on a
          phone the row slides sideways. */}
      <div className="border-t border-brand-green-ink/20 bg-white/20">
        <nav aria-label="Help" className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
          <span className="mr-1 hidden text-[10.5px] font-black uppercase tracking-[0.2em] text-brand-green-ink sm:inline">
            <T en="Help" ne="सहयोग" />
          </span>
          {helpLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-9 flex-none items-center gap-1.5 rounded-full border border-brand-green/20 bg-white/50 px-3 text-[12.5px] font-bold text-brand-green-ink transition hover:border-brand-green hover:bg-white/80 active:scale-95"
            >
              <HelpMark icon={link.icon} />
              <T en={link.en} ne={link.ne} />
            </Link>
          ))}
        </nav>
      </div>

      {/* Bottom bar — a dark green band under the gold, with the gold rule
          between them closing the frame. White at 85% rather than 70%: on this
          green that is 8.59 against 6.36, and the payment pills beside it are
          bright enough to make a dimmer line read as switched off. */}
      <div className="border-t-[3px] border-brand-gold bg-brand-green-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-white/85 sm:px-6">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/85">
            <span>© 2026 KRISHOE<span className="hidden sm:inline"> · {businessContact.addressLocality}, {businessContact.addressRegion}</span></span>
            <Link href="/privacy" className="transition hover:text-brand-gold-bright"><T en="Privacy" ne="गोपनीयता" /></Link>
            <Link href="/terms" className="transition hover:text-brand-gold-bright"><T en="Terms" ne="सर्तहरू" /></Link>
            {/* The team's way in from the shop: a small lock and no words, so a
                shopper takes it for a "secure shop" mark and passes by, while
                the team is told "press the lock at the bottom". The words live
                in the label, for screen readers. It opens the doors (/enter);
                the password behind them is the real lock, not this. */}
            <Link
              href="/enter"
              aria-label="Staff and worker login"
              title="Team"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-sm opacity-70 transition hover:border-white/40 hover:opacity-100 focus-visible:opacity-100"
            >
              <span aria-hidden="true">🔐</span>
            </Link>
          </p>
          <div className="flex items-center gap-2">
            {["COD", "eSewa", "Khalti", "Bank"].map((method) => (
              <span key={method} className="rounded border border-white/15 bg-white/10 px-2.5 py-1 font-semibold text-white/80">{method}</span>
            ))}
            {/* "#top" takes the reader to the top of the page, with no script. */}
            <a
              href="#top"
              aria-label="Back to top"
              title="Back to top"
              className="order-first grid h-8 w-8 place-items-center rounded-full border-[1.5px] border-brand-gold text-brand-gold-bright transition hover:-translate-y-0.5 hover:bg-white/10 sm:order-none sm:ml-1"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M6 14l6-6 6 6" /></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
