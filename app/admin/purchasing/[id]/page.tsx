import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import T from "@/components/T";
import PrintButton from "@/components/admin/PrintButton";
import { money } from "@/lib/format-money";
import { getPurchaseInvoiceById, type PurchaseInvoice } from "@/lib/purchasing";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import BillPhotos from "@/components/admin/BillPhotos";
import { MAX_BILL_PHOTOS, billPhotosReady, listBillPhotos } from "@/lib/purchase-photos";
import { reportError } from "@/lib/report-error";

type PurchaseBillPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

// The bill's own words in both languages (owner's sample 7ख, 2026-10-13):
// "Credit / Posted" read as two codes, and the page had no Nepali at all.
const STATUS_WORDS: Record<PurchaseInvoice["status"], { en: string; ne: string }> = {
  Paid: { en: "Paid", ne: "तिरिसकेको" },
  Partial: { en: "Part paid", ne: "केही तिरेको" },
  Credit: { en: "On credit", ne: "उधारो" },
};
const POSTING_WORDS: Record<PurchaseInvoice["postingStatus"], { en: string; ne: string }> = {
  Posted: { en: "on the supplier's account ✓", ne: "साहुको खातामा चढ्यो ✓" },
  "Needs Review": { en: "not on the supplier's account yet ⚠", ne: "साहुको खातामा अझै चढेन ⚠" },
};
const KIND_WORDS: Record<string, { en: string; ne: string }> = {
  "Raw Material": { en: "Raw material", ne: "कच्चा पदार्थ" },
  "Trading Goods": { en: "Goods to sell", ne: "बेच्ने सामान" },
  Mixed: { en: "Mixed", ne: "मिश्रित" },
};
const METHOD_WORDS: Record<PurchaseInvoice["paymentMethod"], { en: string; ne: string }> = {
  Cash: { en: "Cash", ne: "नगद" },
  Cheque: { en: "Cheque", ne: "चेक" },
  Bank: { en: "Bank", ne: "बैंक" },
  Credit: { en: "On credit", ne: "उधारो" },
  QR: { en: "QR", ne: "QR" },
};
const said = (words: { en: string; ne: string } | undefined, fallback: string) =>
  words ? <T en={words.en} ne={words.ne} /> : fallback;

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
  // One shape for the phone's list and the table: a bill from before lines
  // carried one item on the bill itself.
  const rows = lines
    ? lines.map((item) => ({
        key: item.id,
        name: item.itemName || item.design || "-",
        kind: item.kind as string,
        quantity: `${item.quantity} ${item.unit}`,
        rate: item.rate,
        total: item.lineTotal,
      }))
    : [
        {
          key: invoice.id,
          name: invoice.materialName || invoice.design || "-",
          kind: invoice.kind as string,
          quantity: `${invoice.quantity} ${invoice.unit}`,
          rate: invoice.rate,
          total: invoice.total,
        },
      ];
  // A store hiccup must not take the bill itself down with it.
  const photos = billPhotosReady()
    ? await listBillPhotos(invoice.id).catch((error) => {
        reportError("list purchase bill photos", error);
        return [];
      })
    : null;

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
          {/* The supplier's whole account, one press away. */}
          {invoice.supplierLedgerId ? (
            <Link
              href={`/admin/purchasing/supplier/${invoice.supplierLedgerId}`}
              className="inline-flex h-10 items-center rounded-full border border-brand-green bg-brand-paper px-4 text-sm font-bold text-brand-green transition hover:bg-brand-green-wash"
            >
              📒 <T en="Supplier's account" ne="साहुको खाता" />
            </Link>
          ) : null}
          <PrintButton className="inline-flex h-10 items-center rounded-full bg-brand-green-ink px-5 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink">
            🖨️ <T en="Print bill" ne="बिल छाप्ने" />
          </PrintButton>
        </div>
      </div>

      <div className="receipt-print mx-auto max-w-4xl rounded-lg border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-6 print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-brand-green-line pb-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
              KRISHOE · <T en="Purchase bill" ne="खरिद बिल" />
            </p>
            <h1 className="mt-2 break-words font-display text-3xl font-black text-brand-green-ink">{invoice.supplierName}</h1>
            <p className="mt-2 text-sm text-brand-muted"><DateDisplayAdmin date={invoice.createdAt} time={true} /></p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-black text-brand-green-ink">{invoice.purchaseNumber}</p>
            <p className="mt-2 rounded-full border border-brand-green-line px-3 py-1 text-sm font-black text-brand-muted">
              {said(STATUS_WORDS[invoice.status], invoice.status)} · {said(POSTING_WORDS[invoice.postingStatus], invoice.postingStatus)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-brand-paper-deep p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-muted"><T en="Supplier" ne="साहु" /></p>
            <p className="mt-2 font-black text-brand-green-ink">{invoice.supplierName}</p>
            <p className="mt-1 text-sm text-brand-muted">{said(KIND_WORDS[invoice.kind], invoice.kind)}</p>
          </div>
          <div className="rounded-lg bg-brand-paper-deep p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-muted"><T en="How it was paid" ne="कसरी तिरियो" /></p>
            <p className="mt-2 font-black text-brand-green-ink">{said(METHOD_WORDS[invoice.paymentMethod], invoice.paymentMethod)}</p>
            <p className="mt-1 text-sm text-brand-muted">{invoice.paymentReference || <T en="No reference" ne="नम्बर छैन" />}</p>
          </div>
          <div className="rounded-lg bg-brand-paper-deep p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-muted"><T en="Note" ne="टिपोट" /></p>
            <p className="mt-2 text-sm text-brand-green-ink">{invoice.note || "-"}</p>
          </div>
        </div>

        {/* Two lines an item on a phone; the table for a computer and for
            paper (owner's sample 7ख): five columns ran off a phone. */}
        <ul className="mt-6 grid list-none gap-2 pl-0 md:hidden print:hidden">
          {rows.map((row) => (
            <li key={`line-${row.key}`} className="grid gap-0.5 border-b border-brand-green-line pb-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 break-words font-semibold text-brand-green-ink">{row.name}</span>
                <span className="shrink-0 font-bold tabular-nums">{money(row.total)}</span>
              </div>
              <p className="text-xs text-brand-muted">
                {said(KIND_WORDS[row.kind], row.kind)} · {row.quantity} × {money(row.rate)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-6 hidden overflow-x-auto md:block print:block">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-brand-muted">
              <tr>
                <th className="py-2 pr-3"><T en="Item" ne="सामान" /></th>
                <th className="py-2 pr-3"><T en="Kind" ne="किसिम" /></th>
                <th className="py-2 pr-3 text-right"><T en="Qty" ne="परिमाण" /></th>
                <th className="py-2 pr-3 text-right"><T en="Rate" ne="दर" /></th>
                <th className="py-2 pr-3 text-right"><T en="Line total" ne="जम्मा" /></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="py-3 pr-3 font-semibold text-brand-green-ink">{row.name}</td>
                  <td className="py-3 pr-3 text-brand-muted">{said(KIND_WORDS[row.kind], row.kind)}</td>
                  <td className="py-3 pr-3 text-right">{row.quantity}</td>
                  <td className="py-3 pr-3 text-right">{money(row.rate)}</td>
                  <td className="py-3 pr-3 text-right font-bold">{money(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs rounded-lg bg-brand-mist p-4">
            {invoice.discount > 0 ? (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-brand-muted"><T en="Discount" ne="छुट" /></span>
                <span className="font-bold">{money(invoice.discount)}</span>
              </div>
            ) : null}
            {invoice.tax > 0 ? (
              <div className="mt-2 flex justify-between gap-3 text-sm">
                <span className="text-brand-muted"><T en="Tax / VAT" ne="कर / VAT" /></span>
                <span className="font-bold">{money(invoice.tax)}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-brand-green-line pt-3">
              <span className="font-black text-brand-green-ink"><T en="Total" ne="जम्मा" /></span>
              <span className="text-xl font-black text-brand-green-ink">{money(invoice.total)}</span>
            </div>
            <div className="mt-3 flex justify-between gap-3 text-sm">
              <span className="text-brand-muted"><T en="Paid" ne="तिरेको" /></span>
              <span className="font-bold text-brand-green">{money(invoice.paidAmount)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-3 text-sm">
              <span className="text-brand-muted"><T en="Due" ne="बाँकी" /></span>
              <span className="font-bold text-brand-clay">{money(invoice.creditAmount)}</span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted-soft">
          KRISHOE purchase record
        </p>
      </div>
      {photos ? (
        <BillPhotos
          invoiceId={invoice.id}
          photos={photos.map(({ url, pathname }) => ({ url, pathname }))}
          max={MAX_BILL_PHOTOS}
        />
      ) : null}
    </section>
  );
}
