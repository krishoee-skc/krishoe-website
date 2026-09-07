/**
 * Two names for one shoe.
 *
 * `designKey` deliberately refuses to guess: "bag open" and "T bag open" are
 * different strings and stay different designs, because a system that quietly
 * decides two spellings mean the same thing will one day merge two real
 * products. That refusal is right — and it is why the books can still split in
 * two without anything complaining.
 *
 * It happened. "bag open" and "T bag open" were one shoe kept in two piles, and
 * the split cost the owner a customer: the shop apologised for a pair it had.
 * The live warning added afterwards catches a product with no pool at all; it
 * cannot see two pools that are really one.
 *
 * So this looks for names that are *suspiciously* close and says so. It never
 * merges, renames, or deletes anything — every pair it finds is a question for
 * the owner, who knows whether two names are one shoe. The rule for acting on
 * an answer is unchanged: audit the movements, bills and orders first, then
 * merge (never blind-delete) the way "T bag open" was handled.
 */
import { designKey } from "@/lib/design-name";

export type DesignSource = "catalog" | "ready stock";

export type DesignRecord = {
  /** The name as it is written wherever it lives. */
  name: string;
  where: DesignSource;
  /** Pairs standing under this name, so the owner sees what is at stake. */
  pairs: number;
};

export type DriftReason =
  /** One is the whole of the other plus a word: "bag open" / "T bag open". */
  | "one name contains the other"
  /** The same words in a different order: "open bag" / "bag open". */
  | "same words, different order"
  /** Identical once spaces and punctuation are dropped: "bagopen" / "bag open". */
  | "same letters, spaced differently";

export type DesignDrift = {
  left: DesignRecord;
  right: DesignRecord;
  reason: DriftReason;
  /** Pairs sitting on both sides — what a split book is holding apart. */
  pairsAtStake: number;
};

/** Letters and digits only: "T-bag  open!" and "tbagopen" collapse to the same. */
function lettersOnly(value: string) {
  return designKey(value).replace(/[^a-z0-9ऀ-ॿ]/g, "");
}

function words(value: string) {
  return designKey(value).split(" ").filter(Boolean);
}

/**
 * Is one name the other with a word added at either end?
 *
 * Word-wise on purpose: "bag open" inside "T bag open" is a real relationship,
 * but "pen" inside "open" is a coincidence, and a plain substring test would
 * report it.
 */
function containsAsWords(outer: string[], inner: string[]) {
  if (inner.length === 0 || inner.length >= outer.length) return false;

  for (let start = 0; start + inner.length <= outer.length; start += 1) {
    if (inner.every((word, index) => outer[start + index] === word)) return true;
  }

  return false;
}

function sameWordsReordered(left: string[], right: string[]) {
  if (left.length !== right.length || left.length < 2) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((word, index) => word === sortedRight[index]);
}

function driftReason(left: string, right: string): DriftReason | null {
  const leftWords = words(left);
  const rightWords = words(right);

  // Identical names are not drift — they are one design, which is the point.
  if (designKey(left) === designKey(right)) return null;
  if (leftWords.length === 0 || rightWords.length === 0) return null;

  if (containsAsWords(leftWords, rightWords) || containsAsWords(rightWords, leftWords)) {
    return "one name contains the other";
  }

  if (sameWordsReordered(leftWords, rightWords)) {
    return "same words, different order";
  }

  const leftLetters = lettersOnly(left);
  if (leftLetters.length >= 4 && leftLetters === lettersOnly(right)) {
    return "same letters, spaced differently";
  }

  return null;
}

/**
 * Every pair of names close enough to be worth a second look, the ones holding
 * the most pairs first — those are where a split book costs a sale.
 *
 * Records that are already the same design are folded together first, so a
 * product and its ready-stock pool sharing a name are not reported as a find.
 */
export function findDesignDrift(records: DesignRecord[]): DesignDrift[] {
  // One entry per distinct name, carrying the pairs from everywhere it appears.
  const byKey = new Map<string, DesignRecord>();

  for (const record of records) {
    const key = designKey(record.name);
    if (!key) continue;

    const existing = byKey.get(key);
    if (existing) {
      existing.pairs += Math.max(0, record.pairs);
      continue;
    }

    byKey.set(key, { name: record.name.trim(), where: record.where, pairs: Math.max(0, record.pairs) });
  }

  const entries = [...byKey.values()];
  const found: DesignDrift[] = [];

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const reason = driftReason(entries[i].name, entries[j].name);
      if (!reason) continue;

      found.push({
        left: entries[i],
        right: entries[j],
        reason,
        pairsAtStake: entries[i].pairs + entries[j].pairs,
      });
    }
  }

  return found.sort(
    (first, second) =>
      second.pairsAtStake - first.pairsAtStake ||
      first.left.name.localeCompare(second.left.name),
  );
}
