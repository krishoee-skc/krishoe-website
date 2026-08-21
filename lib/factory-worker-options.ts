/**
 * The stages and pay types a factory worker can be given.
 *
 * These were written out twice — once in the workers API, once in the workers
 * screen — and the two lists had already drifted. The screen was missing
 * "Fibermen", which is the stage five of this shop's eight workers actually
 * work in, so the dropdown could not offer the answer that was already in the
 * database. Anyone correcting a Fibermen worker's name would have had to change
 * their stage to something else to save the form.
 *
 * The database is the authority: factory_workers_category_check and
 * factory_workers_type_check name exactly these values, and a list that drifts
 * from them either offers something the write will reject or hides something
 * the shop is using. One list, imported by both sides, cannot drift.
 */
export const FACTORY_WORKER_CATEGORIES = [
  "Upper",
  "Fibermen",
  "Fiber Preparation",
  "Fiber Silai",
  "Bottom Final",
  "Packing / QC",
  "Staff",
] as const;

export const FACTORY_WORKER_TYPES = ["piece_rate", "monthly_staff", "daily_staff"] as const;

export type FactoryWorkerCategory = (typeof FACTORY_WORKER_CATEGORIES)[number];
export type FactoryWorkerType = (typeof FACTORY_WORKER_TYPES)[number];

/** What a pay type is called on screen. The stored values are snake_case. */
export const FACTORY_WORKER_TYPE_LABELS: Record<FactoryWorkerType, string> = {
  piece_rate: "जोडी अनुसार — piece rate",
  monthly_staff: "मासिक तलब — monthly",
  daily_staff: "दैनिक ज्याला — daily",
};
