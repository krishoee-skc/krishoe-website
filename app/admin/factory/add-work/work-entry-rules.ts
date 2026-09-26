import { compactSizeRun } from "@/lib/shoe-sizes";
import { stageNeedingUpperFirst } from "@/lib/stage-order";

/**
 * What the work-entry screen knows, separated from how it draws it.
 *
 * WorkEntryForm was one 1,431-line client component: the shapes it receives,
 * the amounts this shop counts in, the order Enter walks the boxes, and two
 * decisions about what is waiting on a shoe — all of it in the same file as
 * the markup. The whole of it was shipped to the phone as one chunk, and the
 * rules below, which are ordinary functions over plain data, could only be
 * read by reading past the form.
 *
 * Nothing here draws anything or touches React. It is the same code, in a file
 * that says what it is.
 */

export interface Worker {
  id: string;
  name: string;
  category: string;
  worker_type: string;
  today_pairs?: number;
  week_pairs?: number;
  week_earned?: number;
}

export interface Item {
  id: string;
  name: string;
  /** Uppers made for this shoe with no bottom on them yet, net of QC. */
  uppersWaiting: number;
  /** The same, split by the colour and size run they were made in. */
  waitingRuns: { colour: string; sizeRun: string; pairs: number }[];
  code: string | null;
  /** The sizes this shoe is made in. Empty when the item is not yet linked to
   *  a catalogue product, which is when the size runs are offered instead. */
  sizes: string[];
  production_item_id: string | null;
}

// The colours a shoe usually comes in, offered as one-tap chips so the same
// colour is spelled the same way every time. Anything else is still typed.
export const COMMON_COLOURS = [
  { en: "Black", ne: "कालो", hex: "#111111" },
  { en: "Blue", ne: "निलो", hex: "#2456c7" },
  { en: "Red", ne: "रातो", hex: "#c0392b" },
  { en: "Brown", ne: "खैरो", hex: "#8b5e3c" },
  { en: "White", ne: "सेतो", hex: "#e8e8e8" },
] as const;

// The sizes usually run, offered as toggle buttons that build the comma list.
// Sizes are no longer a fixed list — they come from the chosen item, or from
// the runs in lib/shoe-sizes when the item has none on file yet.

/** Where the pair count starts, and what it returns to after a save: every
 *  entry this shop has made is sixty pairs. */
export const DEFAULT_PAIRS = 60;
/** A size run is six sizes, so a dozen is two of each and sixty is half a case
 *  — the amounts this shop counts in. */
export const PAIRS_STEP = 12;

/**
 * The typed boxes Enter walks along, in the order the work is counted out.
 *
 * Only four, and only the ones that are typed. The worker, the stage, the
 * product and the lot are all chosen from lists — a dropdown answers Enter by
 * opening or closing itself, and taking that over would make choosing a worker
 * harder than it is now. The colour and size have buttons above them too; the
 * boxes here are the "or type it" ones beside those buttons.
 *
 * Rejected pairs comes last because it is usually left at zero: the walk ends
 * on the box most days do not need, which means most days the walk ends at the
 * size.
 */
export const WORK_WALK = ["pairs", "colour", "size", "rejected"] as const;
export type WorkField = (typeof WORK_WALK)[number];

/**
 * The colour and size to open the boxes with, given what is waiting.
 *
 * The option says "bachha sandil — 60 Black · 25-30" and then the boxes below
 * it open empty. That gap cost the owner sixty pairs: the uppers were made
 * 25–30, the bottom entry was typed 31–35, and the pairs could not be posted
 * until the size was corrected in the database by hand. The screen knew the
 * answer — it had just printed it.
 *
 * Only when there is exactly one run waiting. Two colours waiting is a real
 * choice, and filling one in would have to be noticed to be corrected, which
 * is worse than an empty box a person has to fill.
 *
 * The size goes in as it was recorded, not compacted: "36/41" is what the save
 * guard matches the uppers on, and the short form is only for reading.
 */
export function fillFromWaitingRun(
  runs: { colour: string; sizeRun: string; pairs: number }[],
  stage: string,
): { color: string; size: string } {
  const empty = { color: "", size: "" };

  // Upper work starts a shoe: nothing is waiting behind it, and the last run's
  // colour is not this run's answer.
  if (!stageNeedingUpperFirst(stage)) return empty;

  // A colour is what makes a run identifiable. Entries made before colour was
  // required have none, and "" in the box only looks like a filled field.
  const named = runs.filter((run) => run.colour.trim() && run.pairs > 0);
  if (named.length !== 1) return empty;

  return { color: named[0].colour, size: named[0].sizeRun };
}

/**
 * What is waiting on a shoe, said in words rather than one number.
 *
 * "60 uppers waiting" was the owner's own question back at us: sixty of which
 * colour? One run answers it outright. Several are listed, because the save
 * counts one run at a time — a total across colours would promise a hundred
 * and then warn at sixty, the option and the save disagreeing about the same
 * pairs on the same click.
 *
 * Capped at two named runs so the option stays one readable line on a phone;
 * beyond that the total carries it, and the colour chips below name the rest.
 *
 * Returns the counts only — "60 Black", "60 Black + 40 cherry", or a bare
 * total. The wording around them belongs in text(), where the English and
 * Nepali halves sit together and the language check can see them paired.
 */
export function waitingCounts(
  runs: { colour: string; sizeRun: string; pairs: number }[],
  total: number,
) {
  const named = runs.filter((run) => run.colour);

  // One or two runs are named — "60 Black · 36-41". Beyond that the line stops
  // fitting a phone, so the total carries it and the colour chips below the box
  // name the rest.
  if (named.length === 0 || named.length > 2) return String(total);

  // The size is what the owner's bachha sandil entry needed and did not have:
  // its uppers were recorded 31–35 when they were made 25–30, and the screen
  // where the bottom work is chosen could not show it.
  //
  // Compacted, because spelled out it does not fit — "25, 26, 27, 28, 29, 30"
  // is 22 characters against a phone's 38 for the whole label, and "25-30" is
  // five. Two runs name the size only when they share one, which is the case
  // where naming it twice would say the same thing twice and overflow anyway.
  const sizes = new Set(named.map((run) => compactSizeRun(run.sizeRun)).filter(Boolean));
  const shared = sizes.size === 1 ? [...sizes][0] : "";

  const colours = named.map((run) => `${run.pairs} ${run.colour}`).join(" + ");
  return shared ? `${colours} · ${shared}` : colours;
}
