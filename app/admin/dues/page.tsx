import Link from "next/link";
import type { Metadata } from "next";
import LoadFailure from "@/components/admin/LoadFailure";
import { getOperationsSnapshot } from "@/lib/operations";
import { getPurchasingSnapshot, type SupplierAgingRisk } from "@/lib/purchasing";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata: Metadata = {
  title: "Dues | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

// Customer aging buckets come straight from the ledger report as text; colour
// them so an overdue account catches the eye without reading the number.
function customerAgingTone(bucket: string) {
  if (bucket === "60+ days") return "border-red-200 bg-red-50 text-red-800";
  if (bucket === "31-60 days") return "border-amber-200 bg-amber-50 text-amber-800";
  if (bucket === "0-30 days") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function supplierAgingTone(risk: SupplierAgingRisk) {
  if (risk === "Critical") return "border-red-200 bg-red-50 text-red-800";
  if (risk === "High") return "border-orange-200 bg-orange-50 text-orange-800";
  if (risk === "Watch") return "border-amber-200 bg-amber-50 text-amber-800";
  if (risk === "Current") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function DueCard({
  label,
  nepali,
  value,
  count,
  tone,
}: {
  label: string;
  nepali: string;
  value: string;
  count: number;
  tone: "collect" | "pay";
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        tone === "collect"
          ? "border-emerald-200 bg-emerald-50"
          : "border-orange-200 bg-orange-50"
      }`}
    >
      <p className="text-sm font-black uppercase tracking-[0.14em] text-brand-green-ink">{label}</p>
      <p className="mt-1 text-xs font-semibold text-brand-muted">{nepali}</p>
      <p
        className={`mt-3 text-3xl font-black ${
          tone === "collect" ? "text-emerald-700" : "text-orange-700"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
        {count} {count === 1 ? "account" : "accounts"}
      </p>
    </div>
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

  return (
    <section className="p-6">
      <div>
        <h1 className="text-2xl font-black text-brand-green-ink">Dues</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
          कसले कति तिर्न बाँकी, कसलाई कति तिर्नु बाँकी — एकै ठाउँमा। Who owes the shop, and who the
          shop owes — biggest first.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <DueCard
          label="To collect"
          nepali="ग्राहकबाट पाउनु पर्ने"
          value={money(receivable)}
          count={customerRows.length}
          tone="collect"
        />
        <DueCard
          label="To pay"
          nepali="आपूर्तिकर्तालाई तिर्नु पर्ने"
          value={money(payable)}
          count={supplierRows.length}
          tone="pay"
        />
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-black text-brand-green-ink">To collect from customers</h2>
          <p className="mt-1 text-sm text-gray-500">
            ग्राहकबाट पाउनु पर्ने — पुरानो बाँकी माथि। Tap a name to open the customer ledger.
          </p>
        </div>

        {customerRows.length === 0 ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
            कसैबाट पैसा उठाउन बाँकी छैन। No customer dues right now.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="reflow-table min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Aging</th>
                  <th className="py-2 pr-3 text-right">Due</th>
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
                      <p className="mt-1 text-xs text-gray-400">{row.channel}</p>
                    </td>
                    <td data-label="Phone" className="py-3 pr-3 text-gray-600">
                      {row.phone || "-"}
                    </td>
                    <td data-label="Aging" className="py-3 pr-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${customerAgingTone(
                          row.agingBucket,
                        )}`}
                      >
                        {row.agingBucket}
                        {row.daysOutstanding > 0 ? ` · ${row.daysOutstanding}d` : ""}
                      </span>
                    </td>
                    <td
                      data-label="Due"
                      className="py-3 pr-3 text-right text-base font-black text-brand-clay"
                    >
                      {money(row.balanceDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-black text-brand-green-ink">To pay suppliers</h2>
          <p className="mt-1 text-sm text-gray-500">
            आपूर्तिकर्तालाई तिर्नु पर्ने — पुरानो बाँकी माथि। Tap a name to open the supplier account.
          </p>
        </div>

        {supplierRows.length === 0 ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
            कसैलाई पैसा तिर्न बाँकी छैन। No supplier dues right now.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="reflow-table min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Supplier</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Aging</th>
                  <th className="py-2 pr-3 text-right">Due</th>
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
                      <p className="mt-1 text-xs text-gray-400">{row.materialFocus || "-"}</p>
                    </td>
                    <td data-label="Phone" className="py-3 pr-3 text-gray-600">
                      {row.phone || "-"}
                    </td>
                    <td data-label="Aging" className="py-3 pr-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${supplierAgingTone(
                          row.risk,
                        )}`}
                      >
                        {row.risk}
                        {row.oldestOpenDays > 0 ? ` · ${row.oldestOpenDays}d` : ""}
                      </span>
                    </td>
                    <td
                      data-label="Due"
                      className="py-3 pr-3 text-right text-base font-black text-brand-clay"
                    >
                      {money(row.balanceDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
