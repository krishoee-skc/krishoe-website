import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrintButton from "@/components/admin/PrintButton";
import { getPurchaseInvoiceById } from "@/lib/purchasing";
import { formatAdminDate } from "@/lib/format-date";

type PurchaseBillPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

export async function generateMetadata({ params }: PurchaseBillPageProps): Promise<Metadata> {
  const { id } = await params;
  const invoice = await getPurchaseInvoiceById(id);
  return { title: invoice ? `${invoice.purchaseNumber} | KRISHOE Purchase` : "Purchase bill not found" };
}

export default async function PurchaseBillPage({ params }: PurchaseBillPageProps) {
  const { id } = await params;
  const invoice = await getPurchaseInvoiceById(id);

  if (!invoice) {
    notFound();
  }

  const lines = invoice.items.length > 0 ? invoice.items : null;

  return (
    <section className="p-6 print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/purchasing"
          className="inline-flex h-10 items-center rounded-full border border-gray-200 bg-white px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
        >
          Back to Purchasing
        </Link>
        <PrintButton className="inline-flex h-10 items-center rounded-full bg-brand-green-ink px-5 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink">
          Print bill
        </PrintButton>
      </div>

      <div className="receipt-print mx-auto max-w-4xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
              KRISHOE factory and footwear
            </p>
            <h1 className="mt-2 text-3xl font-black text-brand-green-ink">Purchase bill</h1>
            <p className="mt-2 text-sm text-gray-500">{formatAdminDate(invoice.createdAt, { time: true })}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-black text-brand-green-ink">{invoice.purchaseNumber}</p>
            <p className="mt-2 rounded-full border border-gray-200 px-3 py-1 text-xs font-black text-gray-600">
              {invoice.status} / {invoice.postingStatus}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Supplier</p>
            <p className="mt-2 font-black text-brand-green-ink">{invoice.supplierName}</p>
            <p className="mt-1 text-sm text-gray-500">{invoice.kind}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Payment</p>
            <p className="mt-2 font-black text-brand-green-ink">{invoice.paymentMethod}</p>
            <p className="mt-1 text-sm text-gray-500">{invoice.paymentReference || "No reference"}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Note</p>
            <p className="mt-2 text-sm text-brand-green-ink">{invoice.note || "-"}</p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3 text-right">Qty</th>
                <th className="py-2 pr-3 text-right">Rate</th>
                <th className="py-2 pr-3 text-right">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines ? (
                lines.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-3 font-semibold text-brand-green-ink">
                      {item.itemName || item.design || "-"}
                    </td>
                    <td className="py-3 pr-3 text-gray-600">{item.kind}</td>
                    <td className="py-3 pr-3 text-right">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-3 pr-3 text-right">{money(item.rate)}</td>
                    <td className="py-3 pr-3 text-right font-bold">{money(item.lineTotal)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-3 pr-3 font-semibold text-brand-green-ink">
                    {invoice.materialName || invoice.design || "-"}
                  </td>
                  <td className="py-3 pr-3 text-gray-600">{invoice.kind}</td>
                  <td className="py-3 pr-3 text-right">
                    {invoice.quantity} {invoice.unit}
                  </td>
                  <td className="py-3 pr-3 text-right">{money(invoice.rate)}</td>
                  <td className="py-3 pr-3 text-right font-bold">{money(invoice.total)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs rounded-lg bg-brand-mist p-4">
            {invoice.discount > 0 ? (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-600">Discount</span>
                <span className="font-bold">{money(invoice.discount)}</span>
              </div>
            ) : null}
            {invoice.tax > 0 ? (
              <div className="mt-2 flex justify-between gap-3 text-sm">
                <span className="text-gray-600">Tax / VAT</span>
                <span className="font-bold">{money(invoice.tax)}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-gray-200 pt-3">
              <span className="font-black text-brand-green-ink">Total</span>
              <span className="text-xl font-black text-brand-green-ink">{money(invoice.total)}</span>
            </div>
            <div className="mt-3 flex justify-between gap-3 text-sm">
              <span className="text-gray-600">Paid</span>
              <span className="font-bold text-brand-green">{money(invoice.paidAmount)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-3 text-sm">
              <span className="text-gray-600">Due</span>
              <span className="font-bold text-brand-clay">{money(invoice.creditAmount)}</span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
          KRISHOE purchase record
        </p>
      </div>
    </section>
  );
}
