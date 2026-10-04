"use client";

import { useMemo, useState, type RefObject } from "react";
import SafeImage from "@/components/SafeImage";
import { useLanguage } from "@/components/LanguageProvider";
import { money } from "@/lib/format-money";
import { codeNumber } from "@/lib/shoe-code";
import { hasNoPhoto } from "@/lib/product-photo";
import {
  isShoeSize,
  matchesSearch,
  pairsLeft,
  rateForChannel,
  sizeChoices,
  type CartLine,
  type SellableItem,
} from "@/app/admin/pos/_components/pos-bill-rules";

type PosProductPickerProps = {
  catalog: SellableItem[];
  cart: CartLine[];
  channel: string;
  returning: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  /** Enter in the search box: a scanner's code, or the first shoe shown. */
  onSubmitQuery: (query: string, shown: SellableItem[]) => void;
  /** A shoe tapped. `size` is set when the size filter already names one. */
  onChoose: (item: SellableItem, size: string) => void;
  onPhoto: (file: File | undefined) => void;
  readingPhoto: boolean;
  note: string;
  searchRef: RefObject<HTMLInputElement>;
  /**
   * "+ New item" for a name not on the shelf — given only on a retail sale,
   * where the counter sells to the shop's own customers (owner, 2026-09-29).
   */
  onAddNew?: (name: string) => void;
};

// A shoe is "running low" at this many pairs or fewer — worth a glance before
// promising the customer a second pair.
const LOW_STOCK = 3;

/**
 * The shelf, as the counter sees it: a search box that also takes a scanner,
 * a row of sizes, a row of kinds, and the shoes as tiles to tap.
 *
 * Tiles rather than a list, because the counter recognises a shoe by its look
 * faster than by its name. Shoes that can still be sold come first; a sold-out
 * one stays visible, dimmed, so the counter can say "that one is finished"
 * instead of hunting for it.
 */
export default function PosProductPicker({
  catalog,
  cart,
  channel,
  returning,
  query,
  onQueryChange,
  onSubmitQuery,
  onChoose,
  onPhoto,
  readingPhoto,
  note,
  searchRef,
  onAddNew,
}: PosProductPickerProps) {
  const { text } = useLanguage();
  const [category, setCategory] = useState("");
  // Sold-out shoes fold at the foot of the plain list (owner, 2026-09-30): four
  // of them took as much room as the shoes on the shelf. A search shows them.
  const [showSoldOut, setShowSoldOut] = useState(false);

  const categories = useMemo(
    () => [...new Set(catalog.map((item) => item.category ?? "").filter(Boolean))].sort(),
    [catalog],
  );

  // The sizes worth a button: every size some shoe in view still has.
  const sizeButtons = useMemo(() => {
    const sizes = new Set<string>();
    for (const item of catalog) {
      if (category && item.category !== category) continue;
      for (const choice of sizeChoices(item, cart)) {
        if (choice.sellable) sizes.add(choice.size);
      }
    }
    return [...sizes].sort((a, b) => Number(a) - Number(b));
  }, [catalog, cart, category]);

  const sizeQuery = isShoeSize(query) ? query.trim() : "";
  // A name worth offering as new: typed, not a size, not a #code.
  const newName = query.trim();
  const canOfferNew = Boolean(onAddNew) && newName.length >= 2 && !sizeQuery && !newName.startsWith("#");

  // The examples under the box, taken from a shoe actually on the shelf.
  const example = useMemo(() => {
    // A KR code is shown as the number alone: 205 is all that has to be typed.
    const withCode = catalog.find((item) => codeNumber(item.sku) !== null) ?? catalog.find((item) => item.sku) ?? catalog[0];
    const number = codeNumber(withCode?.sku ?? "");
    const name = (withCode?.design ?? "bantu").trim().split(/\s+/)[0] || "bantu";
    return {
      name: name.toLowerCase(),
      code: number !== null ? String(number) : withCode?.sku || "205",
      size: sizeButtons[Math.floor(sizeButtons.length / 2)] ?? "40",
    };
  }, [catalog, sizeButtons]);

  const shown = useMemo(() => {
    const matching = catalog.filter(
      (item) =>
        (!category || item.category === category) &&
        // A return may take back a shoe that has sold out.
        (returning && sizeQuery ? true : matchesSearch(item, query, cart)),
    );
    return matching.sort((a, b) => {
      const aLeft = pairsLeft(a, cart) > 0 ? 0 : 1;
      const bLeft = pairsLeft(b, cart) > 0 ? 0 : 1;
      return aLeft - bLeft || a.design.localeCompare(b.design);
    });
  }, [catalog, category, query, cart, returning, sizeQuery]);
  const foldSoldOut = !returning && !query.trim();
  const soldOutCount = foldSoldOut ? shown.filter((item) => pairsLeft(item, cart) <= 0).length : 0;
  const tiles = foldSoldOut && !showSoldOut ? shown.filter((item) => pairsLeft(item, cart) > 0) : shown;

  return (
    <section aria-label={text("Pick shoes", "जुत्ता छान्ने")} className="min-w-0">
      <div className="sticky top-0 z-20 -mx-1 bg-brand-paper px-1 pb-2 pt-1">
        <div className="flex gap-2">
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              // A barcode scanner types the code and presses Enter; so does a
              // cashier who typed a name. Either way the first answer is taken.
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmitQuery(query, shown);
              }
              if (event.key === "Escape") onQueryChange("");
            }}
            enterKeyHint="search"
            autoComplete="off"
            placeholder={text("Name, code or size…", "नाम, कोड वा साइज लेख्नुहोस्…")}
            aria-label={text("Search or scan a shoe", "जुत्ता खोज्ने वा स्क्यान गर्ने")}
            className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-brand-green bg-brand-paper px-4 text-lg text-brand-green-ink outline-none placeholder:text-brand-muted focus:border-brand-gold"
          />
          <label className="inline-flex h-14 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-2xl bg-brand-green px-4 text-sm font-black text-white">
            <span aria-hidden="true">📷</span>
            {readingPhoto ? text("Reading…", "पढ्दै…") : text("Scan", "स्क्यान")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={readingPhoto}
              className="sr-only"
              onChange={(event) => {
                onPhoto(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        {/* What each of the three looks like, from this shop's own shelf. The
            box used to say "(41)" and nothing else, and nobody could tell it
            was a size, or that a code or a name would do as well. */}
        <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full bg-brand-green-wash px-2.5 py-0.5 font-bold text-brand-green">
            {text("Name", "नाम")} → {example.name}
          </span>
          <span className="rounded-full bg-brand-green-wash px-2.5 py-0.5 font-bold text-brand-green">
            {text("Code", "कोड")} → #{example.code}
          </span>
          <span className="rounded-full bg-brand-green-wash px-2.5 py-0.5 font-bold text-brand-green">
            {text("Size", "साइज")} → {example.size}
          </span>
        </p>
        <p className="mt-1 hidden text-xs text-brand-muted md:block">
          {text(
            "F2 search · Enter takes the first shoe · 1–9 picks a size · F9 saves the bill",
            "F2 खोज्ने · Enter पहिलो जुत्ता · 1–9 साइज · F9 बिल राख्ने",
          )}
        </p>
        {note ? (
          <p role="status" className="mt-1 text-xs font-bold text-brand-green-ink">
            {note}
          </p>
        ) : null}

        {sizeButtons.length > 0 ? (
          <div
            className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]"
            role="group"
            aria-label={text("Size", "साइज")}
          >
            <span className="shrink-0 self-center pr-1 text-xs font-bold text-brand-muted">{text("Size", "साइज")}</span>
            {sizeButtons.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={sizeQuery === size}
                onClick={() => onQueryChange(sizeQuery === size ? "" : size)}
                className={`h-10 min-w-11 shrink-0 rounded-xl border px-2 text-sm font-black tabular-nums ${
                  sizeQuery === size
                    ? "border-brand-green bg-brand-green text-white"
                    : "border-brand-green-line bg-brand-paper-deep text-brand-green-ink"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        ) : null}

        {categories.length > 1 ? (
          <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label={text("Kind", "किसिम")}>
            {["", ...categories].map((option) => (
              <button
                key={option || "all"}
                type="button"
                aria-pressed={category === option}
                onClick={() => setCategory(option)}
                className={`h-9 shrink-0 rounded-full border px-4 text-sm font-bold ${
                  category === option
                    ? "border-brand-green bg-brand-green-tint text-brand-green"
                    : "border-brand-green-line bg-brand-paper-deep text-brand-green-ink"
                }`}
              >
                {option || text("All", "सबै")}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <div className="grid gap-2">
          <p className="rounded-2xl bg-brand-paper-deep px-4 py-6 text-center text-sm font-semibold text-brand-muted">
            {sizeQuery
              ? text(`No shoe has size ${sizeQuery} left.`, `साइज ${sizeQuery} कुनै जुत्तामा बाँकी छैन।`)
              : text("Nothing matches. Try another name, code or size.", "भेटिएन। अर्को नाम, कोड वा साइज लेख्नुहोस्।")}
          </p>
          {canOfferNew ? (
            <button
              type="button"
              onClick={() => onAddNew?.(newName)}
              className="min-h-14 rounded-2xl border-2 border-dashed border-brand-green bg-brand-green-wash px-4 text-lg font-black text-brand-green"
            >
              ＋ {text(`Add "${newName}" as a new item`, `"${newName}" नयाँ माल थप्ने`)}
            </button>
          ) : null}
        </div>
      ) : (
        // A short list, not big cards (owner, 2026-10-04): on a laptop the
        // cards filled the screen and squeezed the bill. One column on a
        // phone, two on a computer; a small photo, the name, price and pairs.
        <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
          {tiles.map((item, index) => {
            const left = pairsLeft(item, cart);
            const soldOut = left <= 0 && !returning;
            const sizeLeft = sizeQuery ? sizeChoices(item, cart).find((choice) => choice.size === sizeQuery) : null;
            const rate = rateForChannel(channel, item);
            const noPrice = !(rate > 0) && !soldOut;
            const inBill = cart.some((line) => line.design === item.design);
            const low = !soldOut && left <= LOW_STOCK;

            return (
              <button
                key={item.design}
                type="button"
                disabled={soldOut}
                onClick={() => onChoose(item, sizeQuery)}
                className={`flex min-h-14 items-center gap-2.5 rounded-xl border px-2 py-1.5 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-gold disabled:cursor-not-allowed disabled:opacity-50 ${
                  inBill
                    ? "border-brand-green bg-brand-green-wash"
                    : noPrice
                      ? "border-brand-clay/50 bg-brand-clay-tint/30 hover:border-brand-clay"
                      : "border-brand-green-line bg-brand-paper hover:border-brand-green"
                }`}
              >
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-brand-paper-deep">
                  {item.image && !hasNoPhoto(item.image) ? (
                    <SafeImage src={item.image} alt="" fill sizes="40px" className="object-cover" />
                  ) : (
                    <span className="grid h-full place-items-center text-lg text-brand-green-line" aria-hidden="true">
                      👟
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-black text-brand-green-ink">{item.design}</span>
                  <span className="block truncate text-[11px] text-brand-muted">
                    {item.sku ? <span className="font-mono">{item.sku}</span> : null}
                    {index === 0 && query.trim() ? (
                      <span className="ms-1.5 hidden rounded bg-brand-green-ink/80 px-1 font-mono text-[10px] text-white md:inline">Enter</span>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 text-right leading-tight">
                  <span className={`block text-sm font-black tabular-nums ${noPrice ? "text-brand-clay" : "text-brand-green-ink"}`}>
                    {rate > 0 ? money(rate) : text("Set price", "मूल्य लेख्ने")}
                  </span>
                  <span className={`block text-[11px] tabular-nums ${low ? "font-black text-brand-clay" : "text-brand-muted"}`}>
                    {soldOut
                      ? text("sold out", "सकियो")
                      : sizeLeft
                        ? sizeLeft.left === null
                          ? text(`size ${sizeQuery}: in pile`, `साइज ${sizeQuery}: थुप्रोमा`)
                          : text(`size ${sizeQuery}: ${sizeLeft.left}`, `साइज ${sizeQuery}: ${sizeLeft.left}`)
                        : low
                          ? text(`only ${left}`, `${left} मात्र`)
                          : text(`${left} pairs`, `${left} जोडा`)}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base font-black ${
                    inBill ? "bg-brand-green text-white" : "bg-brand-green-wash text-brand-green"
                  }`}
                >
                  {inBill ? "✓" : "+"}
                </span>
              </button>
            );
          })}
          {soldOutCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowSoldOut((open) => !open)}
              aria-expanded={showSoldOut}
              className="col-span-full min-h-11 rounded-2xl border border-dashed border-brand-green-line bg-brand-paper-deep px-4 text-left text-base font-bold text-brand-muted"
            >
              {showSoldOut
                ? text(`▾ Hide the ${soldOutCount} sold-out shoe(s)`, `▾ सकिएका ${soldOutCount} जुत्ता लुकाउने`)
                : text(`▸ ${soldOutCount} sold-out shoe(s)`, `▸ सकिएका ${soldOutCount} जुत्ता`)}
            </button>
          ) : null}
          {canOfferNew && !shown.some((item) => item.design.trim().toLowerCase() === newName.toLowerCase()) ? (
            <button
              type="button"
              onClick={() => onAddNew?.(newName)}
              className="col-span-full min-h-11 rounded-2xl border border-dashed border-brand-green px-4 text-base font-bold text-brand-green"
            >
              {text(`Not here? ＋ Add "${newName}" as a new item`, `यहाँ छैन? ＋ "${newName}" नयाँ माल थप्ने`)}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
