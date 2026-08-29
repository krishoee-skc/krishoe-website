import Image from "next/image";
import Link from "next/link";
import T from "@/components/T";
import NavbarControls from "@/components/NavbarControls";
import PrimaryNav from "@/components/PrimaryNav";

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
  return (
    <header className="sticky top-0 z-50 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      {/* The utility bar the approved shop leads with: the free-delivery line a
          first-time shopper checks, and the two links they reach for — on every
          page, since it rides on top of the header. */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 bg-brand-green-ink px-4 py-1.5 text-[11px] font-semibold text-brand-gold-bright md:px-8">
        <span className="flex min-w-0 items-center gap-1.5">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v9H3zM14 10h3l3 3v3h-6M6 18a1.5 1.5 0 1 0 3 0M15 18a1.5 1.5 0 1 0 3 0" />
          </svg>
          <span className="truncate">
            <T en="Free delivery over NPR 2000" ne="NPR 2000 माथि Free delivery" />
          </span>
        </span>
        <span className="flex flex-none items-center gap-2.5">
          <Link href="/track-order" className="transition hover:text-white">
            <T en="Track Order" ne="अर्डर ट्र्याक" />
          </Link>
          <span aria-hidden className="opacity-40">·</span>
          <Link href="/contact" className="transition hover:text-white">
            <T en="Help" ne="सहयोग" />
          </Link>
        </span>
      </div>

      <div className="border-b border-black/[0.08]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-3.5 md:px-8">
          <Link href="/" className="flex min-w-0 shrink items-center gap-3">
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
            <span className="grid h-12 w-[68px] shrink-0 place-items-center overflow-hidden rounded-xl bg-black ring-1 ring-brand-gold/60 sm:h-14 sm:w-[80px]">
              <Image
                src="https://scx7x508oyhat5zs.public.blob.vercel-storage.com/products/krishoe-logo-198YNm1h6FD1f1393IdOtRaEvgN557.jpeg"
                alt="KRISHOE — Walk with Authority"
                width={893}
                height={723}
                priority
                className="h-full w-full object-contain"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-black uppercase tracking-[0.26em] text-brand-green-ink sm:text-xl">
                KRISHOE
              </span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.3em] text-brand-gold-deep sm:block">
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
