/**
 * A customer's stage in the shop's relationship with them — the CRM ladder.
 *
 * Worked out purely from their orders, so it needs no new data and cannot drift
 * from what the orders say:
 *   - VIP        three or more completed orders — the shop's best customers
 *   - Repeat     two completed orders — worth keeping close
 *   - Ordered    one completed order — a real buyer
 *   - Interested an order placed but none completed yet — follow up
 *   - New        an account with no orders — welcome them
 *
 * "Completed" is a Closed order; Cancelled ones never count. The thresholds are
 * deliberately gentle for a shop this size — they can be raised later without
 * touching anything that reads a stage.
 */

export type CustomerStage = "New" | "Interested" | "Ordered" | "Repeat" | "VIP";

export function customerStage(closedOrders: number, hasAnyOrder: boolean): CustomerStage {
  if (closedOrders >= 3) return "VIP";
  if (closedOrders === 2) return "Repeat";
  if (closedOrders === 1) return "Ordered";
  if (hasAnyOrder) return "Interested";
  return "New";
}

/** How each stage reads and colours in the admin, English and Nepali. */
export const STAGE_META: Record<
  CustomerStage,
  { en: string; ne: string; className: string; icon: string }
> = {
  VIP: {
    en: "VIP",
    ne: "VIP",
    className: "bg-brand-gold/15 text-brand-gold-deep border border-brand-gold/40",
    icon: "👑",
  },
  Repeat: {
    en: "Repeat",
    ne: "फेरि किन्ने",
    className: "bg-brand-green-mist text-brand-green border border-brand-green-line",
    icon: "🔁",
  },
  Ordered: {
    en: "Ordered",
    ne: "किनेको",
    className: "bg-brand-green-tint text-brand-green border border-brand-green-line",
    icon: "✓",
  },
  Interested: {
    en: "Interested",
    ne: "इच्छुक",
    className: "bg-brand-cream-soft text-brand-gold-ink border border-brand-gold/30",
    icon: "👀",
  },
  New: {
    en: "New",
    ne: "नयाँ",
    className: "bg-brand-mist text-brand-muted-deep border border-brand-green-line",
    icon: "🌱",
  },
};
