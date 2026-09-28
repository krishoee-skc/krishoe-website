"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ADMIN_SEARCH_LABELS, type AdminSearchHit, type AdminSearchKind } from "@/lib/admin-search";
import { useLanguage } from "@/components/LanguageProvider";

const RECENT_KEY = "krishoe:recent-searches";
const RECENT_LIMIT = 5;

/**
 * The two things the box offers before anything is typed. The owner chose
 * these two (2026-09-28): a list of every page read as clutter, and any page
 * is still found by typing its name.
 */
const SHORTCUTS = [
  { icon: "📝", en: "Add work", ne: "काम टिप्ने", href: "/admin/factory/add-work" },
  { icon: "🧾", en: "Cut a bill", ne: "बिल काट्ने", href: "/admin/pos" },
] as const;

/**
 * What can be done with a found thing straight away, beside opening it.
 *
 * Finding a worker used to mean opening their ledger and then going to Add
 * work to enter their day; the shortcut is the one the owner takes next.
 */
const KIND_ACTIONS: Partial<Record<AdminSearchKind, { en: string; ne: string; href: string }[]>> = {
  worker: [{ en: "Add work", ne: "काम टिप्ने", href: "/admin/factory/add-work" }],
  factoryItem: [
    { en: "Add work", ne: "काम टिप्ने", href: "/admin/factory/add-work" },
    { en: "Cost", ne: "लागत", href: "/admin/operations/production-accounts/lots" },
  ],
  product: [
    { en: "Cut a bill", ne: "बिल काट्ने", href: "/admin/pos" },
    { en: "Stock", ne: "स्टक", href: "/admin/stock" },
  ],
  customer: [{ en: "Dues", ne: "बाँकी", href: "/admin/dues" }],
};

function readRecent(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((entry) => typeof entry === "string").slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function rememberSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  try {
    const next = [trimmed, ...readRecent().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(0, RECENT_LIMIT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // A private window or blocked storage: nothing is remembered, and nothing breaks.
  }
}

/**
 * Results while you type.
 *
 * Debounced rather than fired per keystroke, because each request asks seven
 * tables. Every response is stamped with the query it answered, so a slow
 * reply for "an" cannot land after a fast one for "ankus".
 *
 * Before anything is typed it offers the last few searches and two shortcuts,
 * Add work and Cut a bill — nothing else. Typed, the results come in a group
 * per kind (workers, shoes, bills, pages…), each with the next step beside it,
 * and ↑ ↓ Enter walk and open them without the mouse.
 */
export default function SearchAsYouType({
  initialQuery = "",
  onNavigate,
}: {
  initialQuery?: string;
  /** Called when Enter opens a result, so an overlay around the box can close. */
  onNavigate?: () => void;
}) {
  const { language, text } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<AdminSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const latest = useRef("");

  useEffect(() => {
    const id = window.setTimeout(() => setRecent(readRecent()), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    latest.current = trimmed;

    // An empty box asks for nothing: it shows the shortcuts, not a list.
    if (!trimmed) {
      const clear = window.setTimeout(() => {
        setHits([]);
        setBusy(false);
        setFailed(false);
      }, 0);
      return () => window.clearTimeout(clear);
    }

    const id = window.setTimeout(async () => {
      setBusy(true);
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`, {
          cache: "no-store",
        });
        const data = await response.json();
        // Ignore anything that answers a query the box has moved on from.
        if (latest.current !== trimmed) return;
        if (!response.ok) throw new Error(data.error || "Search failed");
        setHits((data.hits || []) as AdminSearchHit[]);
        setSelected(0);
        setFailed(false);
      } catch {
        if (latest.current === trimmed) setFailed(true);
      } finally {
        if (latest.current === trimmed) setBusy(false);
      }
    }, 220);

    return () => window.clearTimeout(id);
  }, [query]);

  const trimmed = query.trim();
  const pick = (value: { title: string; titleEn?: string }) =>
    language === "en" ? value.titleEn ?? value.title : value.title;
  const detailOf = (hit: AdminSearchHit) => (language === "en" ? hit.detailEn ?? hit.detail : hit.detail);

  // Typed: one group per kind, in the order the ranking first reached it.
  const kinds = [...new Set(hits.map((hit) => hit.kind))];
  const ordered = trimmed ? kinds.flatMap((kind) => hits.filter((hit) => hit.kind === kind)) : [];

  const open = (href: string) => {
    rememberSearch(query);
    onNavigate?.();
    router.push(href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!trimmed || ordered.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((index) => Math.min(ordered.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = ordered[selected];
      if (hit) open(hit.href);
    }
  };

  return (
    <div>
      <div className="relative">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={text(
            "A worker, a shoe, a customer, a bill number, or a page…",
            "कामदार, जुत्ता, ग्राहक, बिल नम्बर, वा पेजको नाम…",
          )}
          aria-label={text("Search", "खोज्नुहोस्")}
          className="min-h-14 w-full rounded-xl border-2 border-brand-gold/60 bg-brand-paper px-4 pr-12 text-lg font-semibold text-brand-green-ink outline-none focus:border-brand-green"
        />
        {trimmed ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={text("Clear", "मेट्ने")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl leading-none text-brand-muted-soft hover:text-brand-muted-deep"
          >
            ×
          </button>
        ) : null}
      </div>

      {!trimmed && recent.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-brand-muted">{text("Recent:", "हालै खोजेको:")}</span>
          {recent.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setQuery(entry)}
              className="min-h-8 rounded-full border border-brand-green-line px-3 text-xs font-bold text-brand-green-ink hover:border-brand-green"
            >
              {entry}
            </button>
          ))}
        </div>
      ) : null}

      {!trimmed ? (
        /* Nothing typed: the two shortcuts, and a line on what to type. */
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2">
            {SHORTCUTS.map((shortcut) => (
              <Link
                key={shortcut.href}
                href={shortcut.href}
                className="flex min-h-14 items-center gap-2 rounded-xl border border-brand-green-line bg-brand-paper px-4 text-base font-black text-brand-green-ink transition hover:border-brand-green hover:bg-brand-mist"
              >
                <span aria-hidden="true">{shortcut.icon}</span>
                {text(shortcut.en, shortcut.ne)}
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-brand-muted">
            {text(
              "Type a worker, a shoe, a customer, a bill number — or any page's name.",
              "कामदार, जुत्ता, ग्राहक, बिल नम्बर — वा कुनै पनि पेजको नाम टाइप गर्नुहोस्।",
            )}
          </p>
        </div>
      ) : failed ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {text("The search failed. Type it again.", "खोज्न सकिएन। फेरि टाइप गर्नुहोस्।")}
        </p>
      ) : hits.length === 0 ? (
        <p className="mt-4 rounded-xl border border-brand-green-line bg-brand-paper px-4 py-3 text-sm text-brand-muted">
          {busy
            ? text("Looking…", "हेर्दैछौँ…")
            : text(`Nothing found for “${trimmed}”.`, `“${trimmed}” भन्ने केही भेटिएन।`)}
        </p>
      ) : (
        /* Typed: a group per kind, each result with its next step. */
        <div className="mt-4 grid gap-3">
          {kinds.map((kind) => {
            const mark = ADMIN_SEARCH_LABELS[kind];
            return (
              <section key={kind}>
                <h3 className="mb-1 text-xs font-black uppercase tracking-wider text-brand-muted">
                  {mark.icon} {language === "en" ? mark.labelEn : mark.label}
                </h3>
                <ul className="divide-y divide-brand-green-line overflow-hidden rounded-xl border border-brand-green-line bg-brand-paper">
                  {hits
                    .filter((hit) => hit.kind === kind)
                    .map((hit) => {
                      const index = ordered.indexOf(hit);
                      const actions = KIND_ACTIONS[hit.kind] ?? [];
                      return (
                        <li
                          key={`${hit.kind}-${hit.href}-${hit.title}`}
                          className={`flex flex-wrap items-center gap-2 px-3 py-2 ${index === selected ? "bg-brand-green-wash" : ""}`}
                        >
                          <Link
                            href={hit.href}
                            onClick={() => rememberSearch(query)}
                            className="min-w-0 flex-1 rounded-md py-1 hover:text-brand-green"
                          >
                            <span className="block truncate font-bold text-brand-green-ink">{pick(hit)}</span>
                            <span className="block truncate text-xs text-brand-muted">{detailOf(hit)}</span>
                          </Link>
                          {actions.map((action) => (
                            <Link
                              key={action.href + action.en}
                              href={action.href}
                              onClick={() => rememberSearch(query)}
                              className="min-h-8 shrink-0 rounded-lg border border-brand-green px-2.5 py-1 text-xs font-black text-brand-green hover:bg-brand-green hover:text-white"
                            >
                              {text(action.en, action.ne)}
                            </Link>
                          ))}
                        </li>
                      );
                    })}
                </ul>
              </section>
            );
          })}
          <p className="text-xs text-brand-muted">
            {text("↑ ↓ to choose · Enter to open", "↑ ↓ छान्ने · Enter खोल्ने")}
          </p>
        </div>
      )}
    </div>
  );
}
