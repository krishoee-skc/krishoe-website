"use client";

import NepaliDate from "nepali-date-converter";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A date field that speaks Bikram Sambat. The shop keeps its books in the Nepali
 * calendar, so a plain <input type="date"> — a Gregorian grid the browser draws
 * — meant reading one calendar and thinking in another. This shows a BS month
 * grid (भदौ २०८३, Nepali weekday and day numerals), and beneath it the AD date
 * in small print, so both are on screen and nobody has to convert in their head.
 *
 * The value in and out is always an AD "YYYY-MM-DD" string — the exact shape a
 * native date input uses — so callers, forms, the database and every existing
 * report keep storing AD and nothing downstream changes. Only the picking is in
 * BS. If a BS conversion ever throws (a date outside the library's range), the
 * field falls back to a plain native date input rather than breaking the form.
 */

const NP_MONTHS = [
  "बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
  "कात्तिक", "मंसिर", "पुष", "माघ", "फागुन", "चैत",
];
const NP_WEEKDAYS = ["आ", "सो", "मं", "बु", "बि", "शु", "श"];
const NP_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

function toNpDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => NP_DIGITS[Number(d)]);
}

/** AD "YYYY-MM-DD" → NepaliDate, or null if it cannot be represented. */
function adStringToNepali(adValue: string): NepaliDate | null {
  if (!adValue) return null;
  try {
    const [y, m, d] = adValue.split("-").map(Number);
    if (!y || !m || !d) return null;
    // Noon avoids any timezone slip pushing the day across midnight.
    return new NepaliDate(new Date(y, m - 1, d, 12, 0, 0));
  } catch {
    return null;
  }
}

/** NepaliDate → AD "YYYY-MM-DD". */
function nepaliToAdString(np: NepaliDate): string {
  const js = np.toJsDate();
  const y = js.getFullYear();
  const m = String(js.getMonth() + 1).padStart(2, "0");
  const d = String(js.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "2083/05/20" numeric BS label for the given AD string. */
function bsNumericLabel(adValue: string): string {
  const np = adStringToNepali(adValue);
  if (!np) return "";
  const y = np.getYear();
  const m = String(np.getMonth() + 1).padStart(2, "0");
  const d = String(np.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

export default function NepaliDateField({
  value,
  onChange,
  required,
  className,
  id,
  name,
}: {
  /** AD date, "YYYY-MM-DD". */
  value: string;
  /** Called with the new AD date, "YYYY-MM-DD". */
  onChange: (adValue: string) => void;
  required?: boolean;
  className?: string;
  id?: string;
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // The BS year/month the grid is showing. Follows the selected value; if none
  // is set yet, today.
  const selectedNp = useMemo(() => adStringToNepali(value), [value]);
  const [viewYear, setViewYear] = useState<number>(() =>
    (selectedNp ?? new NepaliDate()).getYear(),
  );
  const [viewMonth, setViewMonth] = useState<number>(() =>
    (selectedNp ?? new NepaliDate()).getMonth(),
  );

  // When the selected value changes from outside, point the grid at it. Done as
  // a render-time adjustment keyed on the AD string (React's sanctioned pattern)
  // rather than an effect, so it never triggers a cascading re-render.
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    if (selectedNp) {
      setViewYear(selectedNp.getYear());
      setViewMonth(selectedNp.getMonth());
    }
  }

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The days of the shown BS month, plus the weekday the 1st lands on. If the
  // library cannot build the month, we surface nothing and let the fallback show.
  const grid = useMemo(() => {
    try {
      const first = new NepaliDate(viewYear, viewMonth, 1);
      const startWeekday = first.getDay(); // 0 = Sunday
      // Walk forward until the month rolls over to find its length.
      let days = 32;
      for (let d = 28; d <= 32; d++) {
        try {
          const probe = new NepaliDate(viewYear, viewMonth, d);
          if (probe.getMonth() !== viewMonth) {
            days = d - 1;
            break;
          }
          days = d;
        } catch {
          days = d - 1;
          break;
        }
      }
      return { startWeekday, days };
    } catch {
      return null;
    }
  }, [viewYear, viewMonth]);

  const selectedKey = value; // AD string, for comparing the highlighted day
  const bsLabel = bsNumericLabel(value);

  // If BS conversion is impossible for the current value, fall back to a plain
  // native date input so the form still works.
  const conversionOk = !value || selectedNp !== null;
  if (!conversionOk || grid === null) {
    return (
      <input
        type="date"
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={className}
      />
    );
  }

  function pick(day: number) {
    try {
      const np = new NepaliDate(viewYear, viewMonth, day);
      onChange(nepaliToAdString(np));
      setOpen(false);
    } catch {
      /* out of range — ignore the tap */
    }
  }

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewYear(y);
    setViewMonth(m);
  }

  const cells: Array<number | null> = [];
  for (let i = 0; i < grid.startWeekday; i++) cells.push(null);
  for (let d = 1; d <= grid.days; d++) cells.push(d);

  return (
    <div ref={wrapRef} className="relative">
      {/* The field the owner taps. Shows the BS date, big; the AD date, small. */}
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        className={
          className ??
          "flex w-full min-h-12 items-center justify-between rounded-lg border border-brand-green-line px-3 py-2 text-left transition focus:border-transparent focus:ring-2 focus:ring-brand-gold"
        }
      >
        <span className="font-bold text-brand-green-ink">
          {bsLabel ? bsLabel : "मिति छान्नुहोस्"}
        </span>
        <span aria-hidden="true">📅</span>
      </button>
      {/* AD kept in the form as a real value, and shown small below. */}
      <input type="hidden" name={name} value={value} required={required} readOnly />
      {value ? <p className="mt-1 text-xs text-brand-muted">AD: {value}</p> : null}

      {open ? (
        <div className="absolute z-50 mt-1 w-72 rounded-xl border border-brand-green-line bg-brand-paper p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="rounded-lg px-2 py-1 text-brand-green-ink hover:bg-brand-green-wash"
            >
              ←
            </button>
            <span className="font-black text-brand-green-ink">
              {NP_MONTHS[viewMonth]} {toNpDigits(viewYear)}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="rounded-lg px-2 py-1 text-brand-green-ink hover:bg-brand-green-wash"
            >
              →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-black text-brand-muted-soft">
            {NP_WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <span key={`e${i}`} />;
              let isSelected = false;
              try {
                isSelected = nepaliToAdString(new NepaliDate(viewYear, viewMonth, day)) === selectedKey;
              } catch {
                isSelected = false;
              }
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  className={`rounded-lg py-1.5 text-sm font-bold transition ${
                    isSelected
                      ? "bg-brand-green text-white"
                      : "text-brand-green-ink hover:bg-brand-green-wash"
                  }`}
                >
                  {toNpDigits(day)}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-brand-green-line pt-2 text-xs">
            <button
              type="button"
              onClick={() => {
                const today = new NepaliDate();
                setViewYear(today.getYear());
                setViewMonth(today.getMonth());
                onChange(nepaliToAdString(today));
                setOpen(false);
              }}
              className="font-bold text-brand-green"
            >
              आज
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-brand-muted">
              बन्द
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
