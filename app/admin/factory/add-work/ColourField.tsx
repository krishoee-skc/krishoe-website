"use client";

import type { KeyboardEvent } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { colourKey } from "@/lib/colour-name";
import { CONTROL, LABEL } from "@/app/admin/factory/add-work/work-entry-styles";

/** One colour chip, as the form builds them: the factory's colours, the shoe's usual one starred. */
export type ColourChip = {
  key: string;
  value: string;
  label: string;
  hex: string;
  star: boolean;
  matches: string[];
  names: string[];
};

/**
 * Colour — required: rows of one item at one rate could not be told apart
 * afterwards without it. The chips are the colours this factory makes, the
 * shoe's usual one first (★).
 *
 * Split out of the work-entry form (2026-10-27); what it does is unchanged.
 * The form keeps the value, the Enter walk and where the cursor goes next.
 */
export default function ColourField({
  value,
  onChange,
  chips,
  registerBox,
  onKeyDown,
  onPick,
}: {
  value: string;
  onChange: (value: string) => void;
  chips: ColourChip[];
  /** Hands the box to the form's Enter walk. */
  registerBox: (element: HTMLInputElement | null) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** A chip pressed: the form sets the colour and moves the cursor on to Size. */
  onPick: (value: string) => void;
}) {
  const { text } = useLanguage();
  return (
    <div className="col-span-2 min-w-0">
      <label htmlFor="work-colour" className={LABEL}>🎨 {text("Colour", "रङ")}</label>
      <input
        id="work-colour"
        aria-label={text("Colour", "रङ")}
        ref={registerBox}
        enterKeyHint="next"
        onKeyDown={onKeyDown}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={text("Tap below or type a colour", "तल थिच्नुहोस् वा रङ लेख्नुहोस्")}
        className={CONTROL}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const active = chip.matches.includes(colourKey(value));
          return (
            <button
              key={chip.key}
              type="button"
              // Tab goes box to box; the chips are for a finger or the
              // mouse, and the box takes "cr" for Cream (audit, 2026-10-27).
              tabIndex={-1}
              // On to Size, so the next Enter carries on down the form; the
              // cursor left on the chip made Enter press the chip again
              // (owner, 2026-10-26).
              onClick={() => onPick(chip.value)}
              className={`press-dip inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-bold transition ${
                active
                  ? "border-brand-green bg-brand-green text-white"
                  : chip.star
                    ? "border-brand-gold bg-brand-gold/10 text-brand-green-ink"
                    : "border-brand-green-line text-brand-green-ink hover:border-brand-green"
              }`}
            >
              {chip.hex !== "transparent" ? (
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border border-black/15" style={{ background: chip.hex }} />
              ) : null}
              {chip.label}
              {chip.star ? <span aria-label={text("usual", "सधैँको")}> ★</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
