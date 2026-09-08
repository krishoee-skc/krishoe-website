/**
 * Which production stage a worker's category means.
 *
 * A worker is filed under a category — Upper, Fibermen — and the wage rates are
 * filed by stage. The two are the same idea under two names, and this is the
 * one translation between them.
 *
 * It lives apart from lib/factory-mutations, which opens a database connection:
 * the work-entry screen needs this mapping in the browser to price a day's work
 * before it is saved, and must not drag a connection pool along to get it.
 */

/**
 * The fiber men are the bottom men — one job the workshop calls by two names.
 * "Fibermen" is what the records say, because that is how eleven workers were
 * filed, and "Fiber Preparation" is what the production ledger calls the same
 * stage. Both arrive here and both mean the same work.
 */
const STAGE_BY_CATEGORY: Record<string, string> = {
  Upper: "Upper",
  Fibermen: "Fiber Preparation",
  "Fiber Preparation": "Fiber Preparation",
  "Fiber Silai": "Fiber Silai",
  "Bottom Final": "Bottom Final",
  // The quality pass has its own rate, so it needs a stage of its own to look
  // one up by. Without this, work entered against QC found no rate at all and
  // the amount came out blank.
  "Packing / QC": "Packing / QC",
};

export function productionStageForFactoryCategory(category: string): string | null {
  return STAGE_BY_CATEGORY[category] ?? null;
}
