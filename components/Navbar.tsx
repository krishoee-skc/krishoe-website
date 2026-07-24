import Image from "next/image";
import Link from "next/link";
import NavbarControls from "@/components/NavbarControls";
import PrimaryNav from "@/components/PrimaryNav";

type NavbarProps = {
  isLoggedIn?: boolean;
  isAdmin?: boolean;
};

export default async function Navbar({ isLoggedIn = false, isAdmin = false }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-3 md:px-8">
        <Link href="/" className="flex min-w-0 shrink items-center gap-2.5 sm:gap-3">
          <Image
            src="/images/logo.png"
            alt="KRISHOE Logo"
            width={72}
            height={48}
            className="h-9 w-auto shrink-0 sm:h-12"
          />
          <div className="min-w-0">
            <p className="truncate text-xl font-black tracking-[0.06em] text-brand-green sm:text-2xl sm:tracking-[0.08em]">
              KRISHOE
            </p>
            <p className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold-deep sm:block">
              Walk with Authority
            </p>
          </div>
        </Link>

        <PrimaryNav />

        <NavbarControls isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
      </div>
    </header>
  );
}
