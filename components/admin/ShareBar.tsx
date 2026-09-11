import type { ReactNode } from "react";

/**
 * A row of numbers drawn as one bar, so a share is a glance.
 *
 * Two shapes, one component, because they are the same picture:
 *
 *  - `layout="stack"` — part-to-whole. One bar cut into its parts, with every
 *    part named and counted underneath, including the parts that are still
 *    zero. That last detail is the whole point: the factory's 420 pairs are all
 *    at the first of four stages, and a chart that drew only the filled segment
 *    would say "one stage, all done" rather than "nothing has moved yet".
 *
 *  - `layout="rows"` — magnitude. One line per thing, longest first, each with
 *    its name and number. This replaces the donut a pie chart would want to be:
 *    a donut cannot separate seven values that are all 60, and these labels can.
 *
 * The greens are one hue, light to dark, checked with the dataviz validator
 * against both the light and the dark surface — the first ramp tried failed its
 * light end and was re-stepped. Colour is never the only channel: every row and
 * every segment carries its name and its number as text.
 */
export type Share = {
  /** Shown as given — already translated by the caller. */
  label: ReactNode;
  value: number;
  /** A short right-hand note, e.g. a wage or a percentage. */
  hint?: ReactNode;
};

/** Brand green, light → dark. Darkest means most. */
const RAMP = ["#7FBC9E", "#5CA383", "#2F8261", "#12634A"];

function shade(index: number, count: number) {
  if (count <= 1) return RAMP[RAMP.length - 1];
  // Most-first input, so the first row takes the darkest step.
  const step = Math.round((index / (count - 1)) * (RAMP.length - 1));
  return RAMP[RAMP.length - 1 - step];
}

export default function ShareBar({
  rows,
  layout = "rows",
  emptyLabel,
}: {
  rows: Share[];
  layout?: "rows" | "stack";
  /** Shown instead of the bar when every value is zero. */
  emptyLabel?: ReactNode;
}) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);

  if (rows.length === 0 || total <= 0) {
    return (
      <p className="rounded-xl bg-brand-mist px-4 py-6 text-center text-xs font-semibold text-brand-muted">
        {emptyLabel ?? "Nothing to show yet."}
      </p>
    );
  }

  if (layout === "stack") {
    return (
      <div>
        {/* 2px gaps in the surface colour separate the segments — a gap, not a
            border, so no extra ink is added to the data. */}
        <div className="flex h-7 gap-0.5 overflow-hidden rounded-lg">
          {rows.map((row, index) => {
            const share = (Math.max(0, row.value) / total) * 100;
            if (share <= 0) return null;
            return (
              <span
                key={index}
                className="h-full first:rounded-l-lg last:rounded-r-lg"
                style={{ width: `${share}%`, background: shade(index, rows.length) }}
              />
            );
          })}
        </div>

        {/* Every part named, including the empty ones. */}
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
          {rows.map((row, index) => {
            const on = row.value > 0;
            return (
              <div key={index}>
                <span
                  className="block h-1 rounded-full"
                  style={{ background: on ? shade(index, rows.length) : "var(--stack-empty,#E4DFD5)" }}
                />
                <p
                  className={`mt-1.5 text-[11px] font-bold leading-4 ${
                    on ? "text-brand-green-ink" : "text-brand-muted"
                  }`}
                >
                  {row.label}
                </p>
                <p
                  className={`text-sm font-black tabular-nums leading-5 ${
                    on ? "text-brand-green" : "text-brand-muted"
                  }`}
                >
                  {row.value.toLocaleString("en-IN")}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const most = Math.max(...rows.map((row) => Math.max(0, row.value)));

  return (
    <div className="grid gap-2.5">
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
          <p className="truncate text-xs font-semibold text-brand-green-ink">{row.label}</p>
          <span className="h-4 rounded bg-brand-mist">
            <span
              className="block h-4 rounded-r"
              style={{
                width: `${most > 0 ? (Math.max(0, row.value) / most) * 100 : 0}%`,
                background: shade(index, rows.length),
              }}
            />
          </span>
          <p className="min-w-[3rem] text-right text-xs font-bold tabular-nums text-brand-muted">
            {row.hint ?? row.value.toLocaleString("en-IN")}
          </p>
        </div>
      ))}
    </div>
  );
}
