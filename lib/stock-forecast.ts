import type { StockMovement } from "@/lib/operations";
import type { Said } from "@/lib/words";

/**
 * How long the stock on hand will last, when that can honestly be said.
 *
 * The shop already records every pair in and out, so the arithmetic is easy.
 * The hard part — and the reason this file is mostly about refusing — is that a
 * forecast the owner cannot trust is worse than none.
 *
 * KRISHOE has three weeks of history and four sales in it. A number produced
 * from that would look exactly as confident as one produced from a year, and
 * acting on it means cutting leather for pairs nobody ordered. So a design is
 * only forecast once it has sold enough times, across enough days, for a rate
 * to mean anything; everything else is reported as not yet knowable, by name,
 * so the owner can see what it is waiting for.
 *
 * The thresholds are deliberately low. This is a workshop making a few hundred
 * pairs a month, not a warehouse — waiting for statistical comfort would mean
 * the feature never says anything at all.
 */

/** Sales events needed before a rate is quoted. Below this it is noise. */
const MIN_SALE_EVENTS = 3;

/** Days the sales must be spread across, so one busy day is not a trend. */
const MIN_HISTORY_DAYS = 10;

export type StockOutlook = {
  design: string;
  /** Pairs available right now. */
  onHand: number;
  /** Pairs sold inside the window. */
  soldInWindow: number;
  /** Separate sale events, not pairs — one order of 12 is one event. */
  saleEvents: number;
  /** Days between the first sale seen and today. */
  historyDays: number;
  /** Pairs per day, rounded to two places. Null when not yet knowable. */
  dailyRate: number | null;
  /** Days until it runs out at that rate. Null when not yet knowable. */
  daysOfCover: number | null;
  status: "out" | "urgent" | "soon" | "healthy" | "unknown";
  /**
   * Why there is no forecast, in the owner's terms, in both languages. Both
   * halves are empty when there IS a forecast.
   */
  waitingFor: Said;
};

const dayKey = (iso: string) => iso.slice(0, 10);

function designKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Works out the outlook for one design.
 *
 * Only "Sale Out" counts as demand. Adjustments are the owner correcting the
 * book against a physical count, and production and purchases are supply —
 * counting any of them as sales would invent demand that never happened, which
 * is the exact mistake that leads to making pairs nobody wants.
 */
export function outlookForDesign(
  design: string,
  onHand: number,
  movements: StockMovement[],
  now = new Date(),
): StockOutlook {
  const sales = movements
    .filter((movement) => designKey(movement.design) === designKey(design))
    .filter((movement) => movement.type === "Sale Out" && movement.pairs > 0);

  const soldInWindow = sales.reduce((total, movement) => total + movement.pairs, 0);
  const saleEvents = sales.length;

  const firstSale = sales
    .map((movement) => new Date(movement.createdAt).getTime())
    .sort((a, b) => a - b)[0];
  const historyDays = firstSale
    ? Math.max(1, Math.round((now.getTime() - firstSale) / 86_400_000))
    : 0;
  const saleDays = new Set(sales.map((movement) => dayKey(movement.createdAt))).size;

  const base: StockOutlook = {
    design,
    onHand,
    soldInWindow,
    saleEvents,
    historyDays,
    dailyRate: null,
    daysOfCover: null,
    status: onHand <= 0 ? "out" : "unknown",
    waitingFor: { en: "", ne: "" },
  };

  if (saleEvents < MIN_SALE_EVENTS) {
    return {
      ...base,
      waitingFor:
        saleEvents === 0
          ? { en: "Not sold even once yet", ne: "अझै एउटै बिक्री भएको छैन" }
          : {
              en: `${MIN_SALE_EVENTS - saleEvents} more sales and we can say`,
              ne: `${MIN_SALE_EVENTS - saleEvents} पटक थप बिक्री भएपछि भन्न सकिन्छ`,
            },
    };
  }

  if (historyDays < MIN_HISTORY_DAYS || saleDays < 2) {
    return {
      ...base,
      waitingFor: {
        en: "The sales all came at once — a few more days are needed",
        ne: "बिक्री एकै समयमा भएको — केही दिन थप चाहिन्छ",
      },
    };
  }

  // Rate over the days actually observed, not over a fixed window: a design
  // first sold last week must not be averaged across a month it did not exist
  // for, which would halve its rate and hide a shortage.
  const dailyRate = Math.round((soldInWindow / historyDays) * 100) / 100;

  if (dailyRate <= 0) {
    return {
      ...base,
      waitingFor: { en: "The rate of sale could not be measured", ne: "बिक्रीको गति नापिन सकिएन" },
    };
  }

  const daysOfCover = Math.floor(onHand / dailyRate);

  return {
    ...base,
    dailyRate,
    daysOfCover,
    status:
      onHand <= 0 ? "out" : daysOfCover <= 7 ? "urgent" : daysOfCover <= 21 ? "soon" : "healthy",
    waitingFor: { en: "", ne: "" },
  };
}

/**
 * The outlook for every design that holds stock, worst first.
 *
 * Sorted so what needs attention is at the top and the merely-unknowable sinks
 * — the owner should not have to scroll past twelve "not enough sales yet" rows
 * to find the one running out this week.
 */
export function stockOutlook(
  stock: { design: string; pairs: number }[],
  movements: StockMovement[],
  now = new Date(),
): StockOutlook[] {
  const rank: Record<StockOutlook["status"], number> = {
    out: 0,
    urgent: 1,
    soon: 2,
    healthy: 3,
    unknown: 4,
  };

  return stock
    .map((row) => outlookForDesign(row.design, row.pairs, movements, now))
    .sort((first, second) => {
      if (rank[first.status] !== rank[second.status]) {
        return rank[first.status] - rank[second.status];
      }
      return (first.daysOfCover ?? Infinity) - (second.daysOfCover ?? Infinity);
    });
}

/** One line the owner can act on, or an honest blank. */
export function outlookAdvice(outlook: StockOutlook): Said {
  if (outlook.status === "out") {
    return { en: "Sold out — make or buy", ne: "सकियो — बनाउने वा किन्ने" };
  }
  if (outlook.status === "urgent") {
    return {
      en: `Runs out in ${outlook.daysOfCover} days — start making them now`,
      ne: `${outlook.daysOfCover} दिनमा सकिन्छ — अहिले नै बनाउन थाल्नुहोस्`,
    };
  }
  if (outlook.status === "soon") {
    return {
      en: `Lasts ${outlook.daysOfCover} days — plan for it`,
      ne: `${outlook.daysOfCover} दिन पुग्छ — योजना बनाउनुहोस्`,
    };
  }
  if (outlook.status === "healthy") {
    return { en: `Lasts ${outlook.daysOfCover} days`, ne: `${outlook.daysOfCover} दिन पुग्छ` };
  }
  return outlook.waitingFor;
}
