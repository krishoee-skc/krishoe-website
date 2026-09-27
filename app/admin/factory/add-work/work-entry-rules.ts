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
  /** The colour and size of the last work entered on this shoe, offered first
   *  (★) so the usual answer is one tap. Empty when nothing was entered yet. */
  lastColour?: string;
  lastSize?: string;
}

// The colours this factory actually makes, in the owner's own order, offered as
// one-tap chips so the same colour is spelled the same way every time. Blue and
// Brown were on the list and are rarely made; cream, cherry and gray are made
// all the time and were not. Anything else is still typed.
export const COMMON_COLOURS = [
  { en: "Cream", ne: "क्रिम", hex: "#efe3c8" },
  { en: "Cherry", ne: "चेरी", hex: "#7b1e2b" },
  { en: "Gray", ne: "खरानी", hex: "#8a8f94" },
  { en: "Black", ne: "कालो", hex: "#111111" },
  { en: "White", ne: "सेतो", hex: "#f4f4f4" },
  { en: "Red", ne: "रातो", hex: "#c0392b" },
] as const;

/**
 * The size runs this factory makes, one tap each.
 *
 * Kids 25–30, youth 31–35 and adult 36–41 were the only three, and the shop
 * also makes 21–25 and 36–40. Local to this screen: the three named runs in
 * lib/shoe-sizes also decide how other screens label a run, and those must not
 * move under them.
 */
export const WORK_SIZE_RUNS = [
  { from: 21, to: 25 },
  { from: 25, to: 30 },
  { from: 31, to: 35 },
  { from: 36, to: 40 },
  { from: 36, to: 41 },
] as const;

export const DEFAULT_PAIRS = 60;
/** A size run is six sizes, so a dozen is two of each and sixty is half a case
 *  — the amounts this shop counts in. */
export const PAIRS_STEP = 12;

/**
 * Every box Enter walks along, in the order the work is counted out, ending on
 * Save.
 *
 * It used to be the four typed boxes only, and the owner asked for Enter to do
 * Tab's job the whole way: the worker, the work and the shoe are the first
 * three things entered and Enter skipped all of them. A closed dropdown does
 * nothing with Enter in the browsers this shop uses, so taking Enter over there
 * costs nothing; an open one keeps Enter to pick its option.
 *
 * Save is the last stop. Enter on Save does not save straight away: it shows
 * what is about to be written and asks, and a second Enter confirms — so a
 * mis-hit never files a wrong wage, which is why Enter never saved before.
 */
export const WORK_WALK = ["worker", "stage", "item", "pairs", "colour", "size", "rejected", "save"] as const;
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
