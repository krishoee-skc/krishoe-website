"use client";

import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useToast } from "@/components/admin/ToastProvider";
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
  reject_pairs?: number | null;
};

type Choice = { id: string; name: string };

const FIELD = "min-h-11 w-full rounded-lg border border-brand-green-line bg-brand-paper px-2.5 text-sm text-brand-green-ink";

/**
 * What has been entered on the day being entered, beside the form.
 *
 * It lived on the piece ledger, a different screen, so a second entry of the
 * same sixty pairs was only found at the Saturday count. Here it is in view
 * while typing, with the total, and an entry that looks like the one on the
 * form is marked — the form asks before saving it twice.
 *
 * Since the app audit (owner, 2026-10-27) a mistake is mended here too, by the
 * owner: ✏️ changes the worker, the shoe, the colour, the size or the pairs —
 * the wage follows — and ↩ takes the entry back. Both go through the same
 * checks as the piece ledger (a reason, a closed month refuses, the entry stays
 * on record), so this is a shorter way to the same thing, not a second rule.
 */
export default function TodayEntries({
  entries,
  heading,
  looksLikeForm,
  fresh = null,
  canFix = false,
  workers = [],
  items = [],
  onChanged,
}: {
  entries: DayEntry[] | null;
  heading: string;
  /** Whether a row matches what is on the form now (a likely double entry). */
  looksLikeForm: (entry: DayEntry) => boolean;
  /** The entry just saved, marked "just now" (2026-10-04). */
  fresh?: { workerId: string; pairs: number } | null;
  /** The owner, who may fix or take back an entry from this list. */
  canFix?: boolean;
  workers?: Choice[];
  items?: Choice[];
  /** Read the day again after a fix. */
  onChanged?: () => void;
}) {
  const { text } = useLanguage();
  const toast = useToast();
  const live = (entries ?? []).filter((entry) => entry.status !== "reversed");
  const pairs = live.reduce((total, entry) => total + (Number(entry.pairs_count) || 0), 0);
  const wage = live.reduce((total, entry) => total + (Number(entry.amount_earned) || 0), 0);
  // The newest row of that worker and count — the one just saved.
  const freshId = fresh
    ? [...live].reverse().find((entry) => entry.worker_id === fresh.workerId && Number(entry.pairs_count) === fresh.pairs)?.id ?? null
    : null;

  // One row open at a time, either to fix or to take back.
  const [open, setOpen] = useState<{ id: string; mode: "fix" | "back" } | null>(null);
  const [form, setForm] = useState({ workerId: "", itemId: "", color: "", size: "", pairs: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function start(entry: DayEntry, mode: "fix" | "back") {
    setOpen({ id: entry.id, mode });
    setError("");
    setForm({
      workerId: entry.worker_id,
      itemId: entry.item_id,
      color: entry.color ?? "",
      size: entry.size ?? "",
      pairs: String(entry.pairs_count),
      reason: "",
    });
  }

  async function submit(entry: DayEntry) {
    if (!open) return;
    if (form.reason.trim().length < 5) {
      setError(text("Write why, in a few words — it stays on the entry.", "किन, केही शब्दमा लेख्नुहोस् — यो entry मै रहन्छ।"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res =
        open.mode === "fix"
          ? await fetch("/api/factory/ledger/edit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                work_id: entry.id,
                worker_id: form.workerId,
                item_id: form.itemId,
                color: form.color.trim(),
                size: form.size.trim(),
                pairs_count: Number(form.pairs) || entry.pairs_count,
                reject_pairs: entry.reject_pairs ?? 0,
                // Blank: the rate on file for the worker and the shoe now chosen.
                rate_per_pair: null,
                reason: form.reason.trim(),
              }),
            })
          : await fetch("/api/factory/ledger/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ work_id: entry.id, reason: form.reason.trim() }),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || text("That did not go through.", "भएन।"));
      toast.show(
        open.mode === "fix"
          ? text(`Fixed — wage now ${money(Number(data.amount_earned ?? 0))}`, `सच्चियो — ज्याला अब ${money(Number(data.amount_earned ?? 0))}`)
          : text("Taken back. It stays on the ledger, struck through.", "फिर्ता भयो। ledger मा काटिएर रहन्छ।"),
        "success",
      );
      setOpen(null);
      onChanged?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

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
            const isOpen = open?.id === entry.id;
            return (
              <li
                key={entry.id}
                className={`grid gap-2 py-2 text-sm ${isFresh ? "rounded-md bg-brand-green-wash px-2" : twin ? "rounded-md bg-amber-50 px-2" : ""}`}
              >
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-brand-green-ink">
                      {entry.worker_name}
                      {isFresh ? <span className="ms-1.5 rounded-full bg-brand-paper px-1.5 text-xs font-black text-brand-green">{text("just now", "भर्खर")}</span> : null}
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
                  <div className="flex shrink-0 items-start gap-2">
                    <div className="text-right">
                      <p className="font-black tabular-nums text-brand-green-ink">{entry.pairs_count}</p>
                      <p className="text-xs tabular-nums text-brand-muted">{money(entry.amount_earned)}</p>
                    </div>
                    {canFix ? (
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => (isOpen && open?.mode === "fix" ? setOpen(null) : start(entry, "fix"))}
                          aria-label={text(`Fix ${entry.worker_name}'s entry`, `${entry.worker_name} को entry सच्याउने`)}
                          title={text("Fix this entry", "यो entry सच्याउने")}
                          className="grid h-11 w-11 place-items-center rounded-lg border border-brand-green-line text-sm hover:border-brand-green"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => (isOpen && open?.mode === "back" ? setOpen(null) : start(entry, "back"))}
                          aria-label={text(`Take back ${entry.worker_name}'s entry`, `${entry.worker_name} को entry फिर्ता गर्ने`)}
                          title={text("Take this entry back", "यो entry फिर्ता गर्ने")}
                          className="grid h-11 w-11 place-items-center rounded-lg border border-brand-green-line text-sm hover:border-brand-clay"
                        >
                          ↩
                        </button>
                      </span>
                    ) : null}
                  </div>
                </div>

                {isOpen ? (
                  <div className="grid gap-2 rounded-lg border border-brand-green-line bg-brand-mist p-2.5">
                    {open?.mode === "fix" ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="grid gap-0.5 text-xs font-bold text-brand-muted">
                            {text("Worker", "कामदार")}
                            <select value={form.workerId} onChange={(event) => setForm((prev) => ({ ...prev, workerId: event.target.value }))} className={FIELD}>
                              {workers.map((worker) => (
                                <option key={worker.id} value={worker.id}>{worker.name}</option>
                              ))}
                            </select>
                          </label>
                          <label className="grid gap-0.5 text-xs font-bold text-brand-muted">
                            {text("Shoe", "जुत्ता")}
                            <select value={form.itemId} onChange={(event) => setForm((prev) => ({ ...prev, itemId: event.target.value }))} className={FIELD}>
                              {items.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <label className="grid gap-0.5 text-xs font-bold text-brand-muted">
                            {text("Colour", "रङ")}
                            <input value={form.color} onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))} className={FIELD} />
                          </label>
                          <label className="grid gap-0.5 text-xs font-bold text-brand-muted">
                            {text("Size", "साइज")}
                            <input value={form.size} onChange={(event) => setForm((prev) => ({ ...prev, size: event.target.value }))} className={FIELD} />
                          </label>
                          <label className="grid gap-0.5 text-xs font-bold text-brand-muted">
                            {text("Pairs", "जोडी")}
                            <input inputMode="numeric" value={form.pairs} onChange={(event) => setForm((prev) => ({ ...prev, pairs: event.target.value.replace(/\D/g, "") }))} className={FIELD} />
                          </label>
                        </div>
                        <p className="text-xs text-brand-muted">
                          {text(
                            "The rate on file for the worker and shoe chosen is used. A different kind of work: take it back and enter it again.",
                            "छानिएको कामदार र जुत्ताको दर लाग्छ। अर्कै किसिमको काम भए फिर्ता गरेर फेरि टिप्नुहोस्।",
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs font-bold text-brand-clay">
                        {text(
                          "Taking back stops this wage counting. The entry stays on the ledger, struck through.",
                          "फिर्ता गरेपछि यो ज्याला गनिँदैन। entry ledger मा काटिएर रहन्छ।",
                        )}
                      </p>
                    )}
                    <input
                      value={form.reason}
                      onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                      placeholder={open?.mode === "fix" ? text("Why? e.g. wrong worker", "किन? जस्तै कामदार गलत") : text("Why? e.g. entered twice", "किन? जस्तै दुई पटक टिपिएको")}
                      aria-label={text("Reason", "कारण")}
                      className={FIELD}
                    />
                    {error ? <p role="alert" className="text-xs font-bold text-brand-clay">{error}</p> : null}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void submit(entry)}
                        className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-black text-white disabled:opacity-60 ${open?.mode === "fix" ? "bg-brand-green" : "bg-brand-clay"}`}
                      >
                        {busy ? text("Saving…", "टिप्दै…") : open?.mode === "fix" ? text("Fix", "सच्याउने") : text("Take back", "फिर्ता गर्ने")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpen(null)}
                        className="min-h-11 rounded-lg border border-brand-green-line px-3 text-sm font-bold text-brand-green-ink"
                      >
                        {text("Cancel", "रद्द")}
                      </button>
                    </div>
                  </div>
                ) : null}
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
