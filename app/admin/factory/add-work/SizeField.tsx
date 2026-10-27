"use client";

import type { KeyboardEvent } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { compactSizeRun, sizeRunKey } from "@/lib/shoe-sizes";
import { CONTROL, LABEL } from "@/app/admin/factory/add-work/work-entry-styles";

/**
 * Size — the runs this factory makes, the shoe's own first (★), and its single
 * sizes to tap one at a time. Anything else is typed: "21/25", "36, 38, 40".
 * Under them, "Sizes are not equal?" opens a box per size.
 *
 * Split out of the work-entry form (2026-10-27); what it does is unchanged.
 * The form keeps the value, the counts, the Enter walk and the cursor.
 */
export default function SizeField({
  value,
  onChange,
  registerBox,
  onKeyDown,
  runs,
  onPickRun,
  itemSizes,
  chosenSizes,
  onToggleSize,
  countableSizes,
  showSizeCounts,
  onOpenCounts,
  onCloseCounts,
  sizeCounts,
  onCount,
  countedPairs,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Hands the box to the form's Enter walk. */
  registerBox: (element: HTMLInputElement | null) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** The size runs as chips, the shoe's own starred. */
  runs: Array<{ value: string; star: boolean }>;
  /** A run pressed: the form sets it and moves on to Rejected. */
  onPickRun: (value: string) => void;
  /** The shoe's single sizes. */
  itemSizes: string[];
  chosenSizes: string[];
  onToggleSize: (size: string) => void;
  /** The sizes a box per size is drawn for. */
  countableSizes: string[];
  showSizeCounts: boolean;
  onOpenCounts: () => void;
  onCloseCounts: () => void;
  sizeCounts: Record<string, string>;
  onCount: (size: string, value: string) => void;
  countedPairs: number;
}) {
  const { text } = useLanguage();
  return (
    <div className="col-span-2 min-w-0">
      <label htmlFor="work-size" className={LABEL}>📏 {text("Size", "साइज")}</label>
      <input
        id="work-size"
        aria-label={text("Size", "साइज")}
        ref={registerBox}
        enterKeyHint="next"
        onKeyDown={onKeyDown}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={text("Tap below or type sizes (e.g. 21/25)", "तल थिच्नुहोस् वा साइज लेख्नुहोस् (जस्तै 21/25)")}
        className={CONTROL}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {runs.map((chip) => {
          const active = sizeRunKey(value) !== "" && sizeRunKey(value) === sizeRunKey(chip.value);
          return (
            <button
              key={`${chip.star ? "star" : "run"}:${sizeRunKey(chip.value)}`}
              type="button"
              tabIndex={-1}
              // A whole run is the size: on to Rejected. With the per-size
              // counts open, the cursor stays for them.
              onClick={() => onPickRun(chip.value)}
              className={`press-dip inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-black tabular-nums transition ${
                active
                  ? "border-brand-green bg-brand-green text-white"
                  : chip.star
                    ? "border-brand-gold bg-brand-gold/10 text-brand-green-ink"
                    : "border-brand-green-line text-brand-green-ink hover:border-brand-green"
              }`}
            >
              {compactSizeRun(chip.value).replace("-", "–")}
              {chip.star ? <span aria-label={text("this shoe's", "यो जुत्ताको")}> ★</span> : null}
            </button>
          );
        })}
      </div>
      {/* The shoe's single sizes, for a run that is not a whole run — "41"
          alone, or 36, 38 and 40. Each toggles in and out. */}
      {itemSizes.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {itemSizes.map((size) => {
            const active = chosenSizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                tabIndex={-1}
                onClick={() => onToggleSize(size)}
                className={`press-dip grid h-11 min-w-11 place-items-center rounded-md border px-1 text-sm font-black transition ${
                  active
                    ? "border-brand-green bg-brand-green text-white"
                    : "border-brand-green-line text-brand-muted hover:border-brand-green"
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      ) : null}
      {/* How many in each size, offered rather than imposed — most runs are
          even. */}
      {countableSizes.length > 1 ? (
        showSizeCounts ? (
          <div className="mt-3 rounded-xl border-2 border-brand-green bg-brand-green/5 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-brand-green-ink">
                {text("Pairs in each size", "कुन साइजको कति जोडी")}
              </span>
              <button
                type="button"
                onClick={onCloseCounts}
                className="press-dip rounded-lg border border-brand-green-line px-2.5 py-1 text-xs font-bold text-brand-green-ink transition hover:border-brand-green"
              >
                {text("Use one total", "जम्मा मात्र लेख्ने")}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {countableSizes.map((size) => (
                <label key={size} className="block">
                  <span className="block text-center text-xs font-bold text-brand-muted">
                    {size}
                  </span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    aria-label={text(`Pairs in size ${size}`, `साइज ${size} को जोडी`)}
                    value={sizeCounts[size] ?? ""}
                    onChange={(event) => onCount(size, event.target.value)}
                    className="min-h-11 w-full rounded-lg border-2 border-brand-green-line px-1 py-1 text-center text-lg font-black tabular-nums text-brand-green-ink focus:border-transparent focus:ring-2 focus:ring-brand-gold"
                  />
                </label>
              ))}
            </div>
            {/* The total, added up rather than asked for again. */}
            <p className="mt-2 text-sm font-black text-brand-green-ink">
              {text(
                `Total ${countedPairs} pairs — added up`,
                `जम्मा ${countedPairs} जोडी — आफैँ जोडिएको`,
              )}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenCounts}
            className="press-dip mt-2 inline-flex min-h-11 items-center rounded-lg border border-brand-green-line px-3 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
          >
            {text("Sizes are not equal?", "साइज बराबर छैन?")}
          </button>
        )
      ) : null}
    </div>
  );
}
