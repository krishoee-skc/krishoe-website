import Image from "next/image";
import Link from "next/link";
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
      {/* The strongest thing this shop can say, said first and small. */}
      <p className="flex items-center justify-center gap-2 bg-brand-green-ink px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-gold-bright">
        <span>नेपालमै बनेको</span>
        <span aria-hidden className="opacity-50">·</span>
        <span className="hidden sm:inline">१ हप्ताभित्र साट्ने सुविधा</span>
        <span className="sm:hidden">हाम्रै कारखानाबाट</span>
      </p>

      <div className="border-b border-black/[0.08]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-3.5 md:px-8">
          <Link href="/" className="flex min-w-0 shrink items-center gap-3">
            {/* The shop's own mark, set in a gold hairline ring. A stamped seal
                rather than a picture pasted on a page — one distinctive detail,
                and everything around it stays quiet. */}
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-brand-gold/50 sm:h-12 sm:w-12">
              <Image
                src="/images/logo.png"
                alt="KRISHOE"
                width={72}
                height={48}
                className="h-7 w-auto sm:h-8"
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
