import type { Metadata } from "next";
import Link from "next/link";
import T from "@/components/T";
import { NEPAL_TIME_ZONE, toBikramSambatNumeric } from "@/lib/bikram-sambat";

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
    // Sales staff sign in through /admin too; after login they see their own
    // counter view (StaffToday), so this door and the Owner door share a way in
    // but are named apart, because a salesperson is not the owner and should not
    // have to read "Admin" and wonder if the door is theirs.
    href: "/admin",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </svg>
    ),
    titleEn: "Staff",
    titleNe: "स्टाफ",
    subEn: "Counter · sales",
    subNe: "काउन्टर · बिक्री",
    goEn: "Billing",
    goNe: "बिल काट्ने",
    pulseEn: "Counter",
    pulseNe: "काउन्टर",
    ring: "hover:border-[#d98a5b]/70",
    chip: "bg-[#d98a5b]/26 border-[#d98a5b]/40",
    chipText: "text-[#f0c3a3]",
    glow: "before:bg-[radial-gradient(closest-side,#d98a5b,transparent)]",
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
  // The day, as this shop counts it, worked out on the server so the date reads
  // where the shop is rather than where a visitor's browser thinks it is.
  const today = new Date();
  const adDate = new Intl.DateTimeFormat("en-GB", {
    timeZone: NEPAL_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(today);
  const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: NEPAL_TIME_ZONE }).format(today);
  const bsDate = toBikramSambatNumeric(isoDate);

  return (
    // The whole screen is the threshold now — deep green edge to edge, with the
    // content held in the centre — so on a wide monitor it reads as a grand
    // doorway rather than a small card floating on cream.
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[linear-gradient(180deg,#0b2e22,#0e3527_55%,#123f30)] px-4 py-10 text-white">
      {/* Ambient light: a warm gold pool from the top, a cooler one low-left, and
          a faint footwear-tread texture — enough to feel crafted, never busy. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-40 h-[60vh] bg-[radial-gradient(50%_100%_at_50%_0%,rgba(201,162,75,0.22),transparent)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-40 h-[60vh] w-[60vh] rounded-full bg-[radial-gradient(closest-side,rgba(79,158,120,0.14),transparent)]" />
      {/* A faint tiled pattern of little sandals — the shop's own product, drawn
          softly enough to read as texture rather than a picture. It is an inline
          SVG (a sole outline with a toe strap), tiled and barely there. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cg transform='translate(20 22) rotate(-18)'%3E%3Cpath d='M6 2c8 0 12 5 12 14s-3 22-6 26-9 4-11 0-3-14-3-22S-2 2 6 2Z'/%3E%3Cpath d='M2 12c3-4 9-4 12 0'/%3E%3C/g%3E%3Cg transform='translate(78 74) rotate(20)'%3E%3Cpath d='M6 2c8 0 12 5 12 14s-3 22-6 26-9 4-11 0-3-14-3-22S-2 2 6 2Z'/%3E%3Cpath d='M2 12c3-4 9-4 12 0'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          backgroundSize: "120px 120px",
        }}
      />

      <div className="krishoe-enter relative w-full max-w-5xl">
        {/* Monogram + wordmark, larger, centred. */}
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <span className="krishoe-mono grid h-16 w-16 place-items-center overflow-hidden rounded-[18px] bg-[linear-gradient(150deg,#e3c684,#c9a24b)] font-display text-4xl font-black leading-none text-[#0b2e22] shadow-[0_10px_30px_-10px_rgba(201,162,75,0.8),inset_0_1px_0_rgba(255,255,255,0.6)] sm:h-20 sm:w-20 sm:text-5xl">
            K
          </span>
          <span className="font-display text-4xl font-black tracking-[0.02em] text-white sm:text-6xl">
            KRISHOE<span className="text-[#e3c684]">®</span>
          </span>
        </div>
        <p className="mt-3 text-center text-xs font-bold uppercase tracking-[0.28em] text-white/60 sm:text-sm">
          Walk with Authority
        </p>

        {/* A thin gold rule with a diamond — the "golden line" divider. */}
        <div className="mx-auto mt-6 flex max-w-xs items-center gap-3 sm:max-w-md">
          <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(201,162,75,0.7))]" />
          <span className="h-1.5 w-1.5 rotate-45 bg-[#c9a24b]" />
          <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(201,162,75,0.7),transparent)]" />
        </div>

        <p className="mb-9 mt-6 text-center text-base text-white/80 sm:text-lg">
          <T en="Who are you? — choose your door" ne="तपाईं को हुनुहुन्छ? — आफ्नो द्वार छान्नुहोस्" />
        </p>

        {/* The four doors — two-up on a tablet, four across on a wide screen. */}
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {doors.map((door, index) => (
            <Link
              key={door.href}
              href={door.href}
              style={{ animationDelay: `${index * 90}ms` }}
              className={`krishoe-rise group/door relative flex min-h-[220px] flex-col gap-4 overflow-hidden rounded-[24px] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_18px_40px_-20px_rgba(0,0,0,0.75)] transition duration-200 hover:-translate-y-2 sm:min-h-[280px] sm:p-7 ${door.ring} before:pointer-events-none before:absolute before:-top-[40%] before:left-1/2 before:h-[80%] before:w-[120%] before:-translate-x-1/2 before:rounded-full before:opacity-50 before:blur-2xl before:transition-opacity group-hover/door:before:opacity-100 ${door.glow}`}
            >
              <div className="relative flex items-center justify-between">
                <span className={`krishoe-doorIcon grid h-16 w-16 place-items-center rounded-[19px] border ${door.chip} ${door.chipText} shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-transform duration-200 group-hover/door:scale-105 sm:h-[72px] sm:w-[72px]`}>
                  <span className="h-9 w-9 sm:h-10 sm:w-10">{door.icon}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-[11px] font-bold text-white/85">
                  <span className={`krishoe-pulse h-1.5 w-1.5 rounded-full ${door.chipText.replace("text-", "bg-")}`} />
                  <T en={door.pulseEn} ne={door.pulseNe} />
                </span>
              </div>
              <span className="relative mt-auto font-display text-3xl font-semibold leading-tight sm:text-4xl">
                <T en={door.titleEn} ne={door.titleNe} />
                <span className="mt-1.5 block font-sans text-sm font-semibold text-white/60 sm:text-base">
                  <T en={door.subEn} ne={door.subNe} />
                </span>
              </span>
              <span className={`relative inline-flex items-center gap-1.5 text-sm font-black tracking-[0.02em] sm:text-base ${door.chipText}`}>
                <T en={door.goEn} ne={door.goNe} />
                <span className="transition-transform duration-200 group-hover/door:translate-x-1">→</span>
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-white/55 sm:text-sm">
          🔒 <T en="Worker and Admin need a login · the Shop is open to everyone" ne="कामदार र Admin लाई login · पसल सबैलाई खुला" />
        </p>
      </div>

      {/* Bottom golden rule with the live date — a quiet, grand footer. */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-0">
        <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(201,162,75,0.55),transparent)]" />
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-4 text-[11px] text-white/50 sm:text-xs">
          <Link href="/" className="font-bold text-[#e3c684] transition hover:text-white">
            <T en="← Back to the shop" ne="← पसलमा फर्कने" />
          </Link>
          <span className="font-mono tracking-wide">
            {adDate} · <span className="text-[#e3c684]/80">B.S {bsDate}</span>
          </span>
        </div>
      </div>
    </main>
  );
}
