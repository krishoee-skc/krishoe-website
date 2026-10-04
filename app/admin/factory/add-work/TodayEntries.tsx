"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { money } from "@/lib/format-money";
import { colourSwatch, compactSizes } from "@/lib/shoe-colour";

export type DayEntry = {
  id: string;
  worker_id: string;
  worker_name: string;
  item_id: string;
  item_name: string;
  color: string | null;
  size: string | null;
  stage?: string | null;
  pairs_count: number;
  amount_earned: number;
  status: string;
};

/**
 * What has been entered on the day being entered, beside the form.
 *
 * It lived on the piece ledger, a different screen, so a second entry of the
 * same sixty pairs was only found at the Saturday count. Here it is in view
 * while typing, with the total, and an entry that looks like the one on the
 * form is marked — the form asks before saving it twice.
 */
export default function TodayEntries({
  entries,
  heading,
  looksLikeForm,
  fresh = null,
}: {
  entries: DayEntry[] | null;
  heading: string;
  /** Whether a row matches what is on the form now (a likely double entry). */
  looksLikeForm: (entry: DayEntry) => boolean;
  /** The entry just saved, marked "just now" (2026-10-04). */
  fresh?: { workerId: string; pairs: number } | null;
}) {
  const { text } = useLanguage();
  const live = (entries ?? []).filter((entry) => entry.status !== "reversed");
  const pairs = live.reduce((total, entry) => total + (Number(entry.pairs_count) || 0), 0);
  const wage = live.reduce((total, entry) => total + (Number(entry.amount_earned) || 0), 0);
  // The newest row of that worker and count — the one just saved.
  const freshId = fresh
    ? [...live].reverse().find((entry) => entry.worker_id === fresh.workerId && Number(entry.pairs_count) === fresh.pairs)?.id ?? null
    : null;

  return (
    <aside
      aria-label={heading}
      className="mt-5 flex flex-col gap-2 self-start rounded-lg border border-brand-green-line bg-brand-paper p-4 lg:sticky lg:top-4 lg:mt-5"
    >
      <h2 className="text-base font-black text-brand-green-ink">{heading}</h2>
      {entries === null ? (
        <p className="text-sm text-brand-muted">{text("Looking…", "हेर्दैछौँ…")}</p>
      ) : live.length === 0 ? (
        <p className="text-sm text-brand-muted">{text("Nothing entered yet.", "अझै केही टिपिएको छैन।")}</p>
      ) : (
        <ul className="max-h-[60vh] divide-y divide-brand-green-line overflow-y-auto">
          {live.map((entry) => {
            const twin = looksLikeForm(entry);
            const isFresh = entry.id === freshId;
            return (
              <li
                key={entry.id}
                className={`flex justify-between gap-3 py-2 text-sm ${isFresh ? "rounded-md bg-brand-green-wash px-2" : twin ? "rounded-md bg-amber-50 px-2" : ""}`}
              >
                <div className="min-w-0">
                  <p className="truncate font-black text-brand-green-ink">
                    {entry.worker_name}
                    {isFresh ? <span className="ms-1.5 rounded-full bg-brand-paper px-1.5 text-[11px] font-black text-brand-green">{text("just now", "भर्खर")}</span> : null}
                  </p>
                  <p className="flex min-w-0 items-center gap-1 truncate text-xs text-brand-muted">
                    {entry.color && colourSwatch(entry.color) ? (
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/20" style={{ background: colourSwatch(entry.color) ?? undefined }} />
                    ) : null}
                    <span className="truncate">{[entry.item_name, entry.color, entry.size ? compactSizes(entry.size) : ""].filter(Boolean).join(" · ")}</span>
                  </p>
                  {twin ? (
                    <p className="text-xs font-bold text-amber-900">
                      {text("Same as the form", "फारमसँग उस्तै")}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-black tabular-nums text-brand-green-ink">{entry.pairs_count}</p>
                  <p className="text-xs tabular-nums text-brand-muted">{money(entry.amount_earned)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {live.length > 0 ? (
        <p className="flex justify-between border-t-2 border-brand-green-ink pt-2 text-sm font-black text-brand-green-ink">
          <span>{text("Total", "जम्मा")}</span>
          <span className="tabular-nums">
            {text(`${pairs} pairs`, `${pairs} जोडी`)} · {money(wage)}
          </span>
        </p>
      ) : null}
      <Link
        href="/admin/factory/ledger"
        className="text-xs font-bold text-brand-green underline-offset-2 hover:underline"
      >
        {text("A mistake? Correct it in the piece ledger →", "गल्ती भयो? Piece ledger मा सच्याउनुहोस् →")}
      </Link>
    </aside>
  );
}
