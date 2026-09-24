import Image from "next/image";
import Link from "next/link";
import T from "@/components/T";
import NavbarControls from "@/components/NavbarControls";
import PrimaryNav from "@/components/PrimaryNav";
import { deliveryPromise } from "@/lib/delivery-fee";
import { getStorefrontDeliveryPricing } from "@/lib/delivery-settings";

type NavbarProps = {
  isLoggedIn?: boolean;
  isAdmin?: boolean;
};

/**
 * Quiet, wide-set, and white — because the brightest thing on a KRISHOE page
 * has to be the shoe.
 *
 * The expensive look here comes from spacing and restraint rather than colour:
 * letter-spaced capitals, one hairline, and gold used exactly twice — the ring
 * around the mark, and the rule under the page you are on. A dark bar or a
 * centred boutique logo would both read as a shop selling twenty-thousand-rupee
 * handbags, and KRISHOE sells thousand-rupee chappal; packaging that outruns
 * the price makes a customer suspicious rather than impressed.
 */
export default async function Navbar({ isLoggedIn = false, isAdmin = false }: NavbarProps) {
  // From Settings, so the header promises what checkout charges.
  const delivery = deliveryPromise(await getStorefrontDeliveryPricing());

  return (
    <header className="sticky top-0 z-50 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      {/* The utility bar the approved shop leads with: the free-delivery line a
          first-time shopper checks, and the two links they reach for — on every
          page, since it rides on top of the header. */}
      {/* 12px, not 11: measured on a phone the line was too small to read.
          On a phone only the delivery line — Track Order is in the menu and
          Help in the footer — so it is one line and never truncated to
          "Free delivery ove…" beside two links. */}
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 bg-brand-green-ink px-4 py-1.5 text-xs font-semibold text-brand-gold-bright sm:justify-between md:px-8">
        <span className="flex min-w-0 items-center gap-1.5">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v9H3zM14 10h3l3 3v3h-6M6 18a1.5 1.5 0 1 0 3 0M15 18a1.5 1.5 0 1 0 3 0" />
          </svg>
          <span className="truncate">
            <T en={delivery.en} ne={delivery.ne} />
          </span>
        </span>
        <span className="hidden flex-none items-center gap-1 sm:flex">
          <Link href="/track-order" className="inline-flex min-h-8 items-center px-1.5 transition hover:text-white">
            <T en="Track Order" ne="अर्डर ट्र्याक" />
          </Link>
          <span aria-hidden className="opacity-40">·</span>
          <Link href="/contact" className="inline-flex min-h-8 items-center px-1.5 transition hover:text-white">
            <T en="Help" ne="सहयोग" />
          </Link>
        </span>
      </div>

      <div className="border-b border-black/[0.08]">
        {/* Tighter on a phone: the header with its strip was 149px of a 667px
            screen, and the menu button was pushed to the very edge. */}
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:gap-6 sm:px-5 sm:py-3.5 md:px-8">
          {/* The shop's own name does not shrink. With `shrink` on this link it
              was the item that gave way when the search box and the buttons
              wanted room, and on a wide laptop the brand rendered as "K .."
              beside its own crest — the one piece of text on the page that
              must always be readable. The search box yields instead. */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5 sm:gap-3">
            {/* The shop's own mark, set in a gold hairline ring. A stamped seal
                rather than a picture pasted on a page — one distinctive detail,
                and everything around it stays quiet. */}
            {/* The emblem alone, not the whole logo shrunk down. logo.png is
                the stacked lockup — crown, shield, KRISHOE and "Walk with
                Authority" — and it was being drawn twenty-eight pixels tall
                inside this ring, where the wordmark under the shield was a
                grey smudge and the tagline was nothing at all. The word is
                already set beside it in type that stays sharp at any size, so
                the picture only has to carry the crest. */}
            {/* The owner's full crest, on a black tile that matches the logo's
                own ground so it reads as one premium badge rather than a black
                square dropped on white paper. The wordmark stays set beside it
                in sharp type; the crest carries the crown, shield and laurel. */}
            <span className="grid h-10 w-[56px] shrink-0 place-items-center overflow-hidden rounded-xl bg-black ring-1 ring-brand-gold/60 sm:h-14 sm:w-[80px]">
              <Image
                src="https://scx7x508oyhat5zs.public.blob.vercel-storage.com/products/krishoe-logo-198YNm1h6FD1f1393IdOtRaEvgN557.jpeg"
                alt="KRISHOE — Walk with Authority"
                width={893}
                height={723}
                priority
                className="h-full w-full object-contain"
              />
            </span>
            <span>
              {/* Tighter letter-spacing on the phone so the full name fits
                  beside the crest instead of truncating to "KRISH…"; the wide,
                  premium spacing returns once there is room. */}
              <span className="block whitespace-nowrap text-lg font-black uppercase tracking-[0.12em] text-brand-green-ink sm:text-xl sm:tracking-[0.24em]">
                KRISHOE
              </span>
              {/* whitespace-nowrap: at this letter-spacing the line is wider
                  than the column it sat in, so it broke into "WALK / WITH /
                  AUTHORITY" stacked under the name. */}
              <span className="hidden whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-gold-deep sm:block">
                Walk with Authority
              </span>
            </span>
          </Link>

          <PrimaryNav />

          <NavbarControls isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  );
}
