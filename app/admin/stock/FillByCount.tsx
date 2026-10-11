"use client";

import { useActionState, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import EnterWalkForm from "@/components/admin/EnterWalkForm";
import { countChanges, tidySizes, withOneBlankRow } from "@/lib/counter-item-rules";
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
export default function FillByCount({
  id,
  design,
  stockNow = {},
}: {
  id: string;
  design: string;
  /** The books today, by size. The count replaces it (owner, 2026-10-11). */
  stockNow?: Record<string, number>;
}) {
  const { text } = useLanguage();
  const [rows, setRows] = useState([blankRow()]);
  const [state, action, pending] = useActionState<ActionState | null, FormData>(fillSoldFirstByCountAction, null);
  const counted = tidySizes(rows);
  const total = Object.values(counted).reduce((sum, pairs) => sum + pairs, 0);
  const booksTotal = Object.values(stockNow).reduce((sum, pairs) => sum + pairs, 0);
  const changes = countChanges(stockNow, counted);
  const typedSize = (size: string) => Object.prototype.hasOwnProperty.call(counted, size);
  const goesToZero = changes.filter((change) => change.to === 0 && !typedSize(change.size));
  const zeroList = goesToZero.map((change) => `${change.size} (app ${change.now})`).join(", ");

  function editRow(index: number, change: Partial<{ size: string; pairs: string }>) {
    setRows((current) => withOneBlankRow(current.map((entry, at) => (at === index ? { ...entry, ...change } : entry)), blankRow));
  }

  if (state?.ok) {
    return <div role="status" className="rounded-xl bg-brand-green-wash px-3 py-2 text-base font-black text-brand-green">✓ {state.message}</div>;
  }

  return (
    <EnterWalkForm action={action} confirmTitle={design} className="mt-2 grid gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="sizes" value={JSON.stringify(rows)} />
      <div className="text-sm font-bold text-brand-muted">{text("On the shelf now — size and pairs", "र्‍याकमा अहिले — साइज र जोडी")}</div>
      {rows.map((row, index) => {
        const last = index === rows.length - 1 && !row.size && !row.pairs;
        const size = row.size.trim();
        const books = size ? stockNow[size] ?? 0 : null;
        return (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
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
            <span className="min-w-24 text-sm font-bold text-brand-muted">
              {books === null ? "" : text(`app: ${books} → ${counted[size] ?? 0}`, `app: ${books} → ${counted[size] ?? 0}`)}
            </span>
          </div>
        );
      })}
      <div className="rounded-xl bg-brand-green-wash px-3 py-2 text-sm font-black text-brand-green">
        {text(
          `Stock becomes what you counted: ${total} ${total === 1 ? "pair" : "pairs"} (app had ${booksTotal})`,
          `स्टक गनेजति हुन्छ: ${total} जोडी (app मा ${booksTotal} थियो)`,
        )}
      </div>
      {goesToZero.length > 0 ? (
        <div className="rounded-xl bg-brand-cream-soft px-3 py-2 text-sm font-bold text-brand-gold-ink">
          {text(
            `Sizes you do not type become 0: ${zeroList}.`,
            `नलेखेको साइज ० हुन्छ: ${zeroList}।`,
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-brand-cream-soft px-3 py-2 text-sm font-bold text-brand-gold-ink">
          {text("Sizes you do not type become 0.", "नलेखेको साइज ० हुन्छ।")}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-xl bg-brand-green px-4 text-base font-black text-white disabled:opacity-50"
      >
        {pending
          ? text("Saving…", "राख्दैछौँ…")
          : total > 0
            ? text(`Set the stock to this count: ${total} ${total === 1 ? "pair" : "pairs"}`, `स्टक यही गन्ती बनाउने: ${total} जोडी`)
            : text("Set the stock to 0: none on the shelf", "स्टक ० बनाउने: र्‍याकमा केही छैन")}
      </button>
      {state && !state.ok ? <div role="alert" className="text-sm font-bold text-brand-clay">{state.message}</div> : null}
    </EnterWalkForm>
  );
}
