import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPosInvoiceAction, repairPosInvoicePostingAction } from "@/app/admin/pos/actions";
import ScannerPanel from "@/app/admin/pos/ScannerPanel";
import { getCostingSnapshot, type CostingPeriodRow, type DesignCostingRow } from "@/lib/costing";
import { getOperationsSnapshot } from "@/lib/operations";
import { getPosSnapshot, type PosInvoice } from "@/lib/pos";
import { getProducts } from "@/lib/product-store";

export const metadata: Metadata = {
  title: "POS Billing | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

const inputClass =
  "h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-green";
const textareaClass =
  "min-h-24 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(invoice: PosInvoice) {
  if (invoice.postingStatus === "Needs Review") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (invoice.kind === "Return") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  if (invoice.status === "Credit" || invoice.status === "Partial") {
    return "border-orange-200 bg-orange-50 text-orange-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function postingTone(signal: string) {
  return signal === "Posted"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-red-200 bg-red-50 text-red-800";
}

function profitTone(value: number) {
  if (value > 0) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (value < 0) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
        {detail}
      </p>
    </div>
  );
}

function ProfitPeriodCard({ row }: { row: CostingPeriodRow }) {
  return (
    <div className={`rounded-lg border p-5 shadow-sm ${profitTone(row.grossProfit)}`}>
      <p className="text-sm font-medium opacity-75">{row.label}</p>
      <p className="mt-2 text-2xl font-black">{money(row.grossProfit)}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
        Revenue {money(row.revenue)} | COGS {money(row.estimatedCogs)}
      </p>
      <p className="mt-2 text-xs font-semibold opacity-70">
        {row.netPairs} net pairs, {row.grossMarginRate}% margin
      </p>
    </div>
  );
}

function DesignProfitRow({ row }: { row: DesignCostingRow }) {
  return (
    <tr>
      <td className="py-2 pr-3">
        <p className="font-bold text-brand-green-ink">{row.design}</p>
        <p className="text-xs text-gray-500">{row.netPairs} net pairs</p>
      </td>
      <td className="py-2 pr-3">{money(row.netRevenue)}</td>
      <td className="py-2 pr-3">{money(row.estimatedCogs)}</td>
      <td className="py-2 pr-3 font-black text-brand-green-ink">{money(row.grossProfit)}</td>
      <td className="py-2 pr-3">
        <Badge className={row.missingCostData ? profitTone(0) : profitTone(row.grossProfit)}>
          {row.missingCostData ? "Needs cost" : `${row.grossMarginRate}%`}
        </Badge>
      </td>
    </tr>
  );
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${className}`}>
      {children}
    </span>
  );
}

function RepairPostingButton({ invoiceId }: { invoiceId: string }) {
  return (
    <form action={repairPosInvoicePostingAction}>
      <input type="hidden" name="id" value={invoiceId} />
      <input type="hidden" name="returnTo" value="/admin/pos" />
      <button
        type="submit"
        className="inline-flex h-8 items-center rounded-full border border-brand-clay px-3 text-xs font-black text-brand-clay transition hover:bg-brand-clay hover:text-white"
      >
        Repair
      </button>
    </form>
  );
}

export default async function AdminPosPage() {
  const [pos, operations, products, costing] = await Promise.all([
    getPosSnapshot(),
    getOperationsSnapshot(),
    getProducts({ includeDrafts: true }),
    getCostingSnapshot(),
  ]);
  const designOptions = [
    ...new Set([
      ...operations.finishedStock.map((stock) => stock.design),
      ...products.map((product) => product.name),
    ]),
  ].sort((a, b) => a.localeCompare(b));
  const topDesignProfit = costing.designCosting
    .filter((row) => row.soldPairs > 0 || row.returnedPairs > 0 || row.netRevenue !== 0)
    .slice(0, 6);

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">POS and e-billing control</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Retail, wholesale, and online billing with stock movement, credit ledger,
            printable barcode, QR code, and scanner-ready invoice lookup.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/api/admin/pos/export?type=invoices"
            className="rounded-full bg-brand-green px-4 py-2 text-sm font-bold text-white"
          >
            Export POS CSV
          </Link>
          <Link
            href="/api/admin/pos/export?type=posting-review"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Posting review
          </Link>
          <Link
            href="/api/admin/pos/export?type=day-close"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Day close
          </Link>
          <Link
            href="/api/admin/pos/export?type=day-close-detail"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Close detail
          </Link>
          <Link
            href="/api/admin/pos/export?type=profit-close"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Profit close
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Today net sales" value={money(pos.summary.todayNetSales)} detail={`${money(pos.summary.todayReturns)} returns`} />
        <StatCard label="Month net sales" value={money(pos.summary.monthNetSales)} detail={`${pos.summary.invoiceCount} total bills`} />
        <StatCard label="Credit from POS" value={money(pos.summary.totalCredit)} detail="linked to ledger when selected" />
        <StatCard label="Needs review" value={pos.summary.needsReview} detail={`${pos.summary.postedInvoiceCount} posted bills`} />
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Today day close</h2>
            <p className="mt-1 text-sm text-gray-500">
              Cash, cheque, QR, wallet, bank, credit, return, and posting review for today.
            </p>
          </div>
          <Badge className={pos.todayDayClose.postingNeedsReview > 0 ? postingTone("Needs Review") : postingTone("Posted")}>
            {pos.todayDayClose.postingNeedsReview > 0 ? `${pos.todayDayClose.postingNeedsReview} review` : "Ready"}
          </Badge>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          <StatCard label="Cash" value={money(pos.todayDayClose.cashAmount)} detail="counter cash" />
          <StatCard label="Cheque" value={money(pos.todayDayClose.chequeAmount)} detail="cheque closing" />
          <StatCard label="QR" value={money(pos.todayDayClose.qrAmount)} detail="QR scan" />
          <StatCard label="eSewa/Khalti" value={money(pos.todayDayClose.eSewaAmount + pos.todayDayClose.khaltiAmount)} detail="wallet total" />
          <StatCard label="Bank" value={money(pos.todayDayClose.bankAmount)} detail="bank transfer" />
          <StatCard label="Credit" value={money(pos.todayDayClose.creditAmount)} detail="ledger due" />
          <StatCard label="Net sales" value={money(pos.todayDayClose.netSales)} detail={`${money(pos.todayDayClose.returnsTotal)} return`} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="overflow-x-auto">
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-brand-green-ink">Payment close</h3>
            <table className="mt-3 min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3">Paid</th>
                  <th className="py-2 pr-3">Credit</th>
                  <th className="py-2 pr-3">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pos.todayDayClose.paymentRows.map((row) => (
                  <tr key={row.paymentMethod}>
                    <td className="py-2 pr-3 font-bold text-brand-green-ink">{row.paymentMethod}</td>
                    <td className="py-2 pr-3">{money(row.paidAmount)}</td>
                    <td className="py-2 pr-3">{money(row.creditAmount)}</td>
                    <td className="py-2 pr-3 font-semibold">{money(row.netTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-brand-green-ink">Channel close</h3>
            <table className="mt-3 min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Channel</th>
                  <th className="py-2 pr-3">Bills</th>
                  <th className="py-2 pr-3">Return</th>
                  <th className="py-2 pr-3">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pos.todayDayClose.channelRows.map((row) => (
                  <tr key={row.channel}>
                    <td className="py-2 pr-3 font-bold text-brand-green-ink">{row.channel}</td>
                    <td className="py-2 pr-3">{row.invoiceCount}</td>
                    <td className="py-2 pr-3">{money(row.returnTotal)}</td>
                    <td className="py-2 pr-3 font-semibold">{money(row.netTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-brand-green-ink">Cashier close</h3>
            {pos.todayDayClose.cashierRows.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No bills today.</p>
            ) : (
              <table className="mt-3 min-w-full text-sm">
                <thead className="border-b text-left text-gray-500">
                  <tr>
                    <th className="py-2 pr-3">Cashier</th>
                    <th className="py-2 pr-3">Bills</th>
                    <th className="py-2 pr-3">Paid</th>
                    <th className="py-2 pr-3">Credit</th>
                    <th className="py-2 pr-3">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pos.todayDayClose.cashierRows.map((row) => (
                    <tr key={row.cashier}>
                      <td className="py-2 pr-3 font-bold text-brand-green-ink">{row.cashier}</td>
                      <td className="py-2 pr-3">{row.invoiceCount}</td>
                      <td className="py-2 pr-3">{money(row.paidAmount)}</td>
                      <td className="py-2 pr-3">{money(row.creditAmount)}</td>
                      <td className="py-2 pr-3 font-semibold">{money(row.netTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Profit close</h2>
            <p className="mt-1 text-sm text-gray-500">
              Daily, monthly, and yearly POS revenue after estimated material, labor, and overhead COGS.
            </p>
          </div>
          <Link
            href="/admin/costing"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Cost model
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {costing.periodReports.map((row) => (
            <ProfitPeriodCard key={row.label} row={row} />
          ))}
        </div>

        {costing.summary.missingCostDesigns > 0 ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            {costing.summary.missingCostDesigns} design rows still need material, labor, or overhead rates before profit is fully accurate.
          </div>
        ) : null}

        <div className="mt-6 overflow-x-auto">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-brand-green-ink">
            Top design profit signal
          </h3>
          {topDesignProfit.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No POS design profit data yet.</p>
          ) : (
            <table className="mt-3 min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Design</th>
                  <th className="py-2 pr-3">Revenue</th>
                  <th className="py-2 pr-3">COGS</th>
                  <th className="py-2 pr-3">Profit</th>
                  <th className="py-2 pr-3">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topDesignProfit.map((row) => (
                  <DesignProfitRow key={row.design} row={row} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <form action={createPosInvoiceAction} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-black text-brand-green-ink">New bill</h2>
            <p className="mt-1 text-sm text-gray-500">
              Bill save posts stock automatically. Select a customer ledger for credit sales.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <select name="kind" className={inputClass} defaultValue="Sale" aria-label="Bill type">
              <option>Sale</option>
              <option>Return</option>
            </select>
            <select name="channel" className={inputClass} defaultValue="Retail" aria-label="Sales channel">
              <option>Retail</option>
              <option>Wholesale</option>
              <option>Online</option>
            </select>
            <select name="paymentMethod" className={inputClass} defaultValue="Cash" aria-label="Payment method">
              <option>Cash</option>
              <option>Cheque</option>
              <option>Credit</option>
              <option>QR</option>
              <option>eSewa</option>
              <option>Khalti</option>
              <option>Bank</option>
            </select>
            <input name="cashier" className={inputClass} placeholder="Cashier / counter" />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <input name="customerName" className={inputClass} placeholder="Customer name" />
            <input name="phone" className={inputClass} placeholder="Phone" />
            <select name="ledgerId" className={inputClass} defaultValue="" aria-label="Customer ledger">
              <option value="">No ledger / walk-in</option>
              {operations.customerLedgers.map((ledger) => (
                <option key={ledger.id} value={ledger.id}>
                  {ledger.customerName} ({ledger.channel})
                </option>
              ))}
            </select>
            <input name="paymentReference" className={inputClass} placeholder="Cheque/QR/ref no." />
          </div>

          <datalist id="pos-design-options">
            {designOptions.map((design) => (
              <option key={design} value={design} />
            ))}
          </datalist>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Design / item</th>
                  <th className="py-2 pr-3">Size</th>
                  <th className="py-2 pr-3">Pairs</th>
                  <th className="py-2 pr-3">Rate</th>
                  <th className="py-2 pr-3">Discount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Array.from({ length: 6 }, (_, index) => {
                  const row = index + 1;

                  return (
                    <tr key={row}>
                      <td className="py-2 pr-3">
                        <input name={`item${row}Sku`} className={`${inputClass} w-28`} placeholder="SKU" />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          name={`item${row}Design`}
                          className={`${inputClass} min-w-56`}
                          list="pos-design-options"
                          placeholder="Design name"
                          required={row === 1}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input name={`item${row}SizeRun`} className={`${inputClass} w-24`} placeholder="Mixed" />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          name={`item${row}Quantity`}
                          type="number"
                          min="0"
                          className={`${inputClass} w-24`}
                          placeholder="0"
                          required={row === 1}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          name={`item${row}Rate`}
                          type="number"
                          min="0"
                          className={`${inputClass} w-28`}
                          placeholder="0"
                          required={row === 1}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input name={`item${row}Discount`} type="number" min="0" className={`${inputClass} w-28`} placeholder="0" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <input name="invoiceDiscount" type="number" min="0" className={inputClass} placeholder="Bill discount" />
            <input name="tax" type="number" min="0" className={inputClass} placeholder="Tax / VAT" />
            <input name="paidAmount" type="number" min="0" className={inputClass} placeholder="Paid amount" />
            <textarea name="note" className={textareaClass} placeholder="Delivery, return, QR, or counter note" />
          </div>

          <button
            type="submit"
            className="mt-4 h-11 rounded-full bg-brand-green-ink px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
          >
            Save bill and open receipt
          </button>
        </form>

        <div className="grid gap-6">
          <ScannerPanel
            knownInvoices={pos.invoices.map((invoice) => ({
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              barcodeValue: invoice.barcodeValue,
              qrPayload: invoice.qrPayload,
            }))}
          />

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-brand-green-ink">Channel report</h2>
            <div className="mt-4 divide-y divide-gray-100">
              {pos.channelTotals.map((row) => (
                <div key={row.channel} className="grid grid-cols-3 gap-3 py-3 text-sm">
                  <p className="font-black text-brand-green-ink">{row.channel}</p>
                  <p className="text-gray-500">{row.invoiceCount} bills</p>
                  <p className="text-right font-bold text-brand-green">{money(row.netSales)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-brand-green-ink">Payment summary</h2>
            <div className="mt-4 grid gap-2">
              {pos.paymentTotals
                .filter((row) => row.invoiceCount > 0 || row.paid > 0)
                .map((row) => (
                  <div key={row.paymentMethod} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-sm">
                    <span className="font-bold text-brand-green-ink">{row.paymentMethod}</span>
                    <span className="text-gray-600">{money(row.paid)}</span>
                  </div>
                ))}
              {pos.paymentTotals.every((row) => row.invoiceCount === 0) ? (
                <p className="text-sm text-gray-500">No POS payment recorded yet.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-brand-green-ink">Posting health</h2>
            <p className="mt-1 text-sm text-gray-500">
              Stock movement, customer ledger, and payment reference check.
            </p>
            <div className="mt-4 divide-y divide-gray-100">
              {pos.postingReviewRows.slice(0, 5).map((row) => (
                <div key={row.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs font-bold text-brand-green-ink">{row.invoiceNumber}</p>
                    <div className="flex items-center gap-2">
                      <Badge className={postingTone(row.signal)}>{row.signal}</Badge>
                      {row.signal !== "Posted" ? <RepairPostingButton invoiceId={row.id} /> : null}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Stock {row.linkedStockMovementCount}/{row.expectedStockMovementCount}
                    {row.needsLedger ? ` | ledger ${row.ledgerLinked ? "linked" : "missing"}` : ""}
                  </p>
                  {row.issues ? <p className="mt-1 text-xs font-semibold text-brand-clay">{row.issues}</p> : null}
                </div>
              ))}
              {pos.postingReviewRows.length === 0 ? (
                <p className="py-3 text-sm text-gray-500">No POS posting to review yet.</p>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Recent bills</h2>
            <p className="mt-1 text-sm text-gray-500">
              Invoice, stock movement, payment, and ledger posting trail.
            </p>
          </div>
          <p className="text-sm font-bold text-brand-green">Year net sales {money(pos.summary.yearNetSales)}</p>
        </div>

        {pos.recentInvoices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
            POS bill history is empty. Create the first bill from the form above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Invoice</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Channel</th>
                  <th className="py-2 pr-3">Payment</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Posting</th>
                  <th className="py-2 pr-3">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pos.recentInvoices.map((invoice) => {
                  const posting = pos.postingReviewRows.find((row) => row.id === invoice.id);

                  return (
                    <tr key={invoice.id}>
                      <td className="py-3 pr-3">
                        <p className="font-mono text-xs font-bold text-brand-green-ink">{invoice.invoiceNumber}</p>
                        <p className="mt-1 text-xs text-gray-500">{formatDate(invoice.createdAt)}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-brand-green-ink">{invoice.customerName}</p>
                        <p className="text-xs text-gray-500">{invoice.phone || "-"}</p>
                      </td>
                      <td className="py-3 pr-3">{invoice.channel}</td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold">{invoice.paymentMethod}</p>
                        <p className="text-xs text-gray-500">Paid {money(invoice.paidAmount)}</p>
                      </td>
                      <td className="py-3 pr-3 font-bold">{money(invoice.total)}</td>
                      <td className="py-3 pr-3">
                        <Badge className={statusTone(invoice)}>{invoice.status}</Badge>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={postingTone(posting?.signal ?? "Needs Review")}>
                            {posting?.signal ?? "Needs Review"}
                          </Badge>
                          {posting?.signal === "Needs Review" ? (
                            <RepairPostingButton invoiceId={invoice.id} />
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {posting?.issues || `Stock ${posting?.linkedStockMovementCount ?? 0}/${posting?.expectedStockMovementCount ?? 0}`}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        <Link href={`/admin/pos/${invoice.id}`} className="font-bold text-brand-green underline underline-offset-4">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
