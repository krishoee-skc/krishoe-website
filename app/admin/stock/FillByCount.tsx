"use client";

import { useActionState, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import EnterWalkForm from "@/components/admin/EnterWalkForm";
import { countChanges, tidySizes, withOneBlankRow } from "@/lib/counter-item-rules";
import { BIG_COUNT_DROP } from "@/lib/shelf-count-rules";
import { countShelfAction, fillSoldFirstByCountAction } from "@/app/admin/stock/actions";
import type { ActionState } from "@/app/admin/actions";

const blankRow = () => ({ size: "", pairs: "" });
const box =
  "h-11 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base font-bold text-brand-green-ink outline-none focus:border-brand-green";
const chip = (on: boolean) =>
  `min-h-10 rounded-full border px-4 text-sm font-black ${
    on ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"
  }`;

type Place = "Shop" | "Factory";
/** Pairs the app holds at each place, by size, and the stock of that size. */
export type PlacesBySize = Record<string, { shop: number; factory: number; total?: number }>;

/**
 * Count a shoe's shelf at one place, size by size (owner, 2026-10-09; for any
 * shoe 2026-10-11). That place's pairs become the count — not added on top —
 * the other place is not touched, and a size not typed goes to 0 there. Each
 * row shows the app's figure beside the count before anything is saved; 10 or
 * more pairs fewer asks "I counted again". Enter walks the boxes and asks
 * before it saves; there is always one empty row at the foot.
 *
 * With an id it fills a shoe sold first at the counter, at the shop.
 */
export default function FillByCount({
  id,
  design,
  places = {},
  defaultPlace = "Shop",
}: {
  id?: string;
  design: string;
  places?: PlacesBySize;
  defaultPlace?: Place;
}) {
  const { text } = useLanguage();
  const [rows, setRows] = useState([blankRow()]);
  const [place, setPlace] = useState<Place>(id ? "Shop" : defaultPlace);
  const [countedAgain, setCountedAgain] = useState(false);
  // Nothing typed is not a count (owner, 2026-10-11: the empty form already
  // read "300 pairs fewer"). To set a place to 0 on purpose, say so here.
  const [noneOnShelf, setNoneOnShelf] = useState(false);
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    id ? fillSoldFirstByCountAction : countShelfAction,
    null,
  );
  const atPlace = (size: string) => (place === "Shop" ? places[size]?.shop : places[size]?.factory) ?? 0;
  const here = Object.fromEntries(Object.keys(places).map((size) => [size, atPlace(size)]));
  const counted = tidySizes(rows);
  const total = Object.values(counted).reduce((sum, pairs) => sum + pairs, 0);
  const hereTotal = Object.values(here).reduce((sum, pairs) => sum + pairs, 0);
  const changes = countChanges(here, counted);
  const typedSize = (size: string) => Object.prototype.hasOwnProperty.call(counted, size);
  const zeroList = changes
    .filter((change) => change.to === 0 && !typedSize(change.size))
    .map((change) => `${change.size} (${change.now})`)
    .join(", ");
  const fewer = changes.reduce((sum, change) => sum + Math.max(0, -change.change), 0);
  const typedAny = total > 0;
  const showResult = typedAny || noneOnShelf;
  // "Nothing on the shelf" is its own tick, so it is not asked twice.
  const askAgain = typedAny && fewer >= BIG_COUNT_DROP;
  const stockTotal = Object.values(places).reduce((sum, entry) => sum + (entry.total ?? 0), 0);
  const hasStockTotals = Object.values(places).some((entry) => entry.total !== undefined);
  const placeEn = place === "Shop" ? "shop" : "factory";
  const placeNe = place === "Shop" ? text("shop", "पसल") : text("factory", "कारखाना");
  const otherEn = place === "Shop" ? "factory" : "shop";
  const otherNe = place === "Shop" ? text("factory", "कारखाना") : text("shop", "पसल");
  const pairsEn = total === 1 ? "pair" : "pairs";

  function editRow(index: number, change: Partial<{ size: string; pairs: string }>) {
    setRows((current) => withOneBlankRow(current.map((entry, at) => (at === index ? { ...entry, ...change } : entry)), blankRow));
    setCountedAgain(false);
    setNoneOnShelf(false);
  }

  if (state?.ok) {
    return <div role="status" className="rounded-xl bg-brand-green-wash px-3 py-2 text-base font-black text-brand-green">✓ {state.message}</div>;
  }

  return (
    <EnterWalkForm action={action} confirmTitle={design} className="mt-2 grid gap-2">
      {id ? <input type="hidden" name="id" value={id} /> : <input type="hidden" name="design" value={design} />}
      <input type="hidden" name="place" value={place} />
      <input type="hidden" name="sizes" value={JSON.stringify(rows)} />
      <input type="hidden" name="confirmBigDrop" value={countedAgain || noneOnShelf ? "yes" : ""} />
      <input type="hidden" name="noneOnShelf" value={noneOnShelf ? "yes" : ""} />
      {id ? null : (
        <div className="grid gap-1.5">
          <div className="text-sm font-bold text-brand-muted">{text(`${design} — where are you counting?`, `${design} — कहाँ गन्दै हुनुहुन्छ?`)}</div>
          <div className="flex flex-wrap gap-2">
            {(["Shop", "Factory"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setPlace(option);
                  setCountedAgain(false);
                  setNoneOnShelf(false);
                }}
                aria-pressed={place === option}
                className={chip(place === option)}
              >
                {option === "Shop" ? text("🛒 Shop", "🛒 पसल") : text("🏭 Factory", "🏭 कारखाना")}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="text-sm font-bold text-brand-muted">{text("On the shelf now — size and pairs", "र्‍याकमा अहिले — साइज र जोडी")}</div>
      {rows.map((row, index) => {
        const last = index === rows.length - 1 && !row.size && !row.pairs;
        const size = row.size.trim();
        const shown = size ? `${atPlace(size)} → ${counted[size] ?? 0}` : "";
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
            <span className="min-w-28 text-sm font-bold text-brand-muted">{shown ? text(`${placeEn}: ${shown}`, `${placeNe}: ${shown}`) : ""}</span>
          </div>
        );
      })}
      {showResult ? (
        <>
          <div className="rounded-xl bg-brand-green-wash px-3 py-2 text-sm font-black text-brand-green">
            {hasStockTotals
              ? text(
                  `The ${placeEn} becomes what you counted: ${total} ${pairsEn}. App had ${hereTotal} at the ${placeEn}; in stock ${stockTotal}. The ${otherEn} is not touched.`,
                  `${placeNe} गनेजति हुन्छ: ${total} जोडी। app मा ${placeNe}मा ${hereTotal} थियो; जम्मा स्टक ${stockTotal}। ${otherNe} छोइँदैन।`,
                )
              : text(
                  `The ${placeEn} becomes what you counted: ${total} ${pairsEn}. App had ${hereTotal} at the ${placeEn}. The ${otherEn} is not touched.`,
                  `${placeNe} गनेजति हुन्छ: ${total} जोडी। app मा ${placeNe}मा ${hereTotal} थियो। ${otherNe} छोइँदैन।`,
                )}
          </div>
          <div className="rounded-xl bg-brand-cream-soft px-3 py-2 text-sm font-bold text-brand-gold-ink">
            {zeroList
              ? text(`Sizes you do not type become 0 at the ${placeEn}: ${zeroList}.`, `नलेखेको साइज ${placeNe}मा ० हुन्छ: ${zeroList}।`)
              : text(`Sizes you do not type become 0 at the ${placeEn}.`, `नलेखेको साइज ${placeNe}मा ० हुन्छ।`)}
          </div>
        </>
      ) : (
        <div className="rounded-xl bg-brand-mist px-3 py-2 text-sm font-bold text-brand-muted">
          {text(
            `Type what you find on the ${placeEn} shelf, size by size. App has ${hereTotal} at the ${placeEn}.`,
            `${placeNe}को र्‍याकमा भेटिएको साइज अनुसार लेख्नुहोस्। app मा ${placeNe}मा ${hereTotal} छ।`,
          )}
        </div>
      )}
      {!typedAny ? (
        <label className="flex items-start gap-2 rounded-xl border border-dashed border-brand-green-line px-3 py-2 text-sm font-bold text-brand-muted">
          <input type="checkbox" checked={noneOnShelf} onChange={(event) => setNoneOnShelf(event.target.checked)} className="mt-0.5 h-5 w-5" />
          <span>
            {text(
              `Nothing of this shoe on the ${placeEn} shelf — set the ${placeEn} to 0 (${hereTotal} pairs come off as not found).`,
              `${placeNe}को र्‍याकमा यो जुत्ता छैन — ${placeNe} ० बनाउने (${hereTotal} जोडी नभेटिएको भनेर घट्छ)।`,
            )}
          </span>
        </label>
      ) : null}
      {askAgain ? (
        <label className="flex items-start gap-2 rounded-xl border-2 border-brand-gold bg-brand-cream-soft px-3 py-2.5 text-base font-bold text-brand-gold-ink">
          <input type="checkbox" checked={countedAgain} onChange={(event) => setCountedAgain(event.target.checked)} className="mt-1 h-5 w-5" />
          <span>{text(`I counted again — ${fewer} pairs fewer than the app. They come off the stock as not found.`, `फेरि गनेँ — app भन्दा ${fewer} जोडी कम। नभेटिएको भनेर स्टकबाट घट्छ।`)}</span>
        </label>
      ) : null}
      <button
        type="submit"
        disabled={pending || !showResult || (askAgain && !countedAgain)}
        className="min-h-12 rounded-xl bg-brand-green px-4 text-base font-black text-white disabled:opacity-50"
      >
        {pending
          ? text("Saving…", "राख्दैछौँ…")
          : !showResult
            ? text("Type what you found ↑", "भेटिएको लेख्नुहोस् ↑")
            : askAgain && !countedAgain
            ? text("Tick “I counted again” ↑", "“फेरि गनेँ” मा टिक लगाउनुहोस् ↑")
            : total > 0
              ? text(`Set the ${placeEn} to this count: ${total} ${pairsEn}`, `${placeNe} यही गन्ती बनाउने: ${total} जोडी`)
              : text(`Set the ${placeEn} to 0: none on the shelf`, `${placeNe} ० बनाउने: र्‍याकमा केही छैन`)}
      </button>
      {state && !state.ok ? <div role="alert" className="text-sm font-bold text-brand-clay">{state.message}</div> : null}
    </EnterWalkForm>
  );
}
