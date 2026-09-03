import type { Metadata } from "next";
import Link from "next/link";
import T from "@/components/T";

export const metadata: Metadata = {
  title: "Enter KRISHOE",
  description: "Choose your door — Shop, Worker, or Admin.",
  robots: { index: false, follow: false },
};

/**
 * One threshold for the whole company.
 *
 * The shop, the worker portal and the admin each had their own way in, scattered
 * across three URLs a new hand had to be told. This is the single door: it asks
 * who you are and shows the three ways through, each with its own colour and a
 * live word beside it, on the brand's deep-green-and-gold ground.
 *
 * It never blocks the shop — a customer still reaches krishoe.com straight — so
 * this is an extra front step, not a gate. The two that need a login (worker,
 * admin) land on their own sign-in; the shop opens for everyone.
 */

type Door = {
  href: string;
  icon: React.ReactNode;
  titleEn: string;
  titleNe: string;
  subEn: string;
  subNe: string;
  goEn: string;
  goNe: string;
  pulseEn: string;
  pulseNe: string;
  // Per-door accent, kept inside the brand's own gold / sage / slate-green.
  ring: string;
  chip: string;
  chipText: string;
  glow: string;
};

const doors: Door[] = [
  {
    href: "/shop",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14h18V6l-3-4z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
    titleEn: "Shop",
    titleNe: "पसल",
    subEn: "Customer",
    subNe: "ग्राहक",
    goEn: "Go shopping",
    goNe: "किन्न जाने",
    pulseEn: "Open",
    pulseNe: "खुला",
    ring: "hover:border-[#e3c684]/60",
    chip: "bg-[#c9a24b]/22 border-[#c9a24b]/40",
    chipText: "text-[#f0d79a]",
    glow: "before:bg-[radial-gradient(closest-side,#c9a24b,transparent)]",
  },
  {
    href: "/worker/login",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M16 4a4 4 0 0 1 0 8" />
      </svg>
    ),
    titleEn: "Worker",
    titleNe: "कामदार",
    subEn: "Work / pay",
    subNe: "काम / तलब",
    goEn: "My work",
    goNe: "आफ्नो काम",
    pulseEn: "Portal",
    pulseNe: "पोर्टल",
    ring: "hover:border-[#4f9e78]/70",
    chip: "bg-[#4f9e78]/26 border-[#4f9e78]/40",
    chipText: "text-[#a9e3c6]",
    glow: "before:bg-[radial-gradient(closest-side,#4f9e78,transparent)]",
  },
  {
    href: "/admin",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    titleEn: "Owner",
    titleNe: "मालिक",
    subEn: "Admin · books",
    subNe: "Admin · हिसाब",
    goEn: "Admin",
    goNe: "Admin",
    pulseEn: "Secure",
    pulseNe: "सुरक्षित",
    ring: "hover:border-[#7ea0c0]/70",
    chip: "bg-[#7ea0c0]/26 border-[#7ea0c0]/40",
    chipText: "text-[#cfe0f0]",
    glow: "before:bg-[radial-gradient(closest-side,#7ea0c0,transparent)]",
  },
];

export default function EnterPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4efe3] px-4 py-10">
      <div className="w-full max-w-3xl">
        {/* The threshold: deep-green ground, a gold monogram with a slow gleam,
            the brand line, then the three doors. */}
        <section className="krishoe-enter relative overflow-hidden rounded-[26px] border border-[#c9a24b]/30 bg-[linear-gradient(180deg,#0b2e22,#123f30)] px-5 py-9 shadow-[0_30px_70px_-30px_rgba(11,46,34,0.6)] sm:px-8">
          {/* top glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(201,162,75,0.28),transparent)]"
          />
          {/* hairline gold frame */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-[10px] rounded-[18px] border border-[#c9a24b]/25" />

          <div className="relative flex items-center justify-center gap-3">
            <span className="krishoe-mono grid h-14 w-14 place-items-center overflow-hidden rounded-[15px] bg-[linear-gradient(150deg,#e3c684,#c9a24b)] font-display text-3xl font-black leading-none text-[#0b2e22] shadow-[0_8px_22px_-8px_rgba(201,162,75,0.7),inset_0_1px_0_rgba(255,255,255,0.5)]">
              K
            </span>
            <span className="font-display text-3xl font-black tracking-[0.02em] text-white sm:text-4xl">
              KRISHOE<span className="text-[#e3c684]">®</span>
            </span>
          </div>
          <p className="relative mt-2 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">
            Walk with Authority
          </p>
          <p className="relative mb-6 mt-5 text-center text-sm text-white/80">
            <T en="Who are you? — choose your door" ne="तपाईं को हुनुहुन्छ? — आफ्नो द्वार छान्नुहोस्" />
          </p>

          <div className="relative grid gap-3 sm:grid-cols-3">
            {doors.map((door) => (
              <Link
                key={door.href}
                href={door.href}
                className={`group/door relative flex flex-col gap-3 overflow-hidden rounded-[18px] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_14px_30px_-18px_rgba(0,0,0,0.7)] transition duration-200 hover:-translate-y-1.5 ${door.ring} before:pointer-events-none before:absolute before:-top-[40%] before:left-1/2 before:h-[80%] before:w-[120%] before:-translate-x-1/2 before:rounded-full before:opacity-50 before:blur-2xl before:transition-opacity group-hover/door:before:opacity-90 ${door.glow}`}
              >
                <div className="relative flex items-center justify-between">
                  <span className={`grid h-11 w-11 place-items-center rounded-[13px] border ${door.chip} ${door.chipText}`}>
                    <span className="h-5 w-5">{door.icon}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/20 px-2.5 py-1 text-[10px] font-bold text-white/85">
                    <span className={`krishoe-pulse h-1.5 w-1.5 rounded-full ${door.chipText.replace("text-", "bg-")}`} />
                    <T en={door.pulseEn} ne={door.pulseNe} />
                  </span>
                </div>
                <span className="relative font-display text-lg font-semibold leading-tight">
                  <T en={door.titleEn} ne={door.titleNe} />
                  <span className="mt-0.5 block font-sans text-xs font-semibold text-white/60">
                    <T en={door.subEn} ne={door.subNe} />
                  </span>
                </span>
                <span className={`relative inline-flex items-center gap-1.5 text-xs font-black tracking-[0.02em] ${door.chipText}`}>
                  <T en={door.goEn} ne={door.goNe} /> →
                </span>
              </Link>
            ))}
          </div>

          <p className="relative mt-5 text-center text-[11px] text-white/55">
            🔒 <T en="Worker and Admin need a login · the Shop is open to everyone" ne="कामदार र Admin लाई login · पसल सबैलाई खुला" />
          </p>
        </section>

        <p className="mt-5 text-center text-xs text-[#5f6a5f]">
          <Link href="/" className="font-bold text-[#8a6516] hover:underline">
            <T en="← Back to the shop" ne="← पसलमा फर्कने" />
          </Link>
        </p>
      </div>
    </main>
  );
}
