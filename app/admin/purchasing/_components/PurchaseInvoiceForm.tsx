"use client";

import { useState } from "react";
import { createPurchaseInvoiceAction } from "@/app/admin/purchasing/actions";
import type { PurchaseKind, SupplierLedger } from "@/lib/purchasing";
import type { RawMaterial } from "@/lib/operations";

const inputClass =
  "h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-green";
const textareaClass =
  "min-h-24 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green";

type PurchaseInvoiceFormProps = {
  supplierLedgers: SupplierLedger[];
  rawMaterials: RawMaterial[];
  // Catalog product names. A trading goods purchase writes the chosen name into
  // finished stock, which is what the storefront catalog sync matches against —
  // so this must be a picker, never free text.
  productNames: string[];
};

const kindTabs: { value: PurchaseKind; label: string; detail: string }[] = [
  {
    value: "Raw Material",
    label: "Raw material",
    detail: "Posts the supplier ledger and increases raw material received stock for the factory.",
  },
  {
    value: "Trading Goods",
    label: "Trading goods",
    detail:
      "Ready-made stock bought to resell. Posts the supplier ledger and adds pairs to finished stock for the channel you pick, then updates the shop catalog.",
  },
];

export default function PurchaseInvoiceForm({
  supplierLedgers,
  rawMaterials,
  productNames,
}: PurchaseInvoiceFormProps) {
  const [kind, setKind] = useState<PurchaseKind>("Raw Material");
  const trading = kind === "Trading Goods";
  const activeTab = kindTabs.find((tab) => tab.value === kind) ?? kindTabs[0];

  return (
    <form
      action={createPurchaseInvoiceAction}
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-5"
    >
      <input type="hidden" name="kind" value={kind} />

      <div className="mb-5">
        <h2 className="text-lg font-black text-brand-green-ink">Purchase</h2>
        <div
          role="tablist"
          aria-label="Purchase kind"
          className="mt-3 inline-flex rounded-full border border-gray-200 bg-brand-mist p-1"
        >
          {kindTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={kind === tab.value}
              onClick={() => setKind(tab.value)}
              className={`h-9 rounded-full px-4 text-sm font-semibold transition ${
                kind === tab.value
                  ? "bg-brand-green text-white shadow-sm"
                  : "text-brand-muted hover:text-brand-green"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-500">{activeTab.detail}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <select name="supplierLedgerId" className={inputClass} defaultValue="" aria-label="Supplier ledger">
          <option value="">New supplier from name</option>
          {supplierLedgers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.supplierName}
            </option>
          ))}
        </select>
        <input name="supplierName" className={inputClass} placeholder="New supplier name" />
        <input name="phone" className={inputClass} placeholder="Supplier phone" />
      </div>

      {trading ? (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <select name="design" className={inputClass} required defaultValue="" aria-label="Product">
            <option value="">Select product</option>
            {productNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select name="channel" className={inputClass} defaultValue="Wholesale" aria-label="Channel">
            <option>Wholesale</option>
            <option>Retail</option>
            <option>Online</option>
          </select>
          <input name="sizeRun" className={inputClass} placeholder="Size run (e.g. 36-41)" defaultValue="Mixed" />
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          <select name="materialId" className={inputClass} required defaultValue="" aria-label="Raw material">
            <option value="">Select raw material</option>
            {rawMaterials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name} ({material.unit})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <input
          name="quantity"
          type="number"
          min="1"
          required
          className={inputClass}
          placeholder={trading ? "Pairs" : "Quantity"}
        />
        <input
          name="rate"
          type="number"
          min="1"
          required
          className={inputClass}
          placeholder={trading ? "Rate per pair" : "Rate"}
        />
        <select name="paymentMethod" className={inputClass} defaultValue="Cash" aria-label="Payment method">
          <option>Cash</option>
          <option>Cheque</option>
          <option>Bank</option>
          <option>Credit</option>
        </select>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <input name="discount" type="number" min="0" className={inputClass} placeholder="Discount" />
        <input name="tax" type="number" min="0" className={inputClass} placeholder="Tax / VAT" />
        <input name="paidAmount" type="number" min="0" className={inputClass} placeholder="Paid amount" />
        <input name="paymentReference" className={inputClass} placeholder="Cheque/bank/ref no." />
      </div>

      <textarea
        name="note"
        className={`${textareaClass} mt-3 w-full`}
        placeholder="Purchase note, vehicle, gate pass, invoice no."
      />

      <button
        type="submit"
        className="mt-4 h-11 w-full rounded-full bg-brand-green-ink px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink md:w-auto"
      >
        Save purchase
      </button>
    </form>
  );
}
