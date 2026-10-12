import EnterWalkForm from "@/components/admin/EnterWalkForm";
import type { Metadata } from "next";
import { money } from "@/lib/format-money";
import T from "@/components/T";
import { purchaseLinesOf } from "@/lib/purchase-kinds";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupplierTransactionAction } from "@/app/admin/purchasing/actions";
import PrintSupplierLedgerButton from "@/app/admin/purchasing/supplier/[id]/PrintSupplierLedgerButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import SupplierPaymentFields from "@/app/admin/purchasing/supplier/[id]/SupplierPaymentFields";
import { PageTabs, StatStrip } from "@/components/admin/PageKit";
import type { ReactNode } from "react";
import {
  getSupplierLedgerDetail,
  type PurchaseInvoice,
  type SupplierAgingRisk,
  type SupplierLedgerStatementRow,
  type SupplierTransactionType,
} from "@/lib/purchasing";

type SupplierLedgerPageProps = {
  params: Promise<{ id: string }>;
};



function transactionTone(type: SupplierTransactionType) {
  if (type === "Purchase Bill" || type === "Manual Adjustment") {
    return "border-orange-200 bg-orange-50 text-orange-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function invoiceTone(invoice: PurchaseInvoice) {
  if (invoice.status === "Credit") {
    return "border-orange-200 bg-orange-50 text-orange-800";
  }

  if (invoice.status === "Partial") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function agingTone(risk: SupplierAgingRisk) {
  if (risk === "Critical") return "border-red-200 bg-red-50 text-red-800";
  if (risk === "High") return "border-orange-200 bg-orange-50 text-orange-800";
  if (risk === "Watch") return "border-amber-200 bg-amber-50 text-amber-800";
  if (risk === "Current") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-brand-green-line bg-brand-paper-deep text-brand-muted";
}

function paymentPriorityTone(priority: string) {
  if (priority === "Immediate") return "border-red-200 bg-red-50 text-red-800";
  if (priority === "High") return "border-orange-200 bg-orange-50 text-orange-800";
  if (priority === "Scheduled") return "border-amber-200 bg-amber-50 text-amber-800";
  if (priority === "Normal") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-brand-green-line bg-brand-paper-deep text-brand-muted";
}

// The book's own words, said in both languages (owner's sample, 2026-10-12):
// this page was English but for its month card.
const TYPE_WORDS: Record<SupplierTransactionType, { en: string; ne: string }> = {
  "Purchase Bill": { en: "Purchase bill", ne: "खरिद बिल" },
  "Cash Payment": { en: "Cash payment", ne: "नगद तिरेको" },
  "Cheque Payment": { en: "Cheque payment", ne: "चेकबाट तिरेको" },
  "Bank Payment": { en: "Bank payment", ne: "बैंकबाट तिरेको" },
  "QR Payment": { en: "QR payment", ne: "QR बाट तिरेको" },
  "Return Adjustment": { en: "Goods returned", ne: "सामान फिर्ता" },
  "Manual Adjustment": { en: "Manual adjustment", ne: "हातैले मिलाएको" },
};
const EFFECT_WORDS: Record<SupplierLedgerStatementRow["effect"], { en: string; ne: string }> = {
  "Due added": { en: "Due added", ne: "बाँकी बढ्यो" },
  "Due reduced": { en: "Due reduced", ne: "बाँकी घट्यो" },
};
const STATUS_WORDS: Record<PurchaseInvoice["status"], { en: string; ne: string }> = {
  Paid: { en: "Paid", ne: "तिरिसकेको" },
  Partial: { en: "Part paid", ne: "केही तिरेको" },
  Credit: { en: "On credit", ne: "उधारो" },
};
const AGING_WORDS: Record<SupplierAgingRisk, { en: string; ne: string }> = {
  Clear: { en: "Nothing due", ne: "बाँकी छैन" },
  Current: { en: "Recent", ne: "भर्खरको" },
  Watch: { en: "Watch", ne: "ध्यान दिनुपर्ने" },
  High: { en: "Old", ne: "पुरानो" },
  Critical: { en: "Very old", ne: "धेरै पुरानो" },
};
const PRIORITY_WORDS: Record<string, { en: string; ne: string }> = {
  Immediate: { en: "Pay now", ne: "अहिल्यै तिर्ने" },
  High: { en: "Pay soon", ne: "छिट्टै तिर्ने" },
  Scheduled: { en: "Within a week", ne: "एक हप्ताभित्र" },
  Normal: { en: "Within two weeks", ne: "दुई हप्ताभित्र" },
  Clear: { en: "Nothing to pay", ne: "तिर्न बाँकी छैन" },
};
const said = (words: { en: string; ne: string } | undefined, fallback: string) =>
  words ? <T en={words.en} ne={words.ne} /> : fallback;

function StatCard({ label, value, detail }: { label: ReactNode; value: ReactNode; detail: ReactNode }) {
  return (
    <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4 shadow-sm">
      <p className="text-sm font-medium text-brand-muted">{label}</p>
      <p className="mt-2 text-xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-2 text-xs font-semibold text-brand-muted-soft">
        {detail}
      </p>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${className}`}>
      {children}
    </span>
  );
}

function StatementRow({ row }: { row: SupplierLedgerStatementRow }) {
  return (
    <tr>
      <td className="reflow-primary py-3 pr-3 text-xs text-brand-muted"><DateDisplayAdmin date={row.createdAt} time={true} /></td>
      <td data-label="Type" data-label-ne="किसिम" className="py-3 pr-3">
        <Badge className={transactionTone(row.type)}>{said(TYPE_WORDS[row.type], row.type)}</Badge>
      </td>
      <td data-label="Effect" data-label-ne="असर" className="py-3 pr-3">{said(EFFECT_WORDS[row.effect], row.effect)}</td>
      <td data-label="Amount" data-label-ne="रकम" className="py-3 pr-3 font-bold">{money(row.amount)}</td>
      <td data-label="Balance after" data-label-ne="पछिको बाँकी" className="py-3 pr-3 font-black text-brand-green-ink">{money(row.balanceAfter)}</td>
      <td data-label="Note" data-label-ne="टिपोट" className="max-w-96 py-3 pr-3 text-brand-muted">{row.note || "-"}</td>
    </tr>
  );
}

export async function generateMetadata({ params }: SupplierLedgerPageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getSupplierLedgerDetail(id);

  return {
    title: detail ? `${detail.ledger.supplierName} Supplier Ledger | KRISHOE Admin` : "Supplier Ledger Not Found",
  };
}

export const dynamic = "force-dynamic";

export default async function SupplierLedgerDetailPage({ params }: SupplierLedgerPageProps) {
  const { id } = await params;
  const detail = await getSupplierLedgerDetail(id);

  if (!detail) {
    notFound();
  }

  const { ledger, invoices, statementRows, summary, aging } = detail;
  const returnTo = `/admin/purchasing/supplier/${ledger.id}`;

  // This month with this supplier, on one card that prints: what was bought,
  // item by item, what it came to and what was paid. The owner asked for a
  // supplier's month in one place.
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthInvoices = invoices.filter((invoice) => invoice.createdAt.slice(0, 7) === monthKey);
  const monthBought = monthInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const monthPaid = monthInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
  const monthItems = new Map<string, { name: string; unit: string; quantity: number; total: number }>();
  for (const invoice of monthInvoices) {
    for (const line of purchaseLinesOf(invoice)) {
      const key = `${line.name.trim().toLowerCase()}|${line.unit}`;
      const row = monthItems.get(key) ?? { name: line.name, unit: line.unit, quantity: 0, total: 0 };
      row.quantity += line.quantity;
      row.total += line.total;
      monthItems.set(key, row);
    }
  }
  const monthRows = [...monthItems.values()].sort((a, b) => b.total - a.total);

  // Every bill on the books, not this month's: how long the oldest due has
  // waited is what says whether to pay now.
  const oldestDays = aging ? aging.oldestOpenDays : 0;
  const statementTable =
    statementRows.length === 0 ? (
      <div className="rounded-lg border border-dashed border-brand-green-line p-6 text-sm text-brand-muted">
        <T en="No supplier transaction has been recorded yet." ne="यो साहुसँग अझै कुनै हिसाब टिपिएको छैन।" />
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="reflow-table min-w-full text-sm">
          <thead className="border-b text-left text-brand-muted">
            <tr>
              <th className="py-2 pr-3"><T en="Date" ne="मिति" /></th>
              <th className="py-2 pr-3"><T en="Type" ne="किसिम" /></th>
              <th className="py-2 pr-3"><T en="Effect" ne="असर" /></th>
              <th className="py-2 pr-3"><T en="Amount" ne="रकम" /></th>
              <th className="py-2 pr-3"><T en="Balance after" ne="पछिको बाँकी" /></th>
              <th className="py-2 pr-3"><T en="Note" ne="टिपोट" /></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {statementRows.map((row) => (
              <StatementRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <section className="p-4 sm:p-6 print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/purchasing"
          className="inline-flex h-10 items-center rounded-full border border-brand-green-line bg-brand-paper px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
        >
          ← <T en="Purchasing" ne="किनमेल" />
        </Link>
        <div className="flex flex-wrap gap-2">
          {ledger.phone ? (
            <a
              href={`tel:${ledger.phone}`}
              className="inline-flex h-10 items-center rounded-full border border-brand-green-line bg-brand-paper px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
            >
              📞 <T en="Call" ne="फोन गर्ने" />
            </a>
          ) : null}
          <PrintSupplierLedgerButton />
        </div>
      </div>

      <div className="receipt-print rounded-lg border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-6 print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-brand-green-line pb-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
              <T en="Supplier ledger statement" ne="साहुको खाता" />
            </p>
            <h1 className="mt-2 break-words font-display text-3xl font-black text-brand-green-ink">{ledger.supplierName}</h1>
            <p className="mt-2 text-sm text-brand-muted">
              {ledger.phone || <T en="No phone" ne="फोन छैन" />} · {ledger.materialFocus || <T en="General supply" ne="सबै किसिमको सामान" />} ·{" "}
              <T en="Last transaction" ne="पछिल्लो हिसाब" /> {ledger.lastTransaction}
            </p>
          </div>
          {/* On paper the due heads the statement; on screen it leads the
              figures below, behind the eye. */}
          <div className="hidden rounded-lg bg-brand-mist px-5 py-4 text-right print:block">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">Supplier due</p>
            <p className="mt-2 text-3xl font-black text-brand-green-ink">{money(summary.balanceDue)}</p>
          </div>
        </div>

        {/* Three figures first (owner's sample, 2026-10-12); the seven that
            stood here and the priority line fold under ⓘ. On paper the
            header due and the running balance say it, so none of it prints. */}
        <div className="mt-5 grid gap-3 print:hidden">
          <StatStrip
            items={[
              { en: "to pay", ne: "तिर्न बाँकी", value: summary.balanceDue, money: true, tone: summary.balanceDue > 0 ? "warn" : "good" },
              { en: "bought this month", ne: "यो महिना किनेको", value: monthBought, money: true },
              {
                en: aging ? "days, oldest due" : "nothing due",
                ne: aging ? "दिन, सबैभन्दा पुरानो" : "बाँकी छैन",
                value: aging ? oldestDays : "—",
                tone: aging && (aging.risk === "High" || aging.risk === "Critical") ? "warn" : undefined,
              },
            ]}
          />
          <details className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-3">
            <summary className="cursor-pointer text-sm font-black text-brand-green-ink">
              ⓘ <T en="More figures" ne="थप अंक" /> · {said(PRIORITY_WORDS[summary.paymentPriority], summary.paymentPriority)}
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              <StatCard label={<T en="Total purchase" ne="जम्मा किनेको" />} value={money(summary.purchaseTotal)} detail={<T en={`${summary.purchaseCount} bills`} ne={`${summary.purchaseCount} बिल`} />} />
              <StatCard label={<T en="Paid on bills" ne="बिलमै तिरेको" />} value={money(summary.paidFromInvoices)} detail={<T en="paid when bought" ne="किन्दा तिरेको" />} />
              <StatCard label={<T en="Paid later" ne="पछि तिरेको" />} value={money(summary.paymentTotal)} detail={<T en="cash / cheque / bank" ne="नगद / चेक / बैंक" />} />
              <StatCard label={<T en="Goods returned" ne="सामान फिर्ता" />} value={money(summary.returnAdjustmentTotal)} detail={<T en="due reduced" ne="बाँकी घटेको" />} />
              <StatCard label={<T en="Average bill" ne="औसत बिल" />} value={money(summary.averagePurchaseValue)} detail={<T en={`${summary.transactionCount} transactions`} ne={`${summary.transactionCount} हिसाब`} />} />
              <StatCard label={<T en="Pay by" ne="कहिलेसम्म तिर्ने" />} value={summary.paymentDueDate || "-"} detail={said(PRIORITY_WORDS[summary.paymentPriority], summary.paymentPriority)} />
              <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4 shadow-sm">
                <p className="text-sm font-medium text-brand-muted"><T en="How old the due is" ne="बाँकी कति पुरानो" /></p>
                <div className="mt-3">
                  <Badge className={agingTone(aging?.risk ?? "Clear")}>{said(AGING_WORDS[aging?.risk ?? "Clear"], aging?.risk ?? "Clear")}</Badge>
                </div>
                <p className="mt-3 text-xs font-semibold text-brand-muted-soft">
                  {aging ? <T en={`${aging.oldestOpenDays} days oldest`} ne={`सबैभन्दा पुरानो ${aging.oldestOpenDays} दिन`} /> : <T en="no due" ne="बाँकी छैन" />}
                </p>
              </div>
            </div>
            <div className={`mt-3 rounded-lg border p-3 ${paymentPriorityTone(summary.paymentPriority)}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-black">
                  <T en="When to pay:" ne="कहिले तिर्ने:" /> {said(PRIORITY_WORDS[summary.paymentPriority], summary.paymentPriority)}
                </p>
                <p className="text-sm font-bold">
                  {summary.paymentDueDate ? <><T en="By" ne="म्याद" /> {summary.paymentDueDate}</> : <T en="Cleared" ne="चुक्ता" />}
                </p>
              </div>
              <p className="mt-2 text-sm font-semibold">{summary.nextPaymentAction}</p>
            </div>
          </details>
        </div>

        <div className="mt-5">
          <PageTabs
            id="supplier-ledger"
            openOnWide
            wideGridClassName="grid gap-6"
            tabs={[
              {
                key: "pay",
                en: "💵 Pay",
                ne: "💵 तिर्ने",
                wideClassName: "lg:order-2",
                content: (
                  <EnterWalkForm action={createSupplierTransactionAction} className="grid gap-3 rounded-lg border border-brand-green-line bg-brand-paper-deep p-4 print:hidden">
                    <div>
                      <h2 className="font-black text-brand-green-ink">
                        <T en="Record supplier payment / adjustment" ne="साहुलाई तिरेको वा मिलाएको टिप्ने" />
                      </h2>
                      <p className="mt-1 text-sm text-brand-muted">
                        <T
                          en="Payment decreases supplier due. Manual adjustment increases due."
                          ne="तिरेपछि बाँकी घट्छ। हातैले मिलाउँदा बाँकी बढ्छ।"
                        />
                      </p>
                    </div>
                    <input type="hidden" name="supplierLedgerId" value={ledger.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <SupplierPaymentFields />
                    <FormSubmitButton className="h-10 w-fit rounded-full bg-brand-green-ink px-5 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink">
                      <T en="Record transaction" ne="तिरेको टिप्ने" />
                    </FormSubmitButton>
                  </EnterWalkForm>
                ),
              },
              {
                key: "statement",
                en: "📜 Statement",
                ne: "📜 हिसाब",
                wideClassName: "lg:order-3",
                content: (
                  <div>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-black text-brand-green-ink"><T en="Statement trail" ne="हिसाबको क्रम" /></h2>
                        <p className="mt-1 text-sm text-brand-muted">
                          <T
                            en="Purchase bill, supplier payment, return adjustment, and running due balance."
                            ne="खरिद बिल, तिरेको, फिर्ता र हरेकपछिको बाँकी।"
                          />
                        </p>
                      </div>
                      <p className="text-sm font-bold text-brand-clay">
                        <T en="Current due:" ne="अहिलेको बाँकी:" /> {money(summary.balanceDue)}
                      </p>
                    </div>
                    {statementTable}
                  </div>
                ),
              },
              {
                key: "bills",
                en: "🧾 Bills",
                ne: "🧾 बिल",
                wideClassName: "lg:order-4",
                content: (
                  <div>
                    <div className="mb-4">
                      <h2 className="text-lg font-black text-brand-green-ink"><T en="Purchase invoices" ne="खरिद बिलहरू" /></h2>
                      <p className="mt-1 text-sm text-brand-muted">
                        <T en="Raw material purchase bills linked to this supplier." ne="यो साहुबाट किनेको कच्चा पदार्थका बिल।" />
                      </p>
                    </div>

                    {invoices.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-brand-green-line p-6 text-sm text-brand-muted">
                        <T en="No purchase invoice has been linked to this supplier yet." ne="यो साहुको कुनै खरिद बिल अझै छैन।" />
                      </div>
                    ) : (
                      <>
                        {/* Two lines a bill on a phone; the eight columns for a
                            computer and for paper. */}
                        <ul className="grid list-none gap-2 pl-0 md:hidden print:hidden">
                          {invoices.map((invoice) => (
                            <li key={`card-${invoice.id}`} className="grid gap-1 rounded-xl border border-brand-green-line bg-brand-paper p-3">
                              <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0 break-words text-sm font-bold text-brand-green-ink">
                                  <Link href={`/admin/purchasing/${invoice.id}`} className="font-mono text-xs text-brand-green underline underline-offset-4">
                                    {invoice.purchaseNumber}
                                  </Link>{" "}
                                  · {purchaseLinesOf(invoice).map((line) => line.name).join(", ")}
                                </span>
                                <span className="shrink-0 font-black tabular-nums">{money(invoice.total)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-xs text-brand-muted">
                                <span className="min-w-0">
                                  <DateDisplayAdmin date={invoice.createdAt} /> · <T en="Due" ne="बाँकी" /> {money(invoice.creditAmount)}
                                </span>
                                <Badge className={invoiceTone(invoice)}>{said(STATUS_WORDS[invoice.status], invoice.status)}</Badge>
                              </div>
                            </li>
                          ))}
                        </ul>
                        <div className="hidden overflow-x-auto md:block print:block">
                          <table className="reflow-table min-w-full text-sm">
                            <thead className="border-b text-left text-brand-muted">
                              <tr>
                                <th className="py-2 pr-3"><T en="Purchase" ne="बिल" /></th>
                                <th className="py-2 pr-3"><T en="Material" ne="सामान" /></th>
                                <th className="py-2 pr-3"><T en="Qty" ne="परिमाण" /></th>
                                <th className="py-2 pr-3"><T en="Rate" ne="दर" /></th>
                                <th className="py-2 pr-3"><T en="Total" ne="जम्मा" /></th>
                                <th className="py-2 pr-3"><T en="Paid / Due" ne="तिरेको / बाँकी" /></th>
                                <th className="py-2 pr-3"><T en="Status" ne="अवस्था" /></th>
                                <th className="py-2 pr-3"><T en="Reference" ne="टिपोट" /></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {invoices.map((invoice) => (
                                <tr key={invoice.id}>
                                  <td className="reflow-primary py-3 pr-3">
                                    <Link href={`/admin/purchasing/${invoice.id}`} className="font-mono text-xs font-bold text-brand-green underline underline-offset-4">
                                      {invoice.purchaseNumber}
                                    </Link>
                                    <p className="mt-1 text-xs text-brand-muted"><DateDisplayAdmin date={invoice.createdAt} time={true} /></p>
                                  </td>
                                  <td data-label="Material" data-label-ne="सामान" className="py-3 pr-3">
                                    {/* Every line of the bill — it showed only the first. */}
                                    {purchaseLinesOf(invoice).map((line, index) => (
                                      <p key={`${invoice.id}-${index}`} className="font-semibold text-brand-green-ink">
                                        {line.name} <span className="text-xs font-normal text-brand-muted">· {line.quantity} {line.unit}</span>
                                      </p>
                                    ))}
                                  </td>
                                  <td data-label="Qty" data-label-ne="परिमाण" className="py-3 pr-3">{invoice.quantity}</td>
                                  <td data-label="Rate" data-label-ne="दर" className="py-3 pr-3">{money(invoice.rate)}</td>
                                  <td data-label="Total" data-label-ne="जम्मा" className="py-3 pr-3 font-bold">{money(invoice.total)}</td>
                                  <td data-label="Paid / Due" data-label-ne="तिरेको / बाँकी" className="py-3 pr-3">
                                    <p><T en="Paid" ne="तिरेको" /> {money(invoice.paidAmount)}</p>
                                    <p className="text-xs text-brand-muted"><T en="Due" ne="बाँकी" /> {money(invoice.creditAmount)}</p>
                                  </td>
                                  <td data-label="Status" data-label-ne="अवस्था" className="py-3 pr-3">
                                    <Badge className={invoiceTone(invoice)}>{said(STATUS_WORDS[invoice.status], invoice.status)}</Badge>
                                  </td>
                                  <td data-label="Reference" data-label-ne="टिपोट" className="max-w-64 py-3 pr-3 text-brand-muted">
                                    {invoice.paymentReference || invoice.note || "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                ),
              },
              {
                key: "month",
                en: "📊 This month",
                ne: "📊 यो महिना",
                wideClassName: "lg:order-1",
                content: (
                  <div className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-lg font-black text-brand-green-ink">
                        <T en="This month" ne="यो महिना" />
                      </h2>
                      <p className="text-sm font-bold text-brand-muted">
                        <T
                          en={`${monthInvoices.length} ${monthInvoices.length === 1 ? "bill" : "bills"} · bought ${money(monthBought)} · paid ${money(monthPaid)}`}
                          ne={`${monthInvoices.length} बिल · किनेको ${money(monthBought)} · तिरेको ${money(monthPaid)}`}
                        />
                      </p>
                    </div>
                    {monthRows.length === 0 ? (
                      <p className="mt-2 text-sm text-brand-muted">
                        <T en="Nothing bought from this supplier this month." ne="यो महिना यो साहुबाट केही किनिएको छैन।" />
                      </p>
                    ) : (
                      <ul className="mt-2 divide-y divide-brand-green-line text-sm">
                        {monthRows.map((row) => (
                          <li key={`${row.name}|${row.unit}`} className="flex justify-between gap-3 py-1.5">
                            <span className="font-semibold text-brand-green-ink">{row.name}</span>
                            <span className="tabular-nums text-brand-muted">
                              {row.quantity} {row.unit} · {money(row.total)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
