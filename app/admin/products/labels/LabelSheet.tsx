/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

type Shoe = { id: string; name: string; price: string };

/**
 * Which shoes, and how many stickers of each (owner's sample 7घ, 2026-10-14).
 * The sheet printed one sticker for every shoe on the books; a box of twelve
 * pairs needed the page printed twelve times. Choosing is on screen only —
 * the paper carries just the stickers.
 */
export default function LabelSheet({ shoes }: { shoes: Shoe[] }) {
  const { text } = useLanguage();
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(shoes.map((shoe) => shoe.id)));
  const [copies, setCopies] = useState(1);
  const picked = shoes.filter((shoe) => chosen.has(shoe.id));

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-2xl border border-brand-green-line bg-brand-paper p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-bold text-brand-green-ink">
            {text("Stickers of each", "हरेकको कति स्टिकर")}
            <input
              type="number"
              min={1}
              max={50}
              inputMode="numeric"
              value={copies}
              onChange={(event) => setCopies(Math.min(50, Math.max(1, Number(event.target.value) || 1)))}
              className="min-h-12 w-28 rounded-lg border border-brand-green-line px-3 text-right tabular-nums"
            />
          </label>
          <button
            type="button"
            onClick={() => setChosen(new Set(shoes.map((shoe) => shoe.id)))}
            className="min-h-11 rounded-full border border-brand-green-line px-4 text-sm font-bold text-brand-green-ink"
          >
            {text("All shoes", "सबै जुत्ता")}
          </button>
          <button
            type="button"
            onClick={() => setChosen(new Set())}
            className="min-h-11 rounded-full border border-brand-green-line px-4 text-sm font-bold text-brand-green-ink"
          >
            {text("None", "कुनै पनि होइन")}
          </button>
          <p className="text-sm font-bold text-brand-muted">
            {text(
              `${picked.length} shoes × ${copies} = ${picked.length * copies} stickers`,
              `${picked.length} जुत्ता × ${copies} = ${picked.length * copies} स्टिकर`,
            )}
          </p>
        </div>
        <ul className="grid list-none grid-cols-1 gap-1.5 pl-0 sm:grid-cols-2 lg:grid-cols-3">
          {shoes.map((shoe) => (
            <li key={shoe.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-brand-green-line px-3 text-sm font-semibold text-brand-green-ink">
                <input type="checkbox" checked={chosen.has(shoe.id)} onChange={() => toggle(shoe.id)} className="size-5 accent-brand-green" />
                <span className="min-w-0 truncate">{shoe.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {picked.length === 0 ? (
        <p className="rounded-lg border border-dashed border-brand-green-line p-4 text-sm text-brand-muted print:hidden">
          {text("Choose at least one shoe to print its stickers.", "स्टिकर छाप्न कम्तीमा एउटा जुत्ता छान्नुहोस्।")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-1">
          {picked.flatMap((shoe) =>
            Array.from({ length: copies }, (_, copy) => (
              <div
                key={`${shoe.id}-${copy}`}
                className="flex flex-col items-center gap-1 rounded-lg border border-brand-green-line bg-brand-paper p-3 text-center print:break-inside-avoid"
              >
                <p className="line-clamp-2 text-xs font-black text-brand-green-ink">{shoe.name}</p>
                <img src={`/api/admin/products/${shoe.id}/barcode`} alt={`Barcode for ${shoe.name}`} className="h-14 w-full object-contain" />
                <p className="text-xs font-bold text-brand-green">{shoe.price}</p>
              </div>
            )),
          )}
        </div>
      )}
    </div>
  );
}
