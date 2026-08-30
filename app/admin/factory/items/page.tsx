"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

type FactoryItem = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  material_cost_per_pair: number;
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

const inputClass = "min-h-12 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2 text-brand-green-ink";

export default function FactoryItemsPage() {
  const { text } = useLanguage();
  const [items, setItems] = useState<FactoryItem[]>([]);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [materialDrafts, setMaterialDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      // Retired items included, because this is the only screen that can
      // bring one back. Everywhere else they stay hidden.
      const response = await fetch("/api/factory/items?include=retired", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Items could not be loaded.");
      const nextItems = (data.items || []) as FactoryItem[];
      setItems(nextItems);
      setProductionItems((data.productionItems || []) as ProductionItem[]);
      setDrafts(Object.fromEntries(nextItems.map((item) => [item.id, item.production_item_id || ""])));
      setMaterialDrafts(Object.fromEntries(nextItems.map((item) => [
        item.id,
        Number(item.material_cost_per_pair) > 0 ? String(Number(item.material_cost_per_pair)) : "",
      ])));
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

  /**
   * Makes the Production Item this Factory Item should point at, and links it.
   *
   * The name is copied from the Factory Item rather than asked for. Two names
   * for one shoe is exactly how the factory ledger and the costing ledger drift
   * apart again, and the drift is what costs — not the typing.
   */
  /**
   * Take an item out of the work forms, or put it back.
   *
   * An item is created by typing its name while entering work, and a typo there
   * was permanent: one of the nine was called "45", because a rate had been
   * typed into the name box. Nothing in the app could remove it, so it sat in
   * every dropdown waiting to be picked by mistake.
   *
   * Retired, never deleted. The wages and daily work recorded against an item
   * stay exactly where they are — deleting would take a month of somebody's pay
   * with it, and could not be undone. This can, with the same button.
   */
  async function setItemStatus(itemId: string, status: "active" | "inactive") {
    setSaving(itemId);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/factory/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Item status could not be changed.");
      setMessage(
        status === "inactive"
          ? "बन्द भयो — अब काम भर्ने फारममा देखिँदैन। हिसाब जस्ताको तस्तै छ।"
          : "फेरि चालु भयो — अब काम भर्ने फारममा देखिन्छ।",
      );
      await loadItems();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Item status could not be changed.");
    } finally {
      setSaving("");
    }
  }

  async function createAndLink(itemId: string) {
    setSaving(itemId);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/factory/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, create_production_item: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Production Item could not be created.");
      setMessage("Production Item बनेर जोडियो — अब यो item को लागत निस्कन थाल्छ।");
      await loadItems();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Production Item could not be created.");
    } finally {
      setSaving("");
    }
  }

  /**
   * Save the owner's rough material cost per pair for an item.
   *
   * No BOM recipe exists yet, so this is one figure the owner keeps in their
   * head — leather + sole + glue for a pair. Costing adds it to labour and
   * overhead so profit per design stops assuming material is free.
   */
  async function saveMaterial(itemId: string) {
    const raw = (materialDrafts[itemId] || "").trim();
    const value = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      setError("Material cost must be a number of 0 or more.");
      return;
    }
    setSaving(itemId);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/factory/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, material_cost_per_pair: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Material cost could not be saved.");
      setMessage(text(
        "Material cost saved — it now adds to the cost per pair in costing.",
        "Material लागत सेभ भयो — अब costing मा प्रति जोडी लागतमा जोडिन्छ।",
      ));
      await loadItems();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Material cost could not be saved.");
    } finally {
      setSaving("");
    }
  }

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
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">कारखानाका item</p>
          <h1 className="mt-2 font-display text-2xl font-black text-brand-green-ink sm:text-3xl">
            item र दर <span className="text-lg font-bold text-brand-muted">· Item Master linkage</span>
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
            Factory Item is used for daily piece wages. Production Item Master carries BOM, stage rates, Work Orders, costing and finished-stock identity. Link them once so both systems refer to the same product.
          </p>
        </div>
        <Link href="/admin/operations/production-accounts" className="min-h-11 rounded-full border border-brand-green px-5 py-3 text-sm font-black text-brand-green">Open Production Item Master</Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-900">{linkedCount} linked</span>
        <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-900">{items.length - linkedCount} need linking</span>
        <span className="rounded-full bg-brand-mist px-3 py-1.5 text-brand-muted-deep">{productionItems.length} active Production Items</span>
      </div>

      {message ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">{message}</p> : null}
      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{error}</p> : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {loading ? <p className="text-sm text-brand-muted">Loading Factory Items...</p> : null}
        {!loading && items.length === 0 ? (
          <p className="rounded-2xl border border-brand-green-line bg-brand-paper p-5 text-sm text-brand-muted">
            No Factory Item exists yet. Add the product while entering factory work, then return here to link it.
          </p>
        ) : null}
        {items.map((item) => (
          <article key={item.id} className={`rounded-3xl border p-5 shadow-sm ${item.status !== "active" ? "border-brand-green-line bg-brand-paper-deep" : item.production_item_id ? "border-emerald-200 bg-brand-paper" : "border-amber-200 bg-brand-paper"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className={`text-lg font-black ${item.status !== "active" ? "text-brand-muted line-through" : "text-brand-green-ink"}`}>{item.name}</h2>
                <p className="mt-1 text-xs font-semibold text-brand-muted">Factory code: {item.code || "Not set"}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${item.status !== "active" ? "bg-brand-green-line text-brand-muted-deep" : item.production_item_id ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{item.status !== "active" ? "बन्द" : item.production_item_id ? "Master linked" : "Link needed"}</span>
            </div>

            {/* Nothing to link while an item is out of use. Offering it would
                invite someone to wire up a shoe that no work form can reach. */}
            {item.status === "active" ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
              <select value={drafts[item.id] || ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} className={inputClass} aria-label={`Production Item for ${item.name}`}>
                <option value="">Not linked</option>
                {productionItems.filter((productionItem) => !linkedIds.has(productionItem.id) || productionItem.id === item.production_item_id).map((productionItem) => (
                  <option key={productionItem.id} value={productionItem.id}>{productionItem.name} · {productionItem.category} · {productionItem.size_group}</option>
                ))}
              </select>
              <button type="button" onClick={() => void saveLink(item.id)} disabled={saving === item.id || (drafts[item.id] || "") === (item.production_item_id || "")} className="min-h-12 rounded-xl border border-brand-green px-4 text-sm font-black text-brand-green disabled:border-brand-green-line disabled:text-brand-muted-soft">{saving === item.id ? "Saving..." : "Save item link"}</button>
            </div>
            ) : null}

            {/* Rough material cost per pair — leather + sole + glue for one
                pair — the one figure the owner keeps in their head until a full
                BOM exists. Costing adds it to labour and overhead so profit per
                design is real, not material-free. */}
            {item.status === "active" ? (
            <div className="mt-3">
              <label className="text-xs font-black uppercase tracking-[0.12em] text-brand-muted" htmlFor={`material-${item.id}`}>
                {text("Material cost · per pair (Rs.)", "Material लागत · प्रति जोडी (Rs.)")}
              </label>
              <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  id={`material-${item.id}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={1}
                  placeholder={text("e.g. 250", "जस्तै 250")}
                  value={materialDrafts[item.id] ?? ""}
                  onChange={(event) => setMaterialDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => void saveMaterial(item.id)}
                  disabled={saving === item.id || (materialDrafts[item.id] ?? "") === (Number(item.material_cost_per_pair) > 0 ? String(Number(item.material_cost_per_pair)) : "")}
                  className="min-h-12 rounded-xl border border-brand-green px-4 text-sm font-black text-brand-green disabled:border-brand-green-line disabled:text-brand-muted-soft"
                >
                  {saving === item.id ? "Saving..." : "Save material"}
                </button>
              </div>
              <p className="mt-1 text-xs text-brand-muted">{text(
                "Fabric + sole + glue — the estimated cost of one pair. Left blank counts as 0.",
                "कपडा + sole + गम — एक जोडीको अनुमानित लागत। खाली राखे 0 मानिन्छ।",
              )}</p>
            </div>
            ) : null}

            {/* The dropdown above can only offer Production Items that already
                exist, and eight of nine factory items had nothing to point at.
                Making each one meant leaving this screen, creating it, coming
                back and choosing it — which is why, after months, not one link
                had been made. */}
            {item.status !== "active" ? (
              <button
                type="button"
                onClick={() => void setItemStatus(item.id, "active")}
                disabled={saving === item.id}
                className="mt-2 min-h-12 w-full rounded-xl border border-brand-green px-4 text-sm font-black text-brand-green disabled:opacity-60"
              >
                {saving === item.id ? "गर्दैछौँ…" : "फेरि चालु गर्ने"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void setItemStatus(item.id, "inactive")}
                disabled={saving === item.id}
                className="mt-2 min-h-12 w-full rounded-xl border border-brand-green-line px-4 text-sm font-bold text-brand-muted disabled:opacity-60"
              >
                {saving === item.id ? "गर्दैछौँ…" : "बन्द गर्ने — काम भर्ने फारमबाट हटाउने"}
              </button>
            )}

            {!item.production_item_id && item.status === "active" ? (
              <button
                type="button"
                onClick={() => void createAndLink(item.id)}
                disabled={saving === item.id}
                className="mt-2 min-h-12 w-full rounded-xl bg-brand-green px-4 text-sm font-black text-white disabled:opacity-60"
              >
                {saving === item.id ? "बनाउँदैछौँ…" : `“${item.name}” को Production Item बनाएर जोड्ने`}
              </button>
            ) : null}
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-brand-green-line bg-brand-green-wash p-4 text-sm leading-6 text-brand-green">
        Linking does not automatically increase stock. Finished stock still increases only after Packing/QC approval, which prevents wage entries from creating duplicate stock.
      </div>
    </section>
  );
}
