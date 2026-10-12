"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { COMMON_COLOURS, PAIRS_STEP, WORK_SIZE_RUNS } from "@/app/admin/factory/add-work/work-entry-rules";
import { sizesInRun } from "@/lib/shoe-sizes";
import { writeWorkAction, type WriteReply } from "./actions";

export type WriteItem = { id: string; name: string; colors: string[]; lastSize: string };
export type LastWritten = { itemId: string; color: string; size: string; pairs: number } | null;

const runValue = (run: { from: number; to: number }) => sizesInRun(run).join(", ");
/** "36, 37, 38, 39, 40" → "36–40", the way a worker says it. */
function shortSize(size: string) {
  const parts = size.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 2 ? `${parts[0]}–${parts[parts.length - 1]}` : parts.join(", ");
}

const chip = (on: boolean) =>
  `min-h-12 rounded-full border-2 px-4 text-base font-black ${on ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"}`;

/**
 * The worker writes the day's work (owner, 2026-10-13, "क"): the shoe, the
 * colour, the size and how many pairs, in big taps — the shoe's usual colour
 * and size offered first. It goes to the owner, who ✓s it; the books change
 * only then. The button says what is still missing, rather than going grey.
 */
export default function WorkerWriteForm({ items, last }: { items: WriteItem[]; last: LastWritten }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [itemId, setItemId] = useState(last?.itemId && items.some((item) => item.id === last.itemId) ? last.itemId : "");
  const [color, setColor] = useState(itemId ? last?.color ?? "" : "");
  const [size, setSize] = useState(itemId ? last?.size ?? "" : "");
  const [pairs, setPairs] = useState(0);
  const [day, setDay] = useState<"today" | "yesterday">("today");
  const [note, setNote] = useState("");
  const [reply, setReply] = useState<WriteReply | null>(null);

  const item = items.find((entry) => entry.id === itemId);
  const colours = [...new Set([...(item?.colors ?? []), ...COMMON_COLOURS.map((colour) => colour.en)])];
  const runs = [...new Set([item?.lastSize, ...WORK_SIZE_RUNS.map(runValue)].filter((value): value is string => Boolean(value)))];

  function chooseItem(id: string) {
    const next = items.find((entry) => entry.id === id);
    setItemId(id);
    setColor(next?.colors[0] ?? "");
    setSize(next?.lastSize ?? "");
    setReply(null);
  }

  const missing = !itemId ? "पहिले जुत्ता छान्नुहोस्" : !color.trim() ? "रङ छान्नुहोस्" : !size.trim() ? "साइज छान्नुहोस्" : pairs <= 0 ? "कति जोडी, लेख्नुहोस्" : "";

  function send() {
    if (missing) return;
    setReply(null);
    start(async () => {
      const result = await writeWorkAction({ itemId, color, size, pairs, day, note });
      setReply(result);
      if (result.ok) {
        setPairs(0);
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-5">
      <label className="grid gap-2 text-lg font-black">
        👟 कुन जुत्ता?
        <select value={itemId} onChange={(event) => chooseItem(event.target.value)} className="min-h-14 rounded-2xl border-2 border-brand-green-line bg-brand-paper px-4 text-lg">
          <option value="">— छान्नुहोस् —</option>
          {items.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.name}</option>
          ))}
        </select>
      </label>

      {itemId ? (
        <>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-lg font-black">🎨 रङ</legend>
            <div className="flex flex-wrap gap-2">
              {colours.map((colour) => (
                <button key={colour} type="button" aria-pressed={color === colour} onClick={() => setColor(colour)} className={chip(color === colour)}>
                  {colour}
                  {colour === item?.colors[0] ? " ★" : ""}
                </button>
              ))}
            </div>
            <input value={color} onChange={(event) => setColor(event.target.value)} maxLength={40} placeholder="अर्को रङ भए लेख्नुहोस्" aria-label="रङ" className="min-h-12 rounded-2xl border-2 border-brand-green-line bg-brand-paper px-4 text-lg" />
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-lg font-black">📏 साइज</legend>
            <div className="flex flex-wrap gap-2">
              {runs.map((run) => (
                <button key={run} type="button" aria-pressed={size === run} onClick={() => setSize(run)} className={chip(size === run)}>
                  {shortSize(run)}
                  {run === item?.lastSize ? " ★" : ""}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-lg font-black">🔢 कति जोडी?</legend>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" aria-label="एक जोडी घटाउने" onClick={() => setPairs((value) => Math.max(0, value - 1))} className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-green-wash text-3xl font-black text-brand-green">−</button>
              <input
                value={pairs ? String(pairs) : ""}
                onChange={(event) => setPairs(Math.min(10000, Math.max(0, Math.round(Number(event.target.value.replace(/\D/g, "")) || 0))))}
                inputMode="numeric"
                placeholder="0"
                aria-label="कति जोडी"
                className="h-14 w-24 rounded-2xl border-2 border-brand-green-line bg-brand-paper text-center text-3xl font-black tabular-nums"
              />
              <button type="button" aria-label="एक जोडी थप्ने" onClick={() => setPairs((value) => Math.min(10000, value + 1))} className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-green-wash text-3xl font-black text-brand-green">+</button>
              <button type="button" onClick={() => setPairs((value) => Math.min(10000, value + PAIRS_STEP))} className="h-14 rounded-2xl border-2 border-brand-green-line bg-brand-paper px-4 text-lg font-black text-brand-green">+{PAIRS_STEP}</button>
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-lg font-black">📅 कहिलेको काम?</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={day === "today"} onClick={() => setDay("today")} className={chip(day === "today")}>आज</button>
              <button type="button" aria-pressed={day === "yesterday"} onClick={() => setDay("yesterday")} className={chip(day === "yesterday")}>हिजो</button>
            </div>
          </fieldset>

          <details className="rounded-2xl border-2 border-brand-green-line bg-brand-paper px-4 py-3">
            <summary className="cursor-pointer text-lg font-black text-brand-green-ink">💬 केही भन्नु छ? <span className="text-base font-semibold text-brand-muted">(नभरे पनि हुन्छ)</span></summary>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={300} aria-label="मालिकलाई भन्ने कुरा" className="mt-3 w-full rounded-2xl border-2 border-brand-green-line bg-brand-paper px-4 py-3 text-lg" />
          </details>
        </>
      ) : null}

      <button
        type="button"
        onClick={send}
        disabled={pending || Boolean(missing)}
        className="min-h-16 rounded-2xl bg-brand-green px-4 text-xl font-black text-white disabled:bg-brand-green-line disabled:text-brand-green-ink"
      >
        {pending ? "पठाउँदै…" : missing ? missing : `➤ मालिकलाई पठाउने · ${pairs} जोडी`}
      </button>
      <p className="-mt-2 text-base text-brand-muted">मालिकले ✓ नगरेसम्म ज्याला र हिसाबमा जाँदैन।</p>

      {reply ? (
        <p role="status" className={`rounded-2xl px-4 py-3 text-lg font-black ${reply.ok ? "bg-brand-green-wash text-brand-green" : "bg-red-50 text-red-800"}`}>
          {reply.ne}
        </p>
      ) : null}
    </div>
  );
}
