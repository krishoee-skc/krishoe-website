"use client";

import { useActionState, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import EnterWalkForm from "@/components/admin/EnterWalkForm";
import { tidySizes, withOneBlankRow } from "@/lib/counter-item-rules";
import { fillSoldFirstByCountAction } from "@/app/admin/stock/actions";
import type { ActionState } from "@/app/admin/actions";

const blankRow = () => ({ size: "", pairs: "" });
const box =
  "h-11 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base font-bold text-brand-green-ink outline-none focus:border-brand-green";

/**
 * Count the shelf for a shoe sold at the counter before its stock was put in
 * (owner, 2026-10-09): what is there now, size by size. Enter walks the boxes
 * and asks before it saves; there is always one empty row at the foot.
 */
export default function FillByCount({ id, design }: { id: string; design: string }) {
  const { text } = useLanguage();
  const [rows, setRows] = useState([blankRow()]);
  const [state, action, pending] = useActionState<ActionState | null, FormData>(fillSoldFirstByCountAction, null);
  const total = Object.values(tidySizes(rows)).reduce((sum, pairs) => sum + pairs, 0);

  function editRow(index: number, change: Partial<{ size: string; pairs: string }>) {
    setRows((current) => withOneBlankRow(current.map((entry, at) => (at === index ? { ...entry, ...change } : entry)), blankRow));
  }

  if (state?.ok) {
    return <p role="status" className="rounded-xl bg-brand-green-wash px-3 py-2 text-base font-black text-brand-green">✓ {state.message}</p>;
  }

  return (
    <EnterWalkForm action={action} confirmTitle={design} className="mt-2 grid gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="sizes" value={JSON.stringify(rows)} />
      <p className="text-sm font-bold text-brand-muted">{text("On the shelf now — size and pairs", "र्‍याकमा अहिले — साइज र जोडी")}</p>
      {rows.map((row, index) => {
        const last = index === rows.length - 1 && !row.size && !row.pairs;
        return (
          <div key={index} className="grid grid-cols-2 gap-2">
            <input
              value={row.size}
              inputMode="numeric"
              placeholder={text("Size", "साइज")}
              aria-label={text(`Size, row ${index + 1}`, `साइज, लाइन ${index + 1}`)}
              onChange={(event) => editRow(index, { size: event.target.value })}
              className={last ? `${box} border-dashed` : box}
            />
            <input
              value={row.pairs}
              inputMode="numeric"
              placeholder={text("Pairs", "जोडी")}
              aria-label={text(`Pairs, row ${index + 1}`, `जोडी, लाइन ${index + 1}`)}
              data-summary={index === 0 ? "pairs" : undefined}
              onChange={(event) => editRow(index, { pairs: event.target.value })}
              className={last ? `${box} border-dashed` : box}
            />
          </div>
        );
      })}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-xl bg-brand-green px-4 text-base font-black text-white disabled:opacity-50"
      >
        {pending
          ? text("Saving…", "राख्दैछौँ…")
          : total > 0
            ? text(`Save the count: ${total} pairs`, `गन्ती राख्ने: ${total} जोडी`)
            : text("Save: none left on the shelf", "राख्ने: र्‍याकमा केही बाँकी छैन")}
      </button>
      {state && !state.ok ? <p role="alert" className="text-sm font-bold text-brand-clay">{state.message}</p> : null}
    </EnterWalkForm>
  );
}
