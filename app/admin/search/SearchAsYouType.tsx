"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ADMIN_SEARCH_LABELS, type AdminSearchHit } from "@/lib/admin-search";

/**
 * Results while you type.
 *
 * The old screen was a form: type, press Search, wait for the page to render
 * again. The owner typed "ank", read the same hint that had been there before,
 * and reported the search as broken — a fair reading of a box that shows
 * nothing until a button nobody mentioned is pressed.
 *
 * Debounced rather than fired per keystroke, because each request asks seven
 * tables. 220ms is below what reads as lag and above the gap between letters.
 *
 * Every response is stamped with the query it answered. Without that, a slow
 * reply for "an" can land after a fast one for "ankus" and leave the wrong
 * results under the right text.
 */
export default function SearchAsYouType() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AdminSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef("");

  useEffect(() => {
    const trimmed = query.trim();
    latest.current = trimmed;

    // No pause on the very first load: the screens are what an empty box
    // offers, and they should already be there when it is opened.
    const wait = trimmed ? 220 : 0;
    const id = window.setTimeout(async () => {
      setBusy(true);
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`, {
          cache: "no-store",
        });
        const data = await response.json();
        // Ignore anything that answers a query the box has moved on from.
        if (latest.current !== trimmed) return;
        if (!response.ok) throw new Error(data.error || "खोज्न सकिएन।");
        setHits((data.hits || []) as AdminSearchHit[]);
        setFailed(false);
      } catch {
        if (latest.current === trimmed) setFailed(true);
      } finally {
        if (latest.current === trimmed) setBusy(false);
      }
    }, wait);

    return () => window.clearTimeout(id);
  }, [query]);

  const trimmed = query.trim();

  return (
    <div>
      <div className="relative mt-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="कामदार, सामान, ग्राहक, बिल, वा पानाको नाम…"
          aria-label="खोज्नुहोस्"
          className="min-h-14 w-full rounded-xl border-2 border-brand-gold/60 bg-white px-4 pr-12 text-lg font-semibold text-brand-green-ink outline-none focus:border-brand-green"
        />
        {trimmed ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="मेट्ने"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl leading-none text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        ) : null}
      </div>

      {failed ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          खोज्न सकिएन। फेरि टाइप गर्नुहोस्।
        </p>
      ) : hits.length === 0 ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {/* "" भन्ने केही भेटिएन would flash in the moment before the first
              answer arrives, which reads as a broken box on the screen someone
              just opened. */}
          {busy || !trimmed ? "हेर्दैछौँ…" : `“${trimmed}” भन्ने केही भेटिएन।`}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {hits.map((hit) => {
            const mark = ADMIN_SEARCH_LABELS[hit.kind];
            return (
              <li key={`${hit.kind}-${hit.href}-${hit.title}`}>
                <Link
                  href={hit.href}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-brand-mist"
                >
                  <span aria-hidden className="text-xl">
                    {mark.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-brand-green-ink">{hit.title}</span>
                    <span className="block truncate text-xs text-slate-500">{hit.detail}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">
                    {mark.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
