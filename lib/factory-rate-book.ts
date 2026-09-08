/**
 * Every wage rate the work-entry screen might need, decided in one place.
 *
 * Entering a day's work meant a round trip for each rate: pick a worker, pick
 * an item, wait, read the amount. Fifty entries in a morning is fifty waits at
 * a workbench, and the rate itself had not changed since the last one.
 *
 * So the screen is given the whole rate book at once and looks a rate up
 * without asking again. The rule for *which* rate wins has to be exactly the
 * one the server settles on when the entry is saved — a screen that quotes one
 * figure and a ledger that records another is the argument this must not start.
 *
 * Three sources, in the order the database picks them:
 *   1. a rate set for this worker on this item and stage — the override
 *   2. the stage rate for that item, whoever does it
 *   3. the older factory rate, kept by item and worker category
 *
 * Within a source the newest rate that has already come into effect wins.
 */
import { pieceWage } from "@/lib/factory-board";

export type RateSource = "Worker override" | "Production stage" | "Factory rate";

/** One rate as the database keeps it. */
export type FactoryRate = {
  /** The factory item this rate is for. */
  itemId: string;
  /** Set for one worker only — the override. Empty for a rate open to anyone. */
  workerId: string;
  /** The production stage, for the first two sources. */
  stage: string;
  /** The worker category, which is how the older factory rates are filed. */
  workerCategory: string;
  ratePerPair: number;
  /** ISO day the rate came into effect. */
  effectiveFrom: string;
  source: RateSource;
};

/** Lower wins: a rate set for this person beats a rate set for the stage. */
const PRIORITY: Record<RateSource, number> = {
  "Worker override": 0,
  "Production stage": 1,
  "Factory rate": 2,
};

export type RateLookup = {
  itemId: string;
  workerId: string;
  stage: string;
  workerCategory: string;
  /** The day the work was done, "YYYY-MM-DD". A rate that starts tomorrow
   *  must not price work done today. */
  onDate: string;
};

/**
 * The rate that applies, or null when the factory has never set one for this
 * item and this kind of work — which is a question for the owner, not a zero.
 */
export function rateFor(rates: FactoryRate[], lookup: RateLookup): FactoryRate | null {
  let best: FactoryRate | null = null;

  for (const rate of rates) {
    if (rate.itemId !== lookup.itemId) continue;
    if (rate.effectiveFrom > lookup.onDate) continue;
    if (!(rate.ratePerPair > 0)) continue;

    // An override belongs to one person; a stage rate to one stage; the older
    // factory rates to a category.
    if (rate.source === "Worker override") {
      if (rate.workerId !== lookup.workerId || rate.stage !== lookup.stage) continue;
    } else if (rate.source === "Production stage") {
      if (rate.stage !== lookup.stage) continue;
    } else if (rate.workerCategory !== lookup.workerCategory) {
      continue;
    }

    if (!best) {
      best = rate;
      continue;
    }

    const bestPriority = PRIORITY[best.source];
    const thisPriority = PRIORITY[rate.source];

    if (thisPriority !== bestPriority) {
      if (thisPriority < bestPriority) best = rate;
      continue;
    }

    // Same source: the most recent one that has already started.
    if (rate.effectiveFrom > best.effectiveFrom) best = rate;
  }

  return best;
}

/** What a day's work comes to at the rate that applies, ready to show. */
export function quoteWork(rates: FactoryRate[], lookup: RateLookup, pairs: number) {
  const rate = rateFor(rates, lookup);

  if (!rate) {
    return { rate: null, amount: 0, source: null as RateSource | null };
  }

  return {
    rate: rate.ratePerPair,
    amount: pieceWage(pairs, rate.ratePerPair),
    source: rate.source,
  };
}
