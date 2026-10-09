"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { createCounterItemAction, type CounterItemResult } from "@/app/admin/pos/actions";
import {
  counterItemDoubts,
  counterItemLosses,
  counterItemProblem,
  guessKind,
  similarNames,
  tidySizes,
  totalPairs,
  withOneBlankRow,
  type CounterItemChannel,
} from "@/lib/counter-item-rules";
import { categories } from "@/lib/products";
import EnterWalkForm from "@/components/admin/EnterWalkForm";

type Created = Extract<CounterItemResult, { ok: true }>["item"];

/** A blank size row; there is always exactly one at the foot (withOneBlankRow). */
const blankRow = () => ({ size: "", pairs: "" });

const box =
  "h-12 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base font-bold text-brand-green-ink outline-none focus:border-brand-green";
const label = "grid gap-1 text-sm font-bold text-brand-muted";
const chip = (on: boolean) =>
  `min-h-10 rounded-full border px-3.5 text-sm font-bold ${
    on ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"
  }`;

type Choice = { id: string; en: string; ne: string };

/**
 * One choice, shown as the one chosen (owner, 2026-09-30): six kinds and three
 * ways in stood open as nine buttons, and Enter skipped straight past them.
 * Now the choice is a stop — Enter accepts it and walks on, ← → changes it,
 * a press opens every option.
 */
function ChoicePicker({
  title,
  options,
  value,
  onChange,
  hint,
  text,
}: {
  title: string;
  options: Choice[];
  value: string;
  onChange: (id: string) => void;
  hint?: string;
  text: (en: string, ne: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const at = Math.max(0, options.findIndex((option) => option.id === value));
  const current = options[at];

  function step(event: KeyboardEvent<HTMLButtonElement>) {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const next = (at + (forward ? 1 : options.length - 1)) % options.length;
    onChange(options[next].id);
  }

  return (
    <div className={label}>
      <span>
        {title}
        {hint ? <span className="ml-1 font-semibold text-brand-gold-ink">· {hint}</span> : null}
      </span>
      {open ? (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onChange(option.id);
                setOpen(false);
                window.setTimeout(() => button.current?.focus(), 0);
              }}
              className={chip(option.id === value)}
            >
              {text(option.en, option.ne)}
            </button>
          ))}
        </div>
      ) : (
        <button
          ref={button}
          type="button"
          data-enter-walk
          onClick={() => setOpen(true)}
          onKeyDown={step}
          aria-label={`${title}: ${text(current.en, current.ne)}`}
          className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-left text-base font-black text-brand-green-ink outline-none focus:border-brand-gold focus:ring-4 focus:ring-brand-gold/20"
        >
          <span>{text(current.en, current.ne)}</span>
          <span className="text-xs font-semibold text-brand-muted">
            {text("Enter = right · ← → = change · press = all", "Enter = ठीक · ← → = बदल्ने · थिच्दा सबै")}
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * "+ New item" on the counter bill (owner, 2026-09-29): goods on the shelf that
 * were never entered, put on the books in one form and sold at once.
 *
 * Before anything is made it offers the names already on the books that read
 * like the one typed — one shoe, one name. A price below the typed cost asks
 * to be confirmed. An unknown cost is allowed and shown as "cost to come".
 *
 * Opened from a wholesale bill it asks for the wholesale price first and must
 * have it; the retail price and the wholesale minimum are optional there. From
 * a retail bill it is the other way round (owner, 2026-09-30).
 *
 * Enter walks it top to bottom: the name, the kind (guessed from the name),
 * how it came, the sizes — an empty size ends them — and the bill's own price;
 * the rest sits under "+ more". The box being typed in is kept in view.
 */
export default function PosNewItemSheet({
  initialName,
  channel = "Retail",
  knownNames,
  ready,
  isOwner,
  onPickExisting,
  onCreated,
  onClose,
}: {
  initialName: string;
  channel?: CounterItemChannel;
  knownNames: string[];
  ready: boolean;
  isOwner: boolean;
  onPickExisting: (name: string) => void;
  onCreated: (item: Created) => void;
  onClose: () => void;
}) {
  const { text } = useLanguage();
  const [name, setName] = useState(initialName.trim());
  const [chosenKind, setChosenKind] = useState<string | null>(null);
  // Added while selling (owner, 2026-10-09): the rows are the pairs being sold
  // now, not the shelf's count. The shoe's stock is filled later from its
  // purchase bill or a count of the shelf (Stock → "Sold first").
  const [rows, setRows] = useState<Array<{ size: string; pairs: string }>>([blankRow()]);
  const [price, setPrice] = useState("");
  const [wholesale, setWholesale] = useState("");
  const [minPairs, setMinPairs] = useState("");
  const [cost, setCost] = useState("");
  const [lossConfirmed, setLossConfirmed] = useState(false);
  const [doubtsConfirmed, setDoubtsConfirmed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const sizeBoxes = useRef<Array<HTMLInputElement | null>>([]);
  const priceBox = useRef<HTMLInputElement>(null);
  const kinds = categories.filter((entry) => entry.slug !== "new-arrivals");
  const guessed = guessKind(name);
  // Chosen by hand wins; otherwise the name's own words; otherwise the first.
  const categorySlug = chosenKind ?? guessed ?? kinds[0]?.slug ?? "";
  const [refusal, setRefusal] = useState<{ en: string; ne: string; sameAs: string[] } | null>(null);
  const [saving, startSaving] = useTransition();

  const lookAlikes = useMemo(() => similarNames(name, knownNames), [name, knownNames]);
  const sizes = tidySizes(rows);
  const pilePairs = 0;
  const retailPrice = Number(price) || 0;
  const wholesalePrice = Number(wholesale) || 0;
  const minWholesaleQty = Math.max(1, Math.round(Number(minPairs) || 1));
  const costPerPair = Number(cost) || 0;
  const isWholesale = channel === "Wholesale";
  const pairs = totalPairs(sizes, pilePairs);
  const problem = counterItemProblem({
    name,
    how: "pending_bill",
    sizes,
    pilePairs,
    retailPrice,
    wholesalePrice,
    channel,
    costPerPair,
    lossConfirmed,
    minWholesaleQty: minPairs ? minWholesaleQty : undefined,
    doubtsConfirmed,
    soldFirst: true,
  });
  const doubts = counterItemDoubts({
    pairs,
    minWholesaleQty: minPairs ? minWholesaleQty : undefined,
    costPerPair,
    retailPrice,
    wholesalePrice,
  });
  const losses = counterItemLosses({ retailPrice, wholesalePrice, costPerPair });
  const profits = [
    retailPrice > 0 && costPerPair > 0 ? text(`retail Rs. ${retailPrice - costPerPair}`, `खुद्रा रु. ${retailPrice - costPerPair}`) : "",
    wholesalePrice > 0 && costPerPair > 0 ? text(`wholesale Rs. ${wholesalePrice - costPerPair}`, `थोक रु. ${wholesalePrice - costPerPair}`) : "",
  ].filter(Boolean);
  const anyPrice = isWholesale ? wholesalePrice > 0 : retailPrice > 0;
  const billPrice = isWholesale ? wholesalePrice : retailPrice;

  function editRow(index: number, change: Partial<{ size: string; pairs: string }>) {
    setRows((current) => withOneBlankRow(current.map((entry, at) => (at === index ? { ...entry, ...change } : entry)), blankRow));
  }

  const retailBox = (
    <label className={label} key="retail">
      {isWholesale ? text("Retail price (optional)", "खुद्रा मूल्य (चाहे)") : text("Selling price (Rs.)", "बेच्ने मूल्य (रु.)")}
      <input
        ref={isWholesale ? undefined : priceBox}
        value={price}
        inputMode="numeric"
        data-summary="money"
        placeholder={isWholesale && wholesalePrice > 0 ? text(`blank: Rs. ${wholesalePrice}`, `खाली भए रु. ${wholesalePrice}`) : ""}
        onChange={(event) => { setPrice(event.target.value); setLossConfirmed(false); setDoubtsConfirmed(false); }}
        className={isWholesale ? `${box} border-dashed` : box}
      />
    </label>
  );
  const wholesaleBox = (
    <label className={label} key="wholesale">
      {isWholesale ? text("Wholesale price (Rs.)", "थोक मूल्य (रु.)") : text("Wholesale price (optional)", "थोक मूल्य (चाहे)")}
      <input
        ref={isWholesale ? priceBox : undefined}
        value={wholesale}
        inputMode="numeric"
        data-summary="money"
        onChange={(event) => { setWholesale(event.target.value); setLossConfirmed(false); setDoubtsConfirmed(false); }}
        className={isWholesale ? box : `${box} border-dashed`}
      />
    </label>
  );

  function save() {
    if (problem || !ready) return;
    setRefusal(null);
    startSaving(async () => {
      const result = await createCounterItemAction({
        name,
        categorySlug,
        how: "pending_bill",
        supplierName: "",
        supplierBillNo: "",
        soldFirst: true,
        sizes,
        pilePairs,
        retailPrice,
        wholesalePrice,
        minWholesaleQty,
        channel,
        costPerPair,
        lossConfirmed,
        doubtsConfirmed,
        createdBy: "",
      });
      if (result.ok) onCreated(result.item);
      else setRefusal({ en: result.message, ne: result.messageNe, sameAs: result.sameAs });
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-brand-green-ink/40 sm:place-items-center" role="dialog" aria-modal="true" aria-label={text("New item", "नयाँ माल")}>
      <div
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto scroll-smooth rounded-t-3xl bg-brand-paper p-5 shadow-2xl sm:rounded-3xl"
        onFocusCapture={(event) => {
          // The box the cursor moves to is brought into view: the sheet is
          // taller than a phone, and Enter walked into boxes below the fold.
          const target = event.target as HTMLElement;
          if (target.matches("input, button, select, textarea")) target.scrollIntoView({ block: "center", behavior: "smooth" });
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-black text-brand-green-ink">
            ＋ {text("New item · selling now", "नयाँ माल · अहिले बेच्ने")}
            {isWholesale ? (
              <span className="ml-2 rounded-full bg-brand-green-wash px-3 py-0.5 align-middle text-sm text-brand-green">{text("wholesale bill", "थोक बिल")}</span>
            ) : null}
          </h2>
          <button type="button" onClick={onClose} className="min-h-10 rounded-full border border-brand-green-line px-4 text-sm font-bold">
            {text("Close", "बन्द")}
          </button>
        </div>

        {!ready ? (
          <p className="mt-3 rounded-xl bg-brand-cream-soft px-4 py-3 text-base font-bold text-brand-gold-ink">
            {text("The database is not ready for new goods yet.", "नयाँ मालका लागि database तयार छैन।")}{" "}
            {isOwner ? (
              <Link href="/admin/settings" className="underline">
                {text("Prepare it in Settings →", "Settings मा तयार गर्नुहोस् →")}
              </Link>
            ) : (
              text("Ask the Owner to prepare it in Settings.", "मालिकलाई Settings मा तयार गर्न भन्नुहोस्।")
            )}
          </p>
        ) : null}

        {/* Enter walks box to box — name, sizes, pairs, prices — and on the
            last asks before it saves (owner, 2026-09-30). */}
        <EnterWalkForm
          className="mt-4 grid gap-4"
          confirmTitle={name}
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label className={label}>
            {text("Name", "नाम")}
            <input value={name} onChange={(event) => setName(event.target.value)} className={box} autoFocus />
          </label>

          {/* Guard 1: one shoe, one name. */}
          {lookAlikes.length > 0 ? (
            <div className="grid gap-2 rounded-2xl border-2 border-brand-gold bg-brand-cream-soft p-3">
              <p className="text-base font-black text-brand-gold-ink">
                {text("Already on the books? Names that read the same:", "पहिले नै छ कि? मिल्दोजुल्दो नाम:")}
              </p>
              {lookAlikes.map((existing) => (
                <button
                  key={existing}
                  type="button"
                  onClick={() => onPickExisting(existing)}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-left text-base font-bold text-brand-green-ink"
                >
                  <span>{existing}</span>
                  <span className="text-brand-green">{text("This one →", "यही हो →")}</span>
                </button>
              ))}
            </div>
          ) : null}

          <ChoicePicker
            title={text("Kind", "किसिम")}
            hint={chosenKind === null && guessed ? text("from the name", "नामबाट अनुमान") : undefined}
            options={kinds.map((entry) => ({ id: entry.slug, en: entry.title, ne: entry.title }))}
            value={categorySlug}
            onChange={setChosenKind}
            text={text}
          />

          <div className={label}>
            {text("Selling now — size and pairs", "अहिले बेच्ने — साइज र जोडी")}
            <div className="grid gap-1.5">
              {rows.map((row, index) => (
                <div key={index} className="grid grid-cols-2 gap-2">
                  <input
                    ref={(element) => {
                      sizeBoxes.current[index] = element;
                    }}
                    value={row.size}
                    inputMode="numeric"
                    placeholder={text("Size", "साइज")}
                    onKeyDown={(event) => {
                      // An empty size is "no more sizes": on to the price,
                      // past the empty row (owner, 2026-09-30).
                      if (event.key === "Enter" && !event.shiftKey && !row.size.trim()) {
                        event.preventDefault();
                        priceBox.current?.focus();
                      }
                    }}
                    onChange={(event) => editRow(index, { size: event.target.value })}
                    className={index === rows.length - 1 && !row.size && !row.pairs ? `${box} border-dashed` : box}
                    aria-label={text(`Size, row ${index + 1}`, `साइज, लाइन ${index + 1}`)}
                  />
                  <input
                    value={row.pairs}
                    inputMode="numeric"
                    placeholder={text("Pairs", "जोडी")}
                    onChange={(event) => editRow(index, { pairs: event.target.value })}
                    className={index === rows.length - 1 && !row.size && !row.pairs ? `${box} border-dashed` : box}
                    aria-label={text(`Pairs, row ${index + 1}`, `जोडी, लाइन ${index + 1}`)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* The bill's own price, the one that must be typed, stands open;
              the rest are optional and fold under "+ more", where Enter does
              not go unless it is opened (owner, 2026-09-30). */}
          {isWholesale ? wholesaleBox : retailBox}

          <details
            open={moreOpen || losses.length > 0 || doubts.length > 0}
            onToggle={(event) => setMoreOpen((event.target as HTMLDetailsElement).open)}
            className="rounded-xl border border-dashed border-brand-green-line px-3 py-2"
          >
            <summary className="cursor-pointer text-sm font-black text-brand-green">
              ＋{" "}
              {isWholesale
                ? text("More (optional): retail price · cost · wholesale minimum", "थप (चाहे): खुद्रा मूल्य · लागत · थोकको न्यूनतम जोडी")
                : text("More (optional): wholesale price · cost", "थप (चाहे): थोक मूल्य · लागत")}
            </summary>
            <div className="mt-3 grid gap-2">
              {isWholesale ? retailBox : wholesaleBox}
              <div className="grid grid-cols-2 gap-2">
                <label className={label}>
                  {text("Cost of a pair (if known)", "एक जोडीको लागत (थाहा भए)")}
                  <input
                    value={cost}
                    inputMode="numeric"
                    onChange={(event) => { setCost(event.target.value); setLossConfirmed(false); setDoubtsConfirmed(false); }}
                    className={box}
                  />
                </label>
                {isWholesale || wholesalePrice > 0 ? (
                  <label className={label}>
                    {text("Wholesale minimum pairs (optional)", "थोकको न्यूनतम जोडी (चाहे)")}
                    <input
                      value={minPairs}
                      inputMode="numeric"
                      onChange={(event) => { setMinPairs(event.target.value); setDoubtsConfirmed(false); }}
                      className={`${box} border-dashed`}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          </details>

          {/* A figure that reads like a slip is asked about: KR-210 went in with
              a wholesale minimum of 77,766 pairs and a cost of Rs. 1. */}
          {doubts.length > 0 ? (
            <label className="flex items-start gap-2 rounded-xl border-2 border-brand-gold bg-brand-cream-soft px-3 py-2.5 text-base font-bold text-brand-gold-ink">
              <input type="checkbox" checked={doubtsConfirmed} onChange={(event) => setDoubtsConfirmed(event.target.checked)} className="mt-1 h-5 w-5" />
              <span>
                {text("Is this right?", "यो अंक ठीक हो?")} {doubts.map((doubt) => text(doubt.en, doubt.ne)).join(" ")}{" "}
                {text("Tick if it is, or change it above.", "ठीक भए टिक गर्नुहोस्, नभए माथि सच्याउनुहोस्।")}
              </span>
            </label>
          ) : null}

          {/* Guards 2 and 3: a loss is questioned, retail or wholesale; an unknown cost is said. */}
          {losses.length > 0 ? (
            <label className="flex items-start gap-2 rounded-xl bg-brand-clay-tint px-3 py-2.5 text-base font-bold text-brand-clay">
              <input type="checkbox" checked={lossConfirmed} onChange={(event) => setLossConfirmed(event.target.checked)} className="mt-1 h-5 w-5" />
              <span>
                {losses
                  .map((loss) =>
                    loss.which === "Wholesale"
                      ? text(`Wholesale: Rs. ${loss.gap} below cost a pair.`, `थोकमा जोडीमा रु. ${loss.gap} घाटा।`)
                      : text(`Retail: Rs. ${loss.gap} below cost a pair.`, `खुद्रामा जोडीमा रु. ${loss.gap} घाटा।`),
                  )
                  .join(" ")}{" "}
                {text("Tick if this is on purpose (a sale).", "जानीजानी (सेल) हो भने टिक गर्नुहोस्।")}
              </span>
            </label>
          ) : profits.length > 0 ? (
            <p className="rounded-xl bg-brand-green-wash px-3 py-2 text-base font-bold text-brand-green">
              {text(`Profit a pair: ${profits.join(" · ")} ✓`, `जोडीमा नाफा: ${profits.join(" · ")} ✓`)}
            </p>
          ) : anyPrice ? (
            <p className="rounded-xl bg-brand-cream-soft px-3 py-2 text-base font-bold text-brand-gold-ink">
              {text("No cost typed: its profit shows as “cost to come”.", "लागत लेखिएन: नाफा \"लागत बाँकी\" भनेर देखिन्छ।")}
            </p>
          ) : null}

          {pairs > 0 && billPrice > 0 ? (
            <p className="rounded-xl bg-brand-green-wash px-3 py-2 text-base font-black text-brand-green">
              {text(
                `${pairs} ${pairs === 1 ? "pair" : "pairs"} × Rs. ${billPrice.toLocaleString("en-IN")} = Rs. ${(pairs * billPrice).toLocaleString("en-IN")} → the bill`,
                `${pairs} जोडी × रु. ${billPrice.toLocaleString("en-IN")} = रु. ${(pairs * billPrice).toLocaleString("en-IN")} → बिलमा`,
              )}
            </p>
          ) : null}

          <p className="rounded-xl bg-brand-cream-soft px-3 py-2 text-sm font-bold text-brand-gold-ink">
            {text(
              "Stock: to be filled. It goes on the “stock to fill” list — fill it from its purchase bill, or count the shelf.",
              "स्टक: भर्न बाँकी। “स्टक भर्न बाँकी” सूचीमा जान्छ — खरिद बिलबाट वा र्‍याकमा गनेर भर्नुहोस्।",
            )}
          </p>

          {refusal ? (
            <div className="grid gap-2 rounded-xl bg-brand-clay-tint px-3 py-2.5 text-base font-bold text-brand-clay">
              <p>{text(refusal.en, refusal.ne)}</p>
              {refusal.sameAs.map((existing) => (
                <button key={existing} type="button" onClick={() => onPickExisting(existing)} className="w-fit underline">
                  {text(`Use ${existing} →`, `${existing} नै छान्ने →`)}
                </button>
              ))}
            </div>
          ) : problem ? (
            <p className="text-sm font-bold text-brand-muted">{text(problem.en, problem.ne)}</p>
          ) : null}

          <button
            type="submit"
            disabled={Boolean(problem) || !ready || saving}
            className="min-h-14 rounded-2xl bg-brand-green px-5 text-lg font-black text-white disabled:opacity-50"
          >
            {saving ? text("Saving…", "राख्दैछौँ…") : text("Add to the bill", "बिलमा थप्ने")}
          </button>
        </EnterWalkForm>
      </div>
    </div>
  );
}
