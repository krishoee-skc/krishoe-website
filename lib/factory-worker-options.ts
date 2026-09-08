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
/**
 * The three jobs this shop's shoes pass through, plus the quality check and
 * the salaried staff who are not on piece rate at all.
 *
 * Two more were offered once — Fiber Preparation and Bottom Final —
 * and never used: no worker filed under them, no work entry carrying them, no
 * rate set for them, checked against production before they were dropped. The
 * database still accepts them, so an old row could not be orphaned by this.
 */
export const FACTORY_WORKER_CATEGORIES = [
  "Upper",
  "Fibermen",
  "Fiber Silai",
  "Packing / QC",
  "Staff",
] as const;

/**
 * What each stage is called on screen.
 *
 * The stored value stays what the database check constraint names — those are
 * data, and renaming one would mean touching every worker filed under it. What
 * the shop *says* is another matter: the fiber men are the bottom men, one job
 * with two names on the workshop floor, and a dropdown that offers only one of
 * them leaves the other half of the shop guessing. So the label carries both.
 */
export const FACTORY_WORKER_CATEGORY_LABELS: Record<string, { en: string; ne: string }> = {
  Upper: { en: "Upper", ne: "अपर" },
  Fibermen: { en: "Fibermen (bottom men)", ne: "फाइबर / बटम" },
  "Fiber Silai": { en: "Fiber silai", ne: "फाइबर सिलाइ" },
  "Packing / QC": { en: "Packing / QC", ne: "प्याकिङ / QC" },
  Staff: { en: "Staff", ne: "कर्मचारी" },
};

/** The label for a stage, falling back to the stored value for anything older. */
export function factoryCategoryLabel(category: string, nepali: boolean) {
  const label = FACTORY_WORKER_CATEGORY_LABELS[category];
  if (!label) return category;
  return nepali ? label.ne : label.en;
}

export const FACTORY_WORKER_TYPES = ["piece_rate", "monthly_staff", "daily_staff"] as const;

export type FactoryWorkerCategory = (typeof FACTORY_WORKER_CATEGORIES)[number];
export type FactoryWorkerType = (typeof FACTORY_WORKER_TYPES)[number];

/** What a pay type is called on screen, each side in its own language so the
 *  English view stays English and the Nepali view Nepali. The stored values are
 *  snake_case. */
export const FACTORY_WORKER_TYPE_LABELS: Record<FactoryWorkerType, { en: string; ne: string }> = {
  piece_rate: { en: "Piece rate", ne: "जोडी अनुसार" },
  monthly_staff: { en: "Monthly", ne: "मासिक तलब" },
  daily_staff: { en: "Daily wage", ne: "दैनिक ज्याला" },
};
