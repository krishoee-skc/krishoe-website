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
export function productionStageForFactoryCategory(category: string): string | null {
  if (category === "Upper") return "Upper";
  if (category === "Fibermen" || category === "Fiber Preparation") return "Fiber Preparation";
  if (category === "Fiber Silai") return "Fiber Silai";
  if (category === "Bottom Final") return "Bottom Final";
  return null;
}
