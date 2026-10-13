import Link from "next/link";
import PrintButton from "@/components/admin/PrintButton";
import PrintedOn from "@/components/admin/PrintedOn";
import { businessContact } from "@/lib/seo";
import T from "@/components/T";
import type { Metadata } from "next";
import LoadFailure from "@/components/admin/LoadFailure";
import { PageHead, PageTabs, StatStrip } from "@/components/admin/PageKit";
import { money } from "@/lib/format-money";
import { getOperationsSnapshot } from "@/lib/operations";
import { getPurchasingSnapshot, type SupplierAgingRisk } from "@/lib/purchasing";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { whatsappNumber } from "@/lib/phone-intl";
import { reportError } from "@/lib/report-error";

export const metadata: Metadata = {
  title: "Dues | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

// Customer aging buckets come straight from the ledger report as text; colour
// them so an overdue account catches the eye without reading the number.
function customerAgingTone(bucket: string) {
  if (bucket === "60+ days") return "border-red-200 bg-red-50 text-red-800";
  if (bucket === "31-60 days") return "border-amber-200 bg-amber-50 text-amber-800";
  if (bucket === "0-30 days") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-brand-green-line bg-brand-paper-deep text-brand-muted";
}

function supplierAgingTone(risk: SupplierAgingRisk) {
  if (risk === "Critical") return "border-red-200 bg-red-50 text-red-800";
  if (risk === "High") return "border-orange-200 bg-orange-50 text-orange-800";
  if (risk === "Watch") return "border-amber-200 bg-amber-50 text-amber-800";
  if (risk === "Current") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-brand-green-line bg-brand-paper-deep text-brand-muted";
}

const RISK: Record<string, { ne: string }> = {
  Critical: { ne: "धेरै पुरानो" },
  High: { ne: "पुरानो" },
  Watch: { ne: "हेर्नुपर्ने" },
  Current: { ne: "भर्खरको" },
};

/** How old a due is, in days — "Aging" was a word the owner did not use. */
function Days({ days }: { days: number }) {
  if (days <= 0) return <T en="today" ne="आज" />;
  return <T en={`${days} days`} ne={`${days} दिन भयो`} />;
}

/** One tap to call, one to WhatsApp, where there is a number (owner, 2026-10-12). */
function Reach({ phone }: { phone: string }) {
  if (!phone) return <>-</>;
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5 md:justify-start">
      <span className="text-brand-muted">{phone}</span>
      <a
        href={`tel:${phone.replace(/[^\d+]/g, "")}`}
        className="inline-flex min-h-8 items-center rounded-full bg-brand-green px-2.5 text-xs font-black text-white print:hidden"
      >
        📞 <T en="Call" ne="फोन" />
      </a>
      <a
        href={`https://wa.me/${whatsappNumber(phone) || phone.replace(/[^\d]/g, "")}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-8 items-center rounded-full bg-[#25D366] px-2.5 text-xs font-black text-white print:hidden"
      >
        💬
      </a>
    </span>
  );
}

// Two independent snapshots. If either backend hiccups, the whole page should
// show the shop's retry screen rather than a half-empty dues list.
async function loadDues() {
  try {
    return {
      data: await Promise.all([getOperationsSnapshot(), getPurchasingSnapshot()]),
      error: "",
    };
  } catch (error) {
    reportError("load the dues page", error);
    return { data: null, error: saveFailureMessage(error, "Could not load dues.") };
  }
}

/**
 * Who owes the shop and whom the shop owes (owner, 2026-10-12: no way to call
 * from the list, "Aging" for how old a due is, the columns in English, and the
 * rupees open). Now: the two totals behind the eye, To collect · To pay tabs,
 * "45 days" on each line, and Call / WhatsApp beside the number. Printing
 * still gives both lists on paper — the sheet carried out to collect.
 */
export default async function AdminDuesPage() {
  const loaded = await loadDues();

  if (!loaded.data) {
    return <LoadFailure what="the dues list" message={loaded.error} retryHref="/admin/dues" />;
  }

  const [operations, purchasing] = loaded.data;

  // Only accounts that actually owe money — a zero balance is not a due.
  const customerRows = operations.reports.ledgerAgingRows.filter((row) => row.balanceDue > 0);
  const supplierRows = purchasing.reports.supplierAgingRows.filter((row) => row.balanceDue > 0);

  const receivable = operations.summary.receivable;
  const payable = purchasing.summary.supplierDue;
  const overThirty =
    customerRows.filter((row) => row.daysOutstanding > 30).length + supplierRows.filter((row) => row.oldestOpenDays > 30).length;

  const collect = (
    <section id="customer-receivables" className="scroll-mt-24 rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-black text-brand-green-ink">
          <T en="To collect from customers" ne="ग्राहकबाट उठाउन बाँकी" />
        </h2>
        <p className="mt-1 text-sm text-brand-muted print:hidden">
          <T
            en="Press a name to take a cash or cheque payment and see the whole statement."
            ne="नगद वा चेक लिन र पूरा खाता हेर्न नाम थिच्नुहोस्।"
          />
        </p>
      </div>

      {customerRows.length === 0 ? (
        <p className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-4 text-sm font-semibold text-brand-muted">
          <T en="No customer dues right now." ne="कसैबाट पैसा उठाउन बाँकी छैन।" />
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="reflow-table min-w-full text-sm">
            <thead className="border-b text-left text-brand-muted">
              <tr>
                <th className="py-2 pr-3"><T en="Customer" ne="ग्राहक" /></th>
                <th className="py-2 pr-3"><T en="Phone" ne="फोन" /></th>
                <th className="py-2 pr-3"><T en="How long" ne="कति दिन" /></th>
                <th className="py-2 pr-3 text-right"><T en="Due" ne="बाँकी" /></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customerRows.map((row) => (
                <tr key={row.id}>
                  <td className="reflow-primary min-w-44 py-3 pr-3">
                    <Link
                      href={`/admin/operations/ledger/${row.id}`}
                      className="font-bold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green"
                    >
                      {row.customerName}
                    </Link>
                    <p className="mt-1 text-xs text-brand-muted-soft">{row.channel}</p>
                  </td>
                  <td data-label="Phone" data-label-ne="फोन" className="py-3 pr-3">
                    <Reach phone={row.phone} />
                  </td>
                  <td data-label="How long" data-label-ne="कति दिन" className="py-3 pr-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${customerAgingTone(row.agingBucket)}`}>
                      <Days days={row.daysOutstanding} />
                    </span>
                  </td>
                  <td data-label="Due" data-label-ne="बाँकी" className="py-3 pr-3 text-right text-base font-black text-brand-clay">
                    {money(row.balanceDue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const pay = (
    <section id="supplier-payables" className="scroll-mt-24 rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-black text-brand-green-ink">
          <T en="To pay suppliers" ne="साहुलाई तिर्न बाँकी" />
        </h2>
        <p className="mt-1 text-sm text-brand-muted print:hidden">
          <T
            en="Press a name to record a payment and see the purchase bills with what is still owed."
            ne="भुक्तानी लेख्न र बाँकी सहित खरिद बिल हेर्न नाम थिच्नुहोस्।"
          />
        </p>
      </div>

      {supplierRows.length === 0 ? (
        <p className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-4 text-sm font-semibold text-brand-muted">
          <T en="No supplier dues right now." ne="कसैलाई पैसा तिर्न बाँकी छैन।" />
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="reflow-table min-w-full text-sm">
            <thead className="border-b text-left text-brand-muted">
              <tr>
                <th className="py-2 pr-3"><T en="Supplier" ne="साहु" /></th>
                <th className="py-2 pr-3"><T en="Phone" ne="फोन" /></th>
                <th className="py-2 pr-3"><T en="How long" ne="कति दिन" /></th>
                <th className="py-2 pr-3 text-right"><T en="Due" ne="बाँकी" /></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {supplierRows.map((row) => (
                <tr key={row.supplierLedgerId}>
                  <td className="reflow-primary min-w-44 py-3 pr-3">
                    <Link
                      href={`/admin/purchasing/supplier/${row.supplierLedgerId}`}
                      className="font-bold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green"
                    >
                      {row.supplierName}
                    </Link>
                    <p className="mt-1 text-xs text-brand-muted-soft">{row.materialFocus || "-"}</p>
                  </td>
                  <td data-label="Phone" data-label-ne="फोन" className="py-3 pr-3">
                    <Reach phone={row.phone} />
                  </td>
                  <td data-label="How long" data-label-ne="कति दिन" className="py-3 pr-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${supplierAgingTone(row.risk)}`}>
                      <T en={row.risk} ne={RISK[row.risk]?.ne ?? row.risk} />
                      {row.oldestOpenDays > 0 ? (
                        <>
                          {" · "}
                          <Days days={row.oldestOpenDays} />
                        </>
                      ) : null}
                    </span>
                  </td>
                  <td data-label="Due" data-label-ne="बाँकी" className="py-3 pr-3 text-right text-base font-black text-brand-clay">
                    {money(row.balanceDue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    // `report-print` is what makes this list work on paper: the header row
    // repeats on every sheet, so page two is not a column of unlabelled
    // figures, and no row splits across the fold. This is the sheet the owner
    // carries when going to collect what is owed.
    <section className="report-print p-4 sm:p-6">
      <div className="report-head flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {/* Paper only — on screen the shop's name is already in the nav. */}
          <div className="mb-2 hidden border-b border-brand-green-line pb-2 print:block">
            <p className="text-base font-black uppercase tracking-[0.16em] text-brand-green-ink">KRISHOE</p>
            <p className="text-xs text-brand-muted">
              {businessContact.streetAddress}, {businessContact.addressLocality} · {businessContact.phoneDisplay}
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              <T en="Printed" ne="छापिएको" />: <PrintedOn />
            </p>
          </div>
          <PageHead eyebrow={<T en="Money" ne="पैसा" />} title={<T en="Credit / Dues" ne="उधारो" />} />
          <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted print:hidden">
            <T
              en="To collect: what customers owe the shop. To pay: what the shop owes suppliers."
              ne="उठाउन: ग्राहकले पसललाई तिर्नुपर्ने। तिर्न: पसलले साहुलाई तिर्नुपर्ने।"
            />
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <PrintButton className="inline-flex min-h-11 items-center rounded-full bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink">
            🖨️ <T en="Print" ne="छाप्ने" />
          </PrintButton>
          <Link href="/admin/operations#customer-ledgers" className="rounded-full border border-brand-green bg-brand-paper px-4 py-2 text-sm font-black text-brand-green">
            <T en="All customer ledgers" ne="सबै ग्राहक खाता" />
          </Link>
          <Link href="/admin/purchasing#supplier-ledgers" className="rounded-full border border-brand-green bg-brand-paper px-4 py-2 text-sm font-black text-brand-green">
            <T en="All supplier ledgers" ne="सबै साहु खाता" />
          </Link>
        </div>
      </div>

      <div className="mt-4 print:hidden">
        <StatStrip
          items={[
            { en: `to collect · ${customerRows.length} ${customerRows.length === 1 ? "account" : "accounts"}`, ne: `उठाउन · ${customerRows.length} खाता`, value: receivable, money: true },
            { en: `to pay · ${supplierRows.length} ${supplierRows.length === 1 ? "account" : "accounts"}`, ne: `तिर्न · ${supplierRows.length} खाता`, value: payable, money: true },
            { en: "over 30 days", ne: "३० दिन नाघेको", value: overThirty, tone: overThirty > 0 ? "warn" : "good" },
          ]}
        />
      </div>

      <div className="mt-5">
        <PageTabs
          id="dues"
          tabs={[
            { key: "collect", en: "⬇ To collect", ne: "⬇ उठाउन", count: customerRows.length, content: collect },
            { key: "pay", en: "⬆ To pay", ne: "⬆ तिर्न", content: pay },
          ]}
        />
      </div>
    </section>
  );
}
