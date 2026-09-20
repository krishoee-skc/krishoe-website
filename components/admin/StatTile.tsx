/**
 * One number, the same way on every admin screen.
 *
 * Each page used to define its own little card — a border, a label, a value —
 * and they drifted: different rounding, different weights, a grey here and a
 * green there. This is the one card now, so the whole admin reads as one shop.
 *
 * The look matches the home: a big display-face value, a quiet label above it,
 * and a thin gradient bar in the shop's colours under it. The bar carries the
 * tone — gold for a plain figure, green for a healthy one, amber and clay for
 * the two that want attention — so a glance down a row reads the state before
 * the numbers do.
 */
import type { ReactNode } from "react";
import CountUp from "@/components/admin/CountUp";

type Tone = "default" | "good" | "warn" | "danger";

/**
 * How much of the row's attention this figure is owed.
 *
 * Tone says how a number is doing; size says which number the screen is about.
 * They answer different questions, and the second was missing: a stock screen
 * showing "398 in stock, 300 factory, 98 shop, 12 sold" at one size is four
 * equal facts, and the eye has to read all four to find the one it came for.
 *
 * "lead" is the figure the screen exists to show; "normal" is everything
 * supporting it, and stays exactly as every tile is drawn today.
 */
type Size = "normal" | "lead";

const ACCENT: Record<Tone, string> = {
  default: "linear-gradient(90deg,#C8A04D,#E9C978)",
  good: "linear-gradient(90deg,#12876a,#37c98c)",
  warn: "linear-gradient(90deg,#c07d1e,#e0a23f)",
  danger: "linear-gradient(90deg,#A9503F,#c86a5b)",
};

/**
 * One step apart, not two. A lead figure twice the height of its neighbours
 * stops reading as the same kind of thing and starts reading as a banner.
 */
const VALUE: Record<Size, string> = {
  normal: "mt-2 font-display text-2xl font-black leading-none tabular-nums text-brand-green-ink",
  lead: "mt-2 font-display text-4xl font-black leading-none tabular-nums text-brand-green-ink",
};

export default function StatTile({
  label,
  value,
  detail,
  tone = "default",
  size = "normal",
}: {
  // label and detail accept a node, not just a string, so a caller can pass a
  // bilingual <T en ne /> where a plain string used to go. A string still works
  // exactly as before — this only widens what is allowed.
  label: ReactNode;
  value: string | number;
  detail?: ReactNode;
  tone?: Tone;
  /** "lead" for the one figure the screen is about. Defaults to normal, so no
   *  existing screen changes until a caller chooses. */
  size?: Size;
}) {
  return (
    <div className="hover-lift rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-muted">{label}</p>
      <p className={VALUE[size]}>
        {/* A plain number rolls up on first view; anything with currency or
            units (a string) is shown as given. */}
        {typeof value === "number" ? (
          <CountUp value={value} locale />
        ) : (
          value
        )}
      </p>
      {detail ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-brand-muted-soft">{detail}</p>
      ) : null}
      <span className="mt-3 block h-1.5 rounded-full" style={{ background: ACCENT[tone] }} />
    </div>
  );
}
