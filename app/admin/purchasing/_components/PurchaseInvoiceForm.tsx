"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseInvoiceAction } from "@/app/admin/purchasing/actions";
import type { ActionState } from "@/app/admin/actions";
import ActionMessage from "@/components/admin/ActionMessage";
import { billTotals, shareBillAcrossLines } from "@/lib/purchase-bill";
import { purchaseLineIssue } from "@/lib/purchase-line-check";
import type { PurchaseKind, SupplierLedger } from "@/lib/purchasing";
import type { RawMaterial } from "@/lib/operations";

const inputClass =
  "h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-green";
const textareaClass =
  "min-h-24 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green";

type PurchaseInvoiceFormProps = {
  supplierLedgers: SupplierLedger[];
  rawMaterials: RawMaterial[];
  // Catalog product names. A trading goods line writes the chosen name into
  // finished stock, which is what the storefront catalog sync matches against —
  // so this must be a picker, never free text.
  productNames: string[];
};

// One row as the form holds it. Everything is a string because that is what an
// input gives back; the numbers are parsed only to show the running total.
type ItemRow = {
  key: number;
  kind: PurchaseKind;
  materialId: string;
  design: string;
  channel: string;
  sizeRun: string;
  quantity: string;
  rate: string;
};

function emptyRow(key: number): ItemRow {
  return {
    key,
    kind: "Raw Material",
    materialId: "",
    design: "",
    channel: "Wholesale",
    sizeRun: "Mixed",
    quantity: "",
    rate: "",
  };
}

function rowIsTouched(row: ItemRow) {
  return Boolean(row.materialId || row.design || row.quantity || row.rate);
}

// The exact-field check lives in lib/purchase-line-check.ts so it can be tested
// and so the same rule cannot drift between here and there.
function rowIssue(row: ItemRow) {
  return purchaseLineIssue(row);
}

const money = (value: number) =>
  `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const inputBase = "h-10 rounded-md border px-3 text-sm outline-none focus:border-brand-green";

// The same box, red when the field is what is holding the bill back.
function fieldClass(hasError: boolean) {
  return `${inputBase} ${
    hasError ? "border-brand-clay bg-brand-clay-tint/40" : "border-gray-200 bg-white"
  }`;
}

export default function PurchaseInvoiceForm({
  supplierLedgers,
  rawMaterials,
  productNames,
}: PurchaseInvoiceFormProps) {
  // A one-line bill is as common as a twenty-five line one, so the form opens
  // as small as the smallest bill.
  const [rows, setRows] = useState<ItemRow[]>([emptyRow(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [state, setState] = useState<ActionState | null>(null);
  const [supplierError, setSupplierError] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const router = useRouter();

  // Submitted here rather than through the form's action so a failure comes back
  // as a message, not the admin error page. The form is never rebuilt from
  // scratch on failure, so every line the owner typed — twenty-five of them, if
  // it came to that — is still there to fix and resubmit.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // Catch the everyday gaps here — a supplier, a started line with no product —
    // and point at the exact field, before the bill ever leaves the browser.
    // The server still has the final say on the deeper rules.
    const supplierChosen = Boolean(
      String(formData.get("supplierLedgerId") ?? "").trim() ||
        String(formData.get("supplierName") ?? "").trim(),
    );
    const started = rows.filter(rowIsTouched);
    const firstBadIndex = started.findIndex((row) => rowIssue(row));

    if (!supplierChosen) {
      setSupplierError(true);
      setState({ ok: false, message: "Choose a supplier, or type a new supplier name." });
      return;
    }

    if (started.length === 0) {
      setState({ ok: false, message: "Add at least one item — a product or material, with quantity and rate." });
      return;
    }

    if (firstBadIndex !== -1) {
      const issue = rowIssue(started[firstBadIndex]);
      setState({ ok: false, message: `Item ${firstBadIndex + 1}: ${issue?.message ?? "please complete this line."}` });
      return;
    }

    startSaving(async () => {
      const result = await createPurchaseInvoiceAction(state, formData);
      setState(result);

      // A saved bill clears the form for the next one, and pulls the new
      // invoice into the lists on the page. Stay put so the confirmation is
      // read, not missed in a redirect.
      if (result.ok) {
        setRows([emptyRow(0)]);
        setNextKey(1);
        setDiscount("");
        setTax("");
        router.refresh();
      }
    });
  }

  function updateRow(key: number, patch: Partial<ItemRow>) {
    setRows((current) => {
      const next = current.map((row) => (row.key === key ? { ...row, ...patch } : row));

      // Typing in the last row grows the bill. Twenty-five items should not
      // mean twenty-five trips to an "Add item" button.
      if (next[next.length - 1].key === key && rowIsTouched(next[next.length - 1])) {
        next.push(emptyRow(nextKey));
        setNextKey((value) => value + 1);
      }

      return next;
    });
  }

  function removeRow(key: number) {
    setRows((current) => {
      const next = current.filter((row) => row.key !== key);
      return next.length > 0 ? next : [emptyRow(nextKey)];
    });
  }

  // What the supplier's bill should say. Shown while typing so a wrong rate is
  // caught against the paper bill, not a month later in the ledger.
  const totals = useMemo(() => {
    const lines = rows.filter(rowIsTouched).map((row) => ({
      quantity: Number(row.quantity) || 0,
      rate: Number(row.rate) || 0,
    }));

    return {
      lineCount: lines.length,
      ...billTotals(lines, { discount: Number(discount) || 0, tax: Number(tax) || 0 }),
      shares: shareBillAcrossLines(lines, {
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
      }),
    };
  }, [rows, discount, tax]);

  const touchedRows = rows.filter(rowIsTouched);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-5"
    >
      {/* The server reads item0..itemN-1, so it has to know how many rows were
          rendered rather than guessing a maximum. */}
      <input type="hidden" name="itemCount" value={rows.length} />

      <div className="mb-5">
        <h2 className="text-lg font-black text-brand-green-ink">Purchase</h2>
        <p className="mt-2 text-sm text-gray-500">
          One supplier bill, however many items it lists. Pick what each line is: raw material goes
          to the factory store, trading goods are ready-made pairs that go straight to finished
          stock for their channel and on to the shop. A bill can carry both.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <select
          name="supplierLedgerId"
          className={fieldClass(supplierError)}
          defaultValue=""
          aria-label="Supplier ledger"
          onChange={() => setSupplierError(false)}
        >
          <option value="">New supplier from name</option>
          {supplierLedgers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.supplierName}
            </option>
          ))}
        </select>
        <input
          name="supplierName"
          className={fieldClass(supplierError)}
          placeholder="New supplier name"
          onChange={() => setSupplierError(false)}
        />
        <input name="phone" className={inputClass} placeholder="Supplier phone" />
      </div>
      {supplierError ? (
        <p className="mt-1.5 text-xs font-semibold text-brand-clay">
          Pick a supplier above, or type a new supplier name.
        </p>
      ) : null}

      <div className="mt-5 space-y-3">
        {rows.map((row, index) => {
          const trading = row.kind === "Trading Goods";
          const issue = rowIssue(row);
          const share = rowIsTouched(row)
            ? totals.shares[touchedRows.findIndex((item) => item.key === row.key)]
            : undefined;

          return (
            <div
              key={row.key}
              className={`rounded-md border p-3 ${
                issue ? "border-brand-clay/50 bg-brand-clay-tint/20" : "border-gray-200 bg-brand-mist/40"
              }`}
            >
              <input type="hidden" name={`item${index}Kind`} value={row.kind} />

              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex rounded-full border border-gray-200 bg-white p-1">
                  {(["Raw Material", "Trading Goods"] as PurchaseKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={row.kind === kind}
                      onClick={() => updateRow(row.key, { kind })}
                      className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
                        row.kind === kind
                          ? "bg-brand-green text-white shadow-sm"
                          : "text-brand-muted hover:text-brand-green"
                      }`}
                    >
                      {kind === "Raw Material" ? "Raw material" : "Trading goods"}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-brand-muted">Item {index + 1}</span>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      aria-label={`Remove item ${index + 1}`}
                      className="h-8 rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-brand-clay transition hover:border-brand-clay"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {trading ? (
                  <>
                    <select
                      name={`item${index}Design`}
                      className={fieldClass(Boolean(issue?.design))}
                      value={row.design}
                      onChange={(event) => updateRow(row.key, { design: event.target.value })}
                      aria-label={`Item ${index + 1} product`}
                    >
                      <option value="">Select product</option>
                      {productNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <select
                      name={`item${index}Channel`}
                      className={inputClass}
                      value={row.channel}
                      onChange={(event) => updateRow(row.key, { channel: event.target.value })}
                      aria-label={`Item ${index + 1} channel`}
                    >
                      <option>Wholesale</option>
                      <option>Retail</option>
                      <option>Online</option>
                    </select>
                    <input
                      name={`item${index}SizeRun`}
                      className={inputClass}
                      placeholder="Size run (e.g. 36-41)"
                      value={row.sizeRun}
                      onChange={(event) => updateRow(row.key, { sizeRun: event.target.value })}
                      aria-label={`Item ${index + 1} size run`}
                    />
                  </>
                ) : (
                  <select
                    name={`item${index}MaterialId`}
                    className={`${fieldClass(Boolean(issue?.material))} md:col-span-3`}
                    value={row.materialId}
                    onChange={(event) => updateRow(row.key, { materialId: event.target.value })}
                    aria-label={`Item ${index + 1} raw material`}
                  >
                    <option value="">Select raw material</option>
                    {rawMaterials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.name} ({material.unit})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <input
                  name={`item${index}Quantity`}
                  type="number"
                  min="0"
                  step="any"
                  className={fieldClass(Boolean(issue?.quantity))}
                  placeholder={trading ? "Pairs" : "Quantity"}
                  value={row.quantity}
                  onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                  aria-label={`Item ${index + 1} quantity`}
                />
                <input
                  name={`item${index}Rate`}
                  type="number"
                  min="0"
                  step="any"
                  className={fieldClass(Boolean(issue?.rate))}
                  placeholder={trading ? "Rate per pair" : "Rate"}
                  value={row.rate}
                  onChange={(event) => updateRow(row.key, { rate: event.target.value })}
                  aria-label={`Item ${index + 1} rate`}
                />
                <input
                  name={`item${index}Note`}
                  className={inputClass}
                  placeholder="Line note (optional)"
                  aria-label={`Item ${index + 1} note`}
                />
              </div>

              {issue ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-clay">
                  <span aria-hidden="true">⚠</span>
                  {issue.message}
                </p>
              ) : share ? (
                <p className="mt-2 text-xs text-brand-muted">
                  Line {money(share.lineSubtotal)}
                  {share.lineSubtotal !== share.lineTotal
                    ? ` | after bill discount and tax ${money(share.lineTotal)}`
                    : ""}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-brand-muted">
        A new line appears as you fill the last one. Blank lines are ignored.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <input
          name="discount"
          type="number"
          min="0"
          step="any"
          className={inputClass}
          placeholder="Discount (whole bill)"
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
        />
        <input
          name="tax"
          type="number"
          min="0"
          step="any"
          className={inputClass}
          placeholder="Tax / VAT (whole bill)"
          value={tax}
          onChange={(event) => setTax(event.target.value)}
        />
        <input name="paidAmount" type="number" min="0" step="any" className={inputClass} placeholder="Paid amount" />
        <select name="paymentMethod" className={inputClass} defaultValue="Cash" aria-label="Payment method">
          <option>Cash</option>
          <option>Cheque</option>
          <option>Bank</option>
          <option>Credit</option>
        </select>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <input name="paymentReference" className={inputClass} placeholder="Cheque/bank/ref no." />
        <textarea
          name="note"
          className={textareaClass}
          placeholder="Purchase note, vehicle, gate pass, invoice no."
        />
      </div>

      {/* The number to check against the paper bill before saving. */}
      <div className="mt-4 rounded-md border border-brand-green/20 bg-brand-green/5 p-3">
        <dl className="grid gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-brand-muted">
              Subtotal ({totals.lineCount} item{totals.lineCount === 1 ? "" : "s"})
            </dt>
            <dd className="font-semibold text-brand-green-ink">{money(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 ? (
            <div className="flex justify-between">
              <dt className="text-brand-muted">Discount</dt>
              <dd className="font-semibold text-brand-clay">- {money(totals.discount)}</dd>
            </div>
          ) : null}
          {totals.tax > 0 ? (
            <div className="flex justify-between">
              <dt className="text-brand-muted">Tax / VAT</dt>
              <dd className="font-semibold text-brand-green-ink">+ {money(totals.tax)}</dd>
            </div>
          ) : null}
          <div className="mt-1 flex justify-between border-t border-brand-green/20 pt-2">
            <dt className="font-black text-brand-green-ink">Bill total</dt>
            <dd className="text-lg font-black text-brand-green-ink">{money(totals.total)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 space-y-3">
        <ActionMessage state={state} linkLabel="See purchases below" />
        <button
          type="submit"
          disabled={isSaving}
          className="h-11 w-full rounded-full bg-brand-green-ink px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
        >
          {isSaving ? "Saving..." : "Save purchase"}
        </button>
      </div>
    </form>
  );
}
