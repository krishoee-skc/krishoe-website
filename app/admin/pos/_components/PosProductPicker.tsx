"use client";

import { useMemo, useState, type RefObject } from "react";
import SafeImage from "@/components/SafeImage";
import { useLanguage } from "@/components/LanguageProvider";
import { money } from "@/lib/format-money";
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
}: PosProductPickerProps) {
  const { text } = useLanguage();
  const [category, setCategory] = useState("");

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
            placeholder={text("Shoe, code or size (41)", "जुत्ता, कोड वा साइज (41)")}
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
        <p className="rounded-2xl bg-brand-paper-deep px-4 py-8 text-center text-sm font-semibold text-brand-muted">
          {sizeQuery
            ? text(`No shoe has size ${sizeQuery} left.`, `साइज ${sizeQuery} कुनै जुत्तामा बाँकी छैन।`)
            : text("Nothing matches. Try another name, code or size.", "भेटिएन। अर्को नाम, कोड वा साइज लेख्नुहोस्।")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((item, index) => {
            const left = pairsLeft(item, cart);
            const soldOut = left <= 0 && !returning;
            const sizeLeft = sizeQuery ? sizeChoices(item, cart).find((choice) => choice.size === sizeQuery) : null;
            const rate = rateForChannel(channel, item);

            return (
              <button
                key={item.design}
                type="button"
                disabled={soldOut}
                onClick={() => onChoose(item, sizeQuery)}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-brand-green-line bg-brand-paper text-left transition hover:-translate-y-0.5 hover:border-brand-green focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-gold disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <span className="relative block aspect-[4/3] w-full bg-brand-paper-deep">
                  {item.image && !hasNoPhoto(item.image) ? (
                    <SafeImage src={item.image} alt="" fill sizes="(max-width: 768px) 50vw, 220px" className="object-cover" />
                  ) : (
                    <span className="grid h-full place-items-center text-3xl text-brand-green-line" aria-hidden="true">
                      👟
                    </span>
                  )}
                  {index === 0 && query.trim() ? (
                    <span className="absolute left-1.5 top-1.5 hidden rounded bg-brand-green-ink/80 px-1.5 font-mono text-[10px] text-white md:block">
                      Enter
                    </span>
                  ) : null}
                  {!soldOut && left <= LOW_STOCK ? (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-brand-clay px-2 text-[11px] font-black text-white">
                      {text(`only ${left}`, `${left} मात्र`)}
                    </span>
                  ) : null}
                </span>
                <span className="flex flex-1 flex-col gap-0.5 p-2.5">
                  <span className="line-clamp-2 text-sm font-black leading-tight text-brand-green-ink">{item.design}</span>
                  {item.sku ? <span className="font-mono text-[11px] text-brand-muted">{item.sku}</span> : null}
                  <span className="mt-auto flex items-baseline justify-between gap-1 pt-1">
                    <span className="text-base font-black tabular-nums text-brand-green">
                      {rate > 0 ? money(rate) : text("No price", "मूल्य छैन")}
                    </span>
                    <span className="text-[11px] font-semibold text-brand-muted">
                      {soldOut
                        ? text("sold out", "सकियो")
                        : sizeLeft
                          ? sizeLeft.left === null
                            ? text(`size ${sizeQuery}: in pile`, `साइज ${sizeQuery}: थुप्रोमा`)
                            : text(`size ${sizeQuery}: ${sizeLeft.left}`, `साइज ${sizeQuery}: ${sizeLeft.left}`)
                          : text(`${left} pairs`, `${left} जोडा`)}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
