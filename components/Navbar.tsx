import Image from "next/image";
import Link from "next/link";
import NavbarControls from "@/components/NavbarControls";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

type NavbarProps = {
  isLoggedIn?: boolean;
  isAdmin?: boolean;
};

export default async function Navbar({ isLoggedIn = false, isAdmin = false }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-3 md:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image
            src="/images/logo.png"
            alt="KRISHOE Logo"
            width={72}
            height={48}
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="text-2xl font-black tracking-[0.08em] text-[#0B4D3B]">KRISHOE</p>
            <p className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-[#B98A2E] sm:block">
              Walk with Authority
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-[#31413B] lg:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-[#B98A2E]">
              {item.label}
            </Link>
          ))}
        </nav>

        <NavbarControls
          navItems={navItems}
          isLoggedIn={isLoggedIn}
          isAdmin={isAdmin}
        />
      </div>
    </header>
  );
}
