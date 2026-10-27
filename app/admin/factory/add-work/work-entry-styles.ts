// Every box and button on the form the same height, so a row of four reads as
// one row. The owner's words: the boxes did not line up.
//
// Shared by the work-entry form and the parts split out of it (2026-10-27), so
// the colour and size boxes stay the height of the worker and pairs boxes.
export const CONTROL =
  "h-12 w-full min-w-0 rounded-lg border border-brand-green-line bg-brand-paper px-3 text-brand-green-ink focus:border-transparent focus:ring-2 focus:ring-brand-gold disabled:bg-brand-mist disabled:text-brand-muted";
export const LABEL = "mb-1.5 block truncate text-sm font-bold text-brand-green-ink";
export const HINT = "mt-1 min-h-5 text-xs text-brand-muted";
