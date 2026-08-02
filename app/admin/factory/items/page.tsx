"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type FactoryItem = {
  id: string;
  name: string;
  code: string | null;
  production_item_id: string | null;
  production_item_name: string | null;
};

type ProductionItem = {
  id: string;
  name: string;
  category: string;
  production_type: string;
  size_group: string;
};

const inputClass = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900";

export default function FactoryItemsPage() {
  const [items, setItems] = useState<FactoryItem[]>([]);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/factory/items", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Items could not be loaded.");
      const nextItems = (data.items || []) as FactoryItem[];
      setItems(nextItems);
      setProductionItems((data.productionItems || []) as ProductionItem[]);
      setDrafts(Object.fromEntries(nextItems.map((item) => [item.id, item.production_item_id || ""])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Items could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadId = window.setTimeout(() => void loadItems(), 0);
    return () => window.clearTimeout(loadId);
  }, [loadItems]);

  const linkedIds = useMemo(
    () => new Set(items.map((item) => item.production_item_id).filter(Boolean)),
    [items],
  );

  async function saveLink(itemId: string) {
    setSaving(itemId);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/factory/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, production_item_id: drafts[itemId] || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Item link could not be saved.");
      setMessage("Factory Item and Production Item Master are now linked.");
      await loadItems();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Item link could not be saved.");
    } finally {
      setSaving("");
    }
  }

  const linkedCount = items.filter((item) => item.production_item_id).length;

  return (
    <section className="p-4 pb-28 sm:p-6 sm:pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Factory item control</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Item Master linkage</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Factory Item is used for daily piece wages. Production Item Master carries BOM, stage rates, Work Orders, costing and finished-stock identity. Link them once so both systems refer to the same product.
          </p>
        </div>
        <Link href="/admin/operations/production-accounts" className="min-h-11 rounded-full border border-brand-green px-5 py-3 text-sm font-black text-brand-green">Open Production Item Master</Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-900">{linkedCount} linked</span>
        <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-900">{items.length - linkedCount} need linking</span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">{productionItems.length} active Production Items</span>
      </div>

      {message ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">{message}</p> : null}
      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{error}</p> : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {loading ? <p className="text-sm text-slate-500">Loading Factory Items...</p> : null}
        {!loading && items.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            No Factory Item exists yet. Add the product while entering factory work, then return here to link it.
          </p>
        ) : null}
        {items.map((item) => (
          <article key={item.id} className={`rounded-3xl border bg-white p-5 shadow-sm ${item.production_item_id ? "border-emerald-200" : "border-amber-200"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">{item.name}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">Factory code: {item.code || "Not set"}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${item.production_item_id ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{item.production_item_id ? "Master linked" : "Link needed"}</span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
              <select value={drafts[item.id] || ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} className={inputClass} aria-label={`Production Item for ${item.name}`}>
                <option value="">Not linked</option>
                {productionItems.filter((productionItem) => !linkedIds.has(productionItem.id) || productionItem.id === item.production_item_id).map((productionItem) => (
                  <option key={productionItem.id} value={productionItem.id}>{productionItem.name} · {productionItem.category} · {productionItem.size_group}</option>
                ))}
              </select>
              <button type="button" onClick={() => void saveLink(item.id)} disabled={saving === item.id || (drafts[item.id] || "") === (item.production_item_id || "")} className="min-h-12 rounded-xl border border-brand-green px-4 text-sm font-black text-brand-green disabled:border-slate-200 disabled:text-slate-400">{saving === item.id ? "Saving..." : "Save item link"}</button>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        Linking does not automatically increase stock. Finished stock still increases only after Packing/QC approval, which prevents wage entries from creating duplicate stock.
      </div>
    </section>
  );
}
