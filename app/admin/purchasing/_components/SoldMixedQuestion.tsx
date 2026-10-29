"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { shareEvenly } from "@/lib/counter-item-rules";

export type SoldMixedAnswer = { from: Record<string, string>; later: boolean };

/**
 * A shoe sold at the counter with its sizes not known (owner, 2026-10-29), now
 * on its purchase bill: which of the bill's sizes did those pairs go from?
 * Typed size by size, shared evenly in one press, or left to a count of the
 * shelf. The answer travels with the line; the server checks it again.
 */
export default function SoldMixedQuestion({
  index,
  mixedSold,
  billSizes,
  soldBySize,
  answer,
  onAnswer,
}: {
  index: number;
  mixedSold: number;
  billSizes: Record<string, number>;
  soldBySize: Record<string, number>;
  answer: SoldMixedAnswer;
  onAnswer: (answer: SoldMixedAnswer) => void;
}) {
  const { text } = useLanguage();
  const sizes = Object.keys(billSizes).sort((left, right) => Number(left) - Number(right) || left.localeCompare(right));
  const room = Object.fromEntries(sizes.map((size) => [size, Math.max(0, billSizes[size] - (soldBySize[size] ?? 0))]));
  const taken = sizes.reduce((sum, size) => sum + Math.max(0, Math.round(Number(answer.from[size]) || 0)), 0);
  const done = answer.later || taken === mixedSold;
  const payload = Object.fromEntries(
    sizes.map((size) => [size, Math.max(0, Math.round(Number(answer.from[size]) || 0))]).filter(([, pairs]) => Number(pairs) > 0),
  );

  return (
    <div className="mb-2 grid gap-2 rounded-xl border-2 border-brand-gold bg-brand-cream-soft p-3">
      <input type="hidden" name={`item${index}MixedFrom`} value={answer.later ? "" : JSON.stringify(payload)} />
      <input type="hidden" name={`item${index}MixedLater`} value={answer.later ? "1" : ""} />
      <div className="text-sm font-black text-brand-gold-ink">
        {text(
          `${mixedSold} pairs were sold before this bill, sizes not known. Which sizes did they go from?`,
          `यो बिलअघि साइज थाहा नभई ${mixedSold} जोडी बिकेको थियो। कुन साइजबाट गयो?`,
        )}
      </div>
      {sizes.length === 0 ? (
        <div className="text-sm font-bold text-brand-muted">
          {text("First type this bill's pairs by size, below.", "पहिले तल \"Pairs by size\" मा यो बिलका साइज लेख्नुहोस्।")}
        </div>
      ) : answer.later ? null : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
          {sizes.map((size) => (
            <label key={size} className="grid gap-0.5 text-center text-xs font-bold text-brand-muted">
              {size}
              <input
                value={answer.from[size] ?? ""}
                inputMode="numeric"
                data-enter-skip
                aria-label={text(`Sold from size ${size}`, `साइज ${size} बाट बिकेको`)}
                onChange={(event) => onAnswer({ later: false, from: { ...answer.from, [size]: event.target.value } })}
                className="h-11 w-full rounded-lg border border-brand-green-line bg-brand-paper px-2 text-center text-base font-bold text-brand-green-ink outline-none focus:border-brand-green"
              />
            </label>
          ))}
        </div>
      )}
      <div className={`text-sm font-black ${done ? "text-brand-green" : "text-brand-clay"}`}>
        {answer.later
          ? text("Left to a count of the shelf — the rest go in uncounted.", "पछि र्‍याक गनेर मिलाउने — बाँकी जोडी नगनिएको (Mixed) मा जान्छन्।")
          : done
            ? text(`${taken} of ${mixedSold} ✓`, `${mixedSold} मध्ये ${taken} ✓`)
            : text(`${taken} of ${mixedSold} so far`, `${mixedSold} मध्ये ${taken} भयो`)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={sizes.length === 0}
          onClick={() =>
            onAnswer({
              later: false,
              from: Object.fromEntries(Object.entries(shareEvenly(mixedSold, room)).map(([size, pairs]) => [size, String(pairs)])),
            })
          }
          className="min-h-10 rounded-full border border-brand-green px-3 text-sm font-black text-brand-green disabled:opacity-50"
        >
          {text("Share evenly", "बराबर बाँड्ने")}
        </button>
        <button
          type="button"
          aria-pressed={answer.later}
          onClick={() => onAnswer({ later: !answer.later, from: answer.from })}
          className={`min-h-10 rounded-full border px-3 text-sm font-black ${answer.later ? "border-brand-green bg-brand-green text-white" : "border-brand-green text-brand-green"}`}
        >
          {text("Count the shelf later", "पछि गन्ने")}
        </button>
      </div>
    </div>
  );
}
