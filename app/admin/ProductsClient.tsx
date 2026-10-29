"use client";

import { originOf, type StockOrigin } from "@/lib/stock-origin";
import SafeImage from "@/components/SafeImage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Product } from "@/lib/products";
import { hasNoPhoto, isSamplePhoto, photoAdvice } from "@/lib/product-photo";
import { PencilIcon, TrashIcon } from "@/components/Icons";
import ActionMessage from "@/components/admin/ActionMessage";
import { deleteProductAction, type ActionState } from "@/app/admin/actions";
import { useLanguage } from "@/components/LanguageProvider";
import { StatStrip } from "@/components/admin/PageKit";

function StatusBadge({ status }: { status: string }) {
  const { text } = useLanguage();
  const baseClasses = "rounded-full px-2.5 py-1 text-xs font-semibold";
  switch (status.toLowerCase()) {
    case "active":
      return <span className={`${baseClasses} bg-green-100 text-green-800`}>{text("On the website", "वेबसाइटमा")}</span>;
    case "draft":
      return <span className={`${baseClasses} bg-brand-mist text-brand-green-ink`}>{text("Draft", "Draft")}</span>;
    default:
      return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>;
  }
}

type Filter = "all" | "web" | "draft";

type ProductsClientProps = {
  products: Product[];
  editingId?: string | null;
  /** Made or bought, by shoe (lib/stock-origin.ts). */
  origins?: Record<string, StockOrigin>;
};

export default function ProductsClient({ products, editingId = null, origins = {} }: ProductsClientProps) {
  const { text } = useLanguage();
  const router = useRouter();
  const [state, setState] = useState<ActionState | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  // Website or draft (owner, 2026-10-12): the ten drafts holding 399 pairs
  // were found only by reading the whole list.
  const [filter, setFilter] = useState<Filter>("all");

  // A delete that failed used to replace the whole page with the app's error
  // screen. Report it above the table instead and leave the list standing.
  const handleDelete = (product: Product) => {
    if (!window.confirm(text(`Delete ${product.name}? This cannot be undone.`, `${product.name} मेट्ने? यो फर्काउन मिल्दैन।`))) {
      return;
    }

    const formData = new FormData();
    formData.append("id", product.id);

    startDeleting(async () => {
      const result = await deleteProductAction(state, formData);
      setState(result.ok ? { ...result, message: text(`Deleted ${product.name}.`, `${product.name} मेटियो।`) } : result);

      if (result.ok) {
        router.refresh();
      }
    });
  };

  if (products.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-brand-green-line bg-brand-paper p-8 text-center">
        <h2 className="text-lg font-black text-brand-green-ink">{text("No products yet", "अझै कुनै सामान छैन")}</h2>
        <p className="mt-2 text-sm text-brand-muted">{text("Create your first product from \"＋ Add a product\" below.", "तलको \"＋ नयाँ जुत्ता थप्ने\" बाट पहिलो सामान बनाउनुहोस्।")}</p>
      </div>
    );
  }

  // Counted over what is on sale. A stand-in on a draft costs nothing; a
  // stand-in on a shoe with stock is shown to every shopper who finds it.
  const wrongPhotos = products.filter(
    (product) =>
      product.stock > 0 && (isSamplePhoto(product.image) || hasNoPhoto(product.image)),
  );

  // Shoes whose real photo could sell better — one photo, or a WhatsApp snap.
  const betterPhotos = products
    .filter((product) => product.stock > 0)
    .map((product) => ({ product, advice: photoAdvice(product) }))
    .filter((entry) => entry.advice.length > 0);

  const isWeb = (product: Product) => product.status.toLowerCase() === "active";
  const wrongOnWeb = wrongPhotos.filter(isWeb);
  const wrongInDraft = wrongPhotos.filter((product) => !isWeb(product));
  const pairsOf = (list: Product[]) => list.reduce((total, product) => total + product.stock, 0);
  const webCount = products.filter(isWeb).length;
  const draftCount = products.length - webCount;
  const draftsWithPairs = products.filter((product) => !isWeb(product) && product.stock > 0).length;
  const noPhoto = products.filter((product) => product.stock > 0 && (isSamplePhoto(product.image) || hasNoPhoto(product.image))).length;
  const shown = products.filter((product) => (filter === "web" ? isWeb(product) : filter === "draft" ? !isWeb(product) : true));
  const filters: Array<{ key: Filter; en: string; ne: string; count: number }> = [
    { key: "all", en: "All", ne: "सबै", count: products.length },
    { key: "web", en: "🌐 Website", ne: "🌐 वेबसाइट", count: webCount },
    { key: "draft", en: "📝 Draft", ne: "📝 Draft", count: draftCount },
  ];

  return (
    <div className="mt-6 space-y-4">
      <ActionMessage state={state} />

      <StatStrip
        items={[
          { en: "on the website", ne: "वेबसाइटमा", value: webCount },
          { en: "draft with pairs", ne: "जोडी भएका Draft", value: draftsWithPairs, tone: draftsWithPairs > 0 ? "warn" : undefined },
          { en: "with pairs, no real photo", ne: "जोडी छ, फोटो छैन", value: noPhoto, tone: noPhoto > 0 ? "warn" : undefined },
        ]}
      />

      <div role="tablist" aria-label={text("Which products", "कुन सामान")} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {filters.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={filter === entry.key}
            onClick={() => setFilter(entry.key)}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-black ${
              filter === entry.key ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"
            }`}
          >
            {text(entry.en, entry.ne)} <span className="tabular-nums opacity-80">{entry.count}</span>
          </button>
        ))}
      </div>

      {betterPhotos.length > 0 ? (
        <details className="rounded-lg border border-brand-gold bg-brand-cream-soft p-4">
          <summary className="cursor-pointer text-sm font-black text-brand-gold-deep">
            📷 {text(`${betterPhotos.length} shoe(s) would sell better with better photos`, `${betterPhotos.length} जुत्ताको फोटो अझ राम्रो बनाउँदा धेरै बिक्छ`)}
          </summary>
          <ul className="mt-2 grid gap-1.5">
            {betterPhotos.map(({ product, advice }) => (
              <li key={product.id} className="text-sm text-brand-green-ink">
                <b>{product.name}</b> — {advice.map((item) => text(item.en, item.ne)).join(" · ")}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* On the website or in Draft, said apart (owner, 2026-10-12): the box
          said all eleven were on sale when ten were drafts no customer sees. */}
      {wrongPhotos.length > 0 ? (
        <div className="rounded-lg border border-brand-clay bg-brand-clay-tint p-4">
          <h2 className="text-sm font-black text-brand-clay">
            📷 {text(`${wrongPhotos.length} shoe photo(s) not right`, `${wrongPhotos.length} जुत्ताको फोटो मिलेको छैन`)}
          </h2>
          <p className="mt-1 text-sm leading-6 text-brand-clay">
            {wrongOnWeb.length > 0
              ? text(
                  `${wrongOnWeb.length} on the website: customers see the wrong photo — ${pairsOf(wrongOnWeb)} pairs will not sell this way. `,
                  `${wrongOnWeb.length} वेबसाइटमा छन्: ग्राहकले गलत फोटो देख्छन् — ${pairsOf(wrongOnWeb)} जोर जुत्ता यसरी बिक्दैन। `,
                )
              : null}
            {wrongInDraft.length > 0
              ? text(
                  `${wrongInDraft.length} in Draft (customers do not see them): a real photo first, then they can go on sale. `,
                  `${wrongInDraft.length} Draft मा छन् (ग्राहकले देख्दैनन्): पहिले साँचो फोटो, अनि बिक्रीमा राख्न मिल्छ। `,
                )
              : null}
            {text("You can snap and upload right from a phone.", "मोबाइलबाटै खिचेर हाल्न मिल्छ।")}
          </p>
          <ul className="mt-2 space-y-1">
            {wrongPhotos.map((product) => (
              <li key={product.id} className="text-sm font-bold text-brand-clay">
                • {product.name} ({text(`${product.stock} pairs`, `${product.stock} जोर`)}) ·{" "}
                {isWeb(product) ? text("on the website", "वेबसाइटमा") : text("Draft", "Draft")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="grid list-none gap-2 pl-0 md:hidden">
        {shown.map((product) => {
          const missingPhoto = isSamplePhoto(product.image) || hasNoPhoto(product.image);
          return (
            <li
              key={`card-${product.id}`}
              className={`grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-brand-green-line p-2.5 ${
                editingId === product.id ? "bg-brand-mist" : "bg-brand-paper"
              }`}
            >
              <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-brand-mist">
                <SafeImage src={product.image} alt={product.name} fill sizes="64px" className="object-cover" />
              </div>
              <div className="grid min-w-0 gap-1">
                <div className="flex items-start justify-between gap-2">
                  <b className="truncate text-brand-green-ink">{product.name}</b>
                  <StatusBadge status={product.status} />
                </div>
                <p className="text-xs text-brand-muted">
                  <span className="font-mono">{product.sku}</span> · {product.price} ·{" "}
                  <span className={product.stock > 0 ? "font-bold text-brand-green" : "font-bold text-brand-clay"}>
                    {product.stock > 0 ? text(`${product.stock} pairs`, `${product.stock} जोडी`) : text("out", "सकियो")}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {product.stock > 0 && (missingPhoto || !isWeb(product)) ? (
                    <Link
                      href={`/admin/products?edit=${encodeURIComponent(product.id)}`}
                      className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
                    >
                      📷 {missingPhoto ? text("Add a photo → put on sale", "फोटो राखेर बिक्रीमा →") : text("Put on sale →", "बिक्रीमा राख्ने →")}
                    </Link>
                  ) : null}
                  <Link
                    href={`/admin/products?edit=${encodeURIComponent(product.id)}`}
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-black/10 px-3 text-xs font-bold text-brand-green"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                    {text("Edit", "मिलाउने")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(product)}
                    disabled={isDeleting}
                    aria-label={text(`Delete ${product.name}`, `${product.name} मेट्ने`)}
                    className="ml-auto inline-grid h-8 w-8 place-items-center rounded-full border border-red-200 text-red-700 disabled:opacity-50"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border border-brand-green-line bg-brand-paper md:block">
      <table className="reflow-table min-w-full divide-y divide-brand-green-line text-sm">
        <thead className="bg-brand-paper-deep">
          <tr>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-brand-green-ink"></th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-brand-green-ink">{text("Product", "सामान")}</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-brand-green-ink">{text("Code", "कोड")}</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-brand-green-ink">{text("Price", "मूल्य")}</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-brand-green-ink">{text("Stock", "स्टक")}</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-brand-green-ink">{text("Status", "अवस्था")}</th>
            <th className="px-4 py-3">
              <span className="sr-only">{text("Actions", "काम")}</span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-brand-green-line">
          {shown.map((product) => (
            <tr key={product.id} className={editingId === product.id ? "bg-brand-mist" : undefined}>
              <td data-label={text("Photo", "फोटो")} className="whitespace-nowrap px-4 py-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-md bg-brand-mist">
                  <SafeImage src={product.image} alt={product.name} fill sizes="48px" className="object-cover" />
                </div>
              </td>
              <td className="reflow-primary whitespace-nowrap px-4 py-3 font-medium text-brand-green-ink">
                {product.name}
                {/* Stock repeated here, under the name, so it is in view on a
                    phone without scrolling the wide table sideways to the Stock
                    column. Clay when there is nothing to sell. */}
                <span
                  className={`mt-1 block text-xs font-semibold ${
                    product.stock > 0 ? "text-brand-muted" : "text-brand-clay"
                  }`}
                >
                  {product.stock > 0 ? text(`${product.stock} in stock`, `स्टकमा ${product.stock}`) : text("Out of stock", "स्टक सकियो")}
                </span>
                {/* Made in our factory or bought ready-made: both are finished goods,
                    and both have a card here (owner, 2026-10-29). */}
                {(() => {
                  const origin = originOf(origins, product.name);
                  if (!origin) return null;
                  return (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {origin.made ? (
                        <span className="rounded-full bg-brand-green-wash px-2 py-0.5 text-xs font-black text-brand-green">🏭 {text("Made", "बनाएको")}</span>
                      ) : null}
                      {origin.bought ? (
                        <span className="rounded-full bg-brand-cream-soft px-2 py-0.5 text-xs font-black text-brand-gold-ink">🛒 {text("Bought", "किनेको")}</span>
                      ) : null}
                    </span>
                  );
                })()}
                {/* A stand-in photograph is not a missing one. It looks
                    finished, so nobody goes back to it — which is how three
                    shoes with stock ended up showing a picture of something
                    else. Said here, beside the name, where the fix is one
                    click away. */}
                {isSamplePhoto(product.image) ? (
                  <span className="mt-1 block text-xs font-bold text-brand-clay">
                    ⚠️ {text("Sample photo — not the real shoe", "नमुना फोटो — असली जुत्ताको होइन")}
                  </span>
                ) : hasNoPhoto(product.image) ? (
                  <span className="mt-1 block text-xs font-bold text-brand-clay">
                    ⚠️ {text("No photo", "फोटो छैन")}
                  </span>
                ) : null}
              </td>
              <td data-label={text("Code", "कोड")} className="whitespace-nowrap px-4 py-3 font-mono text-brand-muted-deep">{product.sku}</td>
              <td data-label={text("Price", "मूल्य")} className="whitespace-nowrap px-4 py-3 text-brand-muted-deep">{product.price}</td>
              <td data-label={text("Stock", "स्टक")} className="whitespace-nowrap px-4 py-3">
                <span
                  className={`inline-flex min-w-9 justify-center rounded-full px-2.5 py-1 text-xs font-black ${
                    product.stock > 0
                      ? "bg-brand-green-tint text-brand-green"
                      : "bg-brand-clay-tint text-brand-clay"
                  }`}
                >
                  {product.stock}
                </span>
              </td>
              <td data-label={text("Status", "अवस्था")} className="whitespace-nowrap px-4 py-3">
                <StatusBadge status={product.status} />
              </td>
              <td data-label="" className="whitespace-nowrap px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/admin/products?edit=${encodeURIComponent(product.id)}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 px-3 text-xs font-bold text-brand-green transition hover:bg-brand-mist"
                  >
                    <PencilIcon className="h-4 w-4" />
                    {text("Edit", "मिलाउने")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(product)}
                    disabled={isDeleting}
                    aria-label={text(`Delete ${product.name}`, `${product.name} मेट्ने`)}
                    className="inline-grid h-9 w-9 place-items-center rounded-full border border-red-200 text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
