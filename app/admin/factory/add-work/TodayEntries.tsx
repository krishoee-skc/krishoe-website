"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { money } from "@/lib/format-money";

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
}: {
  entries: DayEntry[] | null;
  heading: string;
  /** Whether a row matches what is on the form now (a likely double entry). */
  looksLikeForm: (entry: DayEntry) => boolean;
}) {
  const { text } = useLanguage();
  const live = (entries ?? []).filter((entry) => entry.status !== "reversed");
  const pairs = live.reduce((total, entry) => total + (Number(entry.pairs_count) || 0), 0);
  const wage = live.reduce((total, entry) => total + (Number(entry.amount_earned) || 0), 0);

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
            return (
              <li
                key={entry.id}
                className={`flex justify-between gap-3 py-2 text-sm ${twin ? "rounded-md bg-amber-50 px-2" : ""}`}
              >
                <div className="min-w-0">
                  <p className="truncate font-black text-brand-green-ink">{entry.worker_name}</p>
                  <p className="truncate text-xs text-brand-muted">
                    {[entry.item_name, entry.color, entry.size].filter(Boolean).join(" · ")}
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
