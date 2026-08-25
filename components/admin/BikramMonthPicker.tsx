"use client";

import { useMemo } from "react";
import { recentBikramMonths } from "@/lib/bikram-sambat";

/**
 * Pick a month the way the shop counts one.
 *
 * `<input type="month">` is the browser's own control and only speaks the
 * English calendar, so every screen that asked for a month asked for the wrong
 * one: wages are agreed by the Nepali month, and Bhadra runs 17 August to 17
 * September. Picking "August" gave half of Shrawan and half of Bhadra, and the
 * worker's own question — how much did I earn in Bhadra — had no answer.
 *
 * A list rather than a date field, because the months are named. Nobody should
 * have to convert 17 August in their head to ask about भाद्र.
 */
export default function BikramMonthPicker({
  value,
  onChange,
  label = "महिना",
  months = 14,
  className = "",
}: {
  value: string;
  onChange: (monthKey: string) => void;
  label?: string;
  months?: number;
  className?: string;
}) {
  // Computed once: the list only changes when the Nepali month turns over, and
  // a screen open across midnight on gate 1 is not worth a subscription.
  const options = useMemo(() => recentBikramMonths(months), [months]);

  return (
    <label className={`grid gap-1 ${className}`}>
      <span className="text-sm font-medium text-brand-green-ink">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full rounded-lg border border-brand-green-line bg-brand-paper px-3 py-2 text-brand-green-ink"
      >
        {/* A month with no option would render blank and read as broken; this
            only happens if the conversion fails, which it does not in practice. */}
        {options.length === 0 ? <option value="">—</option> : null}
        {options.map((month) => (
          <option key={month.key} value={month.key}>
            {month.label}
          </option>
        ))}
      </select>
    </label>
  );
}
