import { designKey } from "@/lib/design-name";
import { looksLikeSameDesign } from "@/lib/design-drift";

/**
 * The rules for a new item added from the counter bill, kept pure so the
 * counter's form and the server read them the same way (owner, 2026-09-29).
 *
 * Four guards travel with the feature, because a quick way to add goods is
 * also a quick way to spoil the books:
 *  1. one shoe, one name — a close name is offered before a new one is made;
 *  2. a selling price below cost is questioned, retail or wholesale;
 *  3. an unknown cost stays "cost to come", never a profit;
 *  4. the pairs land at the shop (done where the stock is written).
 */

export const counterItemHows = ["old", "pending_bill", "factory"] as const;
export type CounterItemHow = (typeof counterItemHows)[number];

/** How the pairs are entered, by how they came. */
export const movementTypeForHow = {
  old: "Adjustment",
  pending_bill: "Purchase In",
  factory: "Production In",
} as const satisfies Record<CounterItemHow, string>;

/** At most this many pairs of one item from the counter; more is a typing slip. */
export const MAX_COUNTER_PAIRS = 2000;

/** Distance between two short strings, for a one- or two-letter slip. */
function editDistance(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 2) return 3;
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const kept = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = kept;
    }
  }
  return row[right.length];
}

/**
 * Names already on the books that read like the one typed — the same one
 * written another way ("bag open" / "T bag open"), or a slip of a letter or
 * two. An exact match is returned first.
 */
export function similarNames(typed: string, known: Iterable<string>, limit = 3) {
  const key = designKey(typed);
  if (key.length < 2) return [];
  const exact: string[] = [];
  const close: string[] = [];
  const seen = new Set<string>();
  for (const name of known) {
    const nameKey = designKey(name);
    if (!nameKey || seen.has(nameKey)) continue;
    seen.add(nameKey);
    if (nameKey === key) exact.push(name);
    else if (
      looksLikeSameDesign(typed, name) ||
      (key.length >= 5 && nameKey.length >= 5 && editDistance(key, nameKey) <= 2)
    ) {
      close.push(name);
    }
  }
  return [...exact, ...close].slice(0, limit);
}

/** Pairs per size, tidied: sizes trimmed, blanks and zeros dropped. */
export function tidySizes(rows: Array<{ size: string; pairs: number | string }>) {
  const sizes: Record<string, number> = {};
  for (const row of rows) {
    const size = String(row.size ?? "").trim();
    const pairs = Math.round(Number(row.pairs) || 0);
    if (!size || pairs <= 0) continue;
    sizes[size] = (sizes[size] ?? 0) + pairs;
  }
  return sizes;
}

export function totalPairs(sizes: Record<string, number>, pilePairs: number) {
  return Object.values(sizes).reduce((sum, pairs) => sum + pairs, 0) + Math.max(0, Math.round(pilePairs || 0));
}

/** A selling price below what one pair cost. No cost known is not a loss. */
export function sellsAtLoss(retailPrice: number, costPerPair: number) {
  return retailPrice > 0 && costPerPair > 0 && retailPrice < costPerPair;
}

/** The bill the item is added from. Its own price is the one that must be typed. */
export type CounterItemChannel = "Retail" | "Wholesale";

export type CounterItemDraft = {
  name: string;
  how: CounterItemHow;
  sizes: Record<string, number>;
  pilePairs: number;
  /** Rupees; may be 0 on a wholesale bill, where the wholesale price is the one asked. */
  retailPrice: number;
  /** Rupees; 0 when none. Needed on a wholesale bill, optional on a retail one. */
  wholesalePrice?: number;
  /** Retail when not said — the counter's first form. */
  channel?: CounterItemChannel;
  costPerPair: number;
  lossConfirmed: boolean;
  /** Least pairs a wholesale buyer takes; checked by counterItemDoubts. */
  minWholesaleQty?: number;
  /** The doubts above were looked at and the figures stand. */
  doubtsConfirmed?: boolean;
};

/**
 * The prices that sell below cost, retail and wholesale each — a wholesale
 * price under what a pair cost is a loss as much as a retail one (owner,
 * 2026-09-30). Empty when neither does, or the cost is not known.
 */
export function counterItemLosses(draft: Pick<CounterItemDraft, "retailPrice" | "wholesalePrice" | "costPerPair">) {
  const losses: Array<{ which: CounterItemChannel; gap: number }> = [];
  if (sellsAtLoss(draft.retailPrice, draft.costPerPair)) losses.push({ which: "Retail", gap: draft.costPerPair - draft.retailPrice });
  const wholesale = draft.wholesalePrice ?? 0;
  if (sellsAtLoss(wholesale, draft.costPerPair)) losses.push({ which: "Wholesale", gap: draft.costPerPair - wholesale });
  return losses;
}

/**
 * The kind a name reads as, so the form opens on it (owner, 2026-09-30): the
 * kind stood on "Ladies Sandals" whatever was typed. The words are the shop's
 * own — "hill" is a heeled sandal here ("bantu hill", "lose hill panja"), not
 * a party heel. Names are typed in Roman letters at the counter, so the words
 * are too. Null when nothing in the name says; the form keeps what it had.
 */
export function guessKind(name: string): string | null {
  const n = ` ${String(name ?? "").toLowerCase()} `;
  const has = (pattern: RegExp) => pattern.test(n);
  // A child's chappal or shoe has its own shelf now (owner, 2026-10-02).
  if (has(/kids?|school|baby|bachha/)) {
    if (has(/chappal|chapal|chhapal|slipp?ers?/)) return "kids-slippers";
    if (has(/\bshoes?\b|\bshose\b/)) return "kids-shoes";
    return "kids-collection";
  }
  if (has(/party|heel/)) return "party-heels";
  if (has(/chappal|chapal|chhapal|slipp?ers?/)) {
    return has(/gents|\bmens?\b|men's/) ? "mens-slippers" : "ladies-slippers";
  }
  // A lady's closed shoe, or her shoe, before her sandal (owner, 2026-10-02).
  if (has(/ladies|lady/) && has(/\bclosed?\b/)) return "ladies-close-shoes";
  if (has(/ladies|lady/) && has(/\bshoes?\b|\bshose\b/)) return "ladies-shoes";
  if (has(/ladies|lady|sandal|sandel|flat|putali|hill/)) return "ladies-sandals";
  if (has(/casual|sneaker|sports?/)) return "casual-shoes";
  if (has(/\bshoes?\b|\bshose\b|jeans/)) return "mens-shoes";
  if (has(/gents|\bmens?\b|men's/)) return "mens-collection";
  return null;
}

/**
 * Figures that read like a slip and are asked about before saving — KR-210
 * went in with a wholesale minimum of 77,766 pairs and a cost of Rs. 1, and a
 * bill was refused for it later (owner, 2026-09-30).
 */
export function counterItemDoubts(draft: {
  pairs: number;
  minWholesaleQty?: number;
  costPerPair: number;
  retailPrice: number;
  wholesalePrice?: number;
}) {
  const doubts: Array<{ en: string; ne: string }> = [];
  const min = Math.round(Number(draft.minWholesaleQty) || 0);
  if (min > 1 && (min > 100 || (draft.pairs > 0 && min > draft.pairs))) {
    const over = draft.pairs > 0 && min > draft.pairs;
    const more = over
      ? { en: `, more than the ${draft.pairs} being added`, ne: `, थपेको ${draft.pairs} जोडीभन्दा धेरै` }
      : { en: "", ne: "" };
    doubts.push({
      en: `A wholesale minimum of ${min} pairs${more.en}.`,
      ne: `थोकको न्यूनतम ${min} जोडी${more.ne}।`,
    });
  }
  const selling = Math.max(draft.retailPrice || 0, draft.wholesalePrice || 0);
  if (draft.costPerPair > 0 && selling > 0 && draft.costPerPair < selling * 0.1) {
    doubts.push({
      en: `A cost of Rs. ${draft.costPerPair} a pair against a price of Rs. ${selling}.`,
      ne: `एक जोडीको लागत रु. ${draft.costPerPair}, मूल्य रु. ${selling}।`,
    });
  }
  return doubts;
}

/** What the form still needs, in words; empty when it may be saved. */
export function counterItemProblem(draft: CounterItemDraft) {
  const pairs = totalPairs(draft.sizes, draft.pilePairs);
  if (!draft.name.trim()) return { en: "Type the item's name.", ne: "मालको नाम लेख्नुहोस्।" };
  if (!counterItemHows.includes(draft.how)) return { en: "Choose how it came.", ne: "कसरी आयो, छान्नुहोस्।" };
  if (pairs <= 0) return { en: "How many pairs are on the shelf?", ne: "र्‍याकमा कति जोडी छन्?" };
  if (pairs > MAX_COUNTER_PAIRS) return { en: `More than ${MAX_COUNTER_PAIRS} pairs — check the count.`, ne: `${MAX_COUNTER_PAIRS} भन्दा बढी जोडी — गन्ती फेरि हेर्नुहोस्।` };
  const wholesale = draft.wholesalePrice ?? 0;
  // The bill the form was opened from asks for its own price; the other is
  // optional (owner, 2026-09-30).
  if (draft.channel === "Wholesale") {
    if (!(wholesale > 0)) return { en: "Type the wholesale price.", ne: "थोक मूल्य लेख्नुहोस्।" };
  } else if (!(draft.retailPrice > 0)) {
    return { en: "Type the selling price.", ne: "बेच्ने मूल्य लेख्नुहोस्।" };
  }
  if (draft.retailPrice < 0 || wholesale < 0) return { en: "A price cannot be below zero.", ne: "मूल्य शून्यभन्दा कम हुँदैन।" };
  if (draft.costPerPair < 0) return { en: "The cost cannot be below zero.", ne: "लागत शून्यभन्दा कम हुँदैन।" };
  const loss = counterItemLosses(draft)[0];
  if (loss && !draft.lossConfirmed) {
    return loss.which === "Wholesale"
      ? {
          en: `The wholesale price is Rs. ${loss.gap} below cost a pair — tick to confirm, or change the price.`,
          ne: `थोक मूल्यमा एक जोडीमा रु. ${loss.gap} घाटा — जानीजानी हो भने टिक गर्नुहोस्, नभए मूल्य सच्याउनुहोस्।`,
        }
      : {
          en: `Sells Rs. ${loss.gap} below cost a pair — tick to confirm, or change the price.`,
          ne: `एक जोडीमा रु. ${loss.gap} घाटा — जानीजानी हो भने टिक गर्नुहोस्, नभए मूल्य सच्याउनुहोस्।`,
        };
  }
  const doubts = counterItemDoubts({
    pairs,
    minWholesaleQty: draft.minWholesaleQty,
    costPerPair: draft.costPerPair,
    retailPrice: draft.retailPrice,
    wholesalePrice: wholesale,
  });
  if (doubts.length > 0 && !draft.doubtsConfirmed) {
    return {
      en: `${doubts.map((doubt) => doubt.en).join(" ")} Tick if these figures are right, or change them.`,
      ne: `${doubts.map((doubt) => doubt.ne).join(" ")} अंक ठीक हो भने टिक गर्नुहोस्, नभए सच्याउनुहोस्।`,
    };
  }
  return null;
}
