"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { createCounterItemAction, type CounterItemResult } from "@/app/admin/pos/actions";
import {
  counterItemProblem,
  sellsAtLoss,
  similarNames,
  tidySizes,
  totalPairs,
  type CounterItemHow,
} from "@/lib/counter-item-rules";
import { categories } from "@/lib/products";

type Created = Extract<CounterItemResult, { ok: true }>["item"];

const HOWS: Array<{ id: CounterItemHow; en: string; ne: string }> = [
  { id: "old", en: "Already on the shelf", ne: "पसलमा पहिले नै थियो" },
  { id: "pending_bill", en: "Arrived, bill to come", ne: "नयाँ आयो, बिल आउन बाँकी" },
  { id: "factory", en: "Made in our factory", ne: "आफ्नै कारखानाको" },
];

const box =
  "h-12 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base font-bold text-brand-green-ink outline-none focus:border-brand-green";
const label = "grid gap-1 text-sm font-bold text-brand-muted";
const chip = (on: boolean) =>
  `min-h-10 rounded-full border px-3.5 text-sm font-bold ${
    on ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"
  }`;

/**
 * "+ New item" on the counter bill (owner, 2026-09-29): goods on the shelf that
 * were never entered, put on the books in one form and sold at once.
 *
 * Before anything is made it offers the names already on the books that read
 * like the one typed — one shoe, one name. A price below the typed cost asks
 * to be confirmed. An unknown cost is allowed and shown as "cost to come".
 */
export default function PosNewItemSheet({
  initialName,
  knownNames,
  ready,
  isOwner,
  onPickExisting,
  onCreated,
  onClose,
}: {
  initialName: string;
  knownNames: string[];
  ready: boolean;
  isOwner: boolean;
  onPickExisting: (name: string) => void;
  onCreated: (item: Created) => void;
  onClose: () => void;
}) {
  const { text } = useLanguage();
  const [name, setName] = useState(initialName.trim());
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? "");
  const [how, setHow] = useState<CounterItemHow>("old");
  const [supplierName, setSupplierName] = useState("");
  const [supplierBillNo, setSupplierBillNo] = useState("");
  const [rows, setRows] = useState<Array<{ size: string; pairs: string }>>([
    { size: "", pairs: "" },
    { size: "", pairs: "" },
    { size: "", pairs: "" },
  ]);
  const [pile, setPile] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [lossConfirmed, setLossConfirmed] = useState(false);
  const [refusal, setRefusal] = useState<{ en: string; ne: string; sameAs: string[] } | null>(null);
  const [saving, startSaving] = useTransition();

  const lookAlikes = useMemo(() => similarNames(name, knownNames), [name, knownNames]);
  const sizes = tidySizes(rows);
  const pilePairs = Math.round(Number(pile) || 0);
  const retailPrice = Number(price) || 0;
  const costPerPair = Number(cost) || 0;
  const pairs = totalPairs(sizes, pilePairs);
  const problem = counterItemProblem({ name, how, sizes, pilePairs, retailPrice, costPerPair, lossConfirmed });
  const atLoss = sellsAtLoss(retailPrice, costPerPair);

  function save() {
    if (problem || !ready) return;
    setRefusal(null);
    startSaving(async () => {
      const result = await createCounterItemAction({
        name,
        categorySlug,
        how,
        supplierName,
        supplierBillNo,
        sizes,
        pilePairs,
        retailPrice,
        costPerPair,
        lossConfirmed,
        createdBy: "",
      });
      if (result.ok) onCreated(result.item);
      else setRefusal({ en: result.message, ne: result.messageNe, sameAs: result.sameAs });
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-brand-green-ink/40 sm:place-items-center" role="dialog" aria-modal="true" aria-label={text("New item", "नयाँ माल")}>
      <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-brand-paper p-5 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-black text-brand-green-ink">＋ {text("New item", "नयाँ माल")}</h2>
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

        <div className="mt-4 grid gap-4">
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

          <div className={label}>
            {text("Kind", "किसिम")}
            <div className="flex flex-wrap gap-1.5">
              {categories
                .filter((entry) => entry.slug !== "new-arrivals")
                .map((entry) => (
                  <button key={entry.slug} type="button" onClick={() => setCategorySlug(entry.slug)} className={chip(categorySlug === entry.slug)}>
                    {entry.title}
                  </button>
                ))}
            </div>
          </div>

          <div className={label}>
            {text("How did it come?", "यो माल कसरी आयो?")}
            <div className="flex flex-wrap gap-1.5">
              {HOWS.map((option) => (
                <button key={option.id} type="button" onClick={() => setHow(option.id)} className={chip(how === option.id)}>
                  {text(option.en, option.ne)}
                </button>
              ))}
            </div>
          </div>

          {how === "pending_bill" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className={label}>
                {text("Supplier (if known)", "साहु (थाहा भए)")}
                <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} className={box} />
              </label>
              <label className={label}>
                {text("Bill no. (later is fine)", "बिल नं. (पछि पनि हुन्छ)")}
                <input value={supplierBillNo} onChange={(event) => setSupplierBillNo(event.target.value)} className={box} />
              </label>
            </div>
          ) : null}

          <div className={label}>
            {text("Pairs by size", "साइज अनुसार जोडी")}
            <div className="grid gap-1.5">
              {rows.map((row, index) => (
                <div key={index} className="grid grid-cols-2 gap-2">
                  <input
                    value={row.size}
                    inputMode="numeric"
                    placeholder={text("Size", "साइज")}
                    onChange={(event) =>
                      setRows((current) => current.map((entry, at) => (at === index ? { ...entry, size: event.target.value } : entry)))
                    }
                    className={box}
                    aria-label={text(`Size, row ${index + 1}`, `साइज, लाइन ${index + 1}`)}
                  />
                  <input
                    value={row.pairs}
                    inputMode="numeric"
                    placeholder={text("Pairs", "जोडी")}
                    onChange={(event) =>
                      setRows((current) => current.map((entry, at) => (at === index ? { ...entry, pairs: event.target.value } : entry)))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && index === rows.length - 1) {
                        event.preventDefault();
                        setRows((current) => [...current, { size: "", pairs: "" }]);
                      }
                    }}
                    className={box}
                    aria-label={text(`Pairs, row ${index + 1}`, `जोडी, लाइन ${index + 1}`)}
                  />
                </div>
              ))}
              <button type="button" onClick={() => setRows((current) => [...current, { size: "", pairs: "" }])} className="w-fit text-sm font-black text-brand-green underline">
                ＋ {text("Another size", "अर्को साइज")}
              </button>
            </div>
          </div>

          <label className={label}>
            {text("Pairs with sizes not counted (optional)", "साइज नगनिएका जोडी (चाहे)")}
            <input value={pile} inputMode="numeric" onChange={(event) => setPile(event.target.value)} className={box} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className={label}>
              {text("Selling price (Rs.)", "बेच्ने मूल्य (रु.)")}
              <input value={price} inputMode="numeric" onChange={(event) => setPrice(event.target.value)} className={box} />
            </label>
            <label className={label}>
              {text("Cost of a pair (if known)", "एक जोडीको लागत (थाहा भए)")}
              <input value={cost} inputMode="numeric" onChange={(event) => { setCost(event.target.value); setLossConfirmed(false); }} className={box} />
            </label>
          </div>

          {/* Guards 2 and 3: a loss is questioned; an unknown cost is said. */}
          {atLoss ? (
            <label className="flex items-start gap-2 rounded-xl bg-brand-clay-tint px-3 py-2.5 text-base font-bold text-brand-clay">
              <input type="checkbox" checked={lossConfirmed} onChange={(event) => setLossConfirmed(event.target.checked)} className="mt-1 h-5 w-5" />
              <span>
                {text(
                  `Rs. ${costPerPair - retailPrice} below cost on every pair. Tick if this is on purpose (a sale).`,
                  `हरेक जोडीमा रु. ${costPerPair - retailPrice} घाटा। जानीजानी (सेल) हो भने टिक गर्नुहोस्।`,
                )}
              </span>
            </label>
          ) : retailPrice > 0 && costPerPair > 0 ? (
            <p className="rounded-xl bg-brand-green-wash px-3 py-2 text-base font-bold text-brand-green">
              {text(`Rs. ${retailPrice - costPerPair} profit a pair ✓`, `एक जोडीमा रु. ${retailPrice - costPerPair} नाफा ✓`)}
            </p>
          ) : retailPrice > 0 ? (
            <p className="rounded-xl bg-brand-cream-soft px-3 py-2 text-base font-bold text-brand-gold-ink">
              {text("No cost typed: its profit shows as “cost to come”.", "लागत लेखिएन: नाफा \"लागत बाँकी\" भनेर देखिन्छ।")}
            </p>
          ) : null}

          <p className="text-sm font-semibold text-brand-muted">
            {text(
              `${pairs} pairs go to the shop's stock, placed at the shop. It gets the next shoe code and stays hidden from the website until you add a photo.`,
              `${pairs} जोडी पसलको स्टकमा, "पसल" मा चढ्छन्। नयाँ कोड पाउँछ, र फोटो नराखेसम्म वेबसाइटमा लुकेर रहन्छ।`,
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
            type="button"
            onClick={save}
            disabled={Boolean(problem) || !ready || saving}
            className="min-h-14 rounded-2xl bg-brand-green px-5 text-lg font-black text-white disabled:opacity-50"
          >
            {saving ? text("Saving…", "राख्दैछौँ…") : text("Save and add to the bill", "सेभ गरेर बिलमा थप्ने")}
          </button>
        </div>
      </div>
    </div>
  );
}
