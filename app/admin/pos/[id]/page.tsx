/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { repairPosInvoicePostingAction } from "@/app/admin/pos/actions";
import PrintInvoiceButton from "@/app/admin/pos/[id]/PrintInvoiceButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { getPosInvoiceById } from "@/lib/pos";
import { formatAdminDate } from "@/lib/format-date";
import { whatsappToUrl } from "@/lib/commerce";

type PosInvoicePageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return formatAdminDate(value, { time: true });
}

export async function generateMetadata({ params }: PosInvoicePageProps): Promise<Metadata> {
  const { id } = await params;
  const invoice = await getPosInvoiceById(id);

  return {
    title: invoice ? `${invoice.invoiceNumber} | KRISHOE POS` : "POS Bill Not Found",
  };
}

export default async function PosInvoicePage({ params }: PosInvoicePageProps) {
  const { id } = await params;
  const invoice = await getPosInvoiceById(id);

  if (!invoice) {
    notFound();
  }

  // A ready-to-send bill summary for the customer's WhatsApp. Kept short — the
  // number, what was paid, and anything still due.
  const whatsappMessage = [
    `नमस्ते ${invoice.customerName}, KRISHOE बिल ${invoice.invoiceNumber}`,
    `जम्मा: ${money(invoice.total)}`,
    `तिरेको: ${money(invoice.paidAmount)}`,
    invoice.creditAmount > 0 ? `बाँकी: ${money(invoice.creditAmount)}` : "",
    "धन्यवाद! 🙏",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <section className="p-6 print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/pos"
          className="inline-flex h-10 items-center rounded-full border border-gray-200 bg-white px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
        >
          Back to POS
        </Link>
        <div className="flex flex-wrap gap-2">
          {invoice.phone ? (
            <a
              href={whatsappToUrl(invoice.phone, whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-emerald-500 bg-white px-4 text-sm font-bold text-emerald-700 transition hover:bg-emerald-500 hover:text-white"
            >
              WhatsApp bill
            </a>
          ) : null}
          {invoice.postingStatus === "Needs Review" ? (
            <form action={repairPosInvoicePostingAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <input type="hidden" name="returnTo" value={`/admin/pos/${invoice.id}`} />
              <FormSubmitButton className="inline-flex h-10 items-center rounded-full border border-brand-clay px-4 text-sm font-bold text-brand-clay transition hover:bg-brand-clay hover:text-white">
                Repair posting
              </FormSubmitButton>
            </form>
          ) : null}
          <PrintInvoiceButton />
        </div>
      </div>

      <div className="receipt-print mx-auto max-w-4xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
              KRISHOE factory and footwear
            </p>
            <h1 className="mt-2 text-3xl font-black text-brand-green-ink">
              {invoice.kind === "Return" ? "Return bill" : "Sales bill"}
            </h1>
            {/* formatDate carries the Bikram Sambat date after the English one,
                so the bill reads naturally to a Nepali reader. */}
            <p className="mt-2 text-sm text-gray-500">
              {invoice.channel} - {formatDate(invoice.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-black text-brand-green-ink">{invoice.invoiceNumber}</p>
            <p className="mt-2 rounded-full border border-gray-200 px-3 py-1 text-xs font-black text-gray-600">
              {invoice.status} / {invoice.postingStatus}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Customer</p>
            <p className="mt-2 font-black text-brand-green-ink">{invoice.customerName}</p>
            <p className="mt-1 text-sm text-gray-500">{invoice.phone || "No phone"}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Payment</p>
            <p className="mt-2 font-black text-brand-green-ink">{invoice.paymentMethod}</p>
            <p className="mt-1 text-sm text-gray-500">{invoice.paymentReference || "No reference"}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Cashier</p>
            <p className="mt-2 font-black text-brand-green-ink">{invoice.cashier}</p>
            <p className="mt-1 text-sm text-gray-500">{invoice.note || "No note"}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_180px]">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Invoice barcode</p>
            <img
              src={`/api/admin/pos/${invoice.id}/barcode`}
              alt={`Barcode for ${invoice.invoiceNumber}`}
              className="mt-3 h-24 w-full object-contain print:mt-1 print:h-12"
            />
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Invoice QR</p>
            <img
              src={`/api/admin/pos/${invoice.id}/qr`}
              alt={`QR code for ${invoice.invoiceNumber}`}
              className="mx-auto mt-3 h-32 w-32 object-contain print:mt-1 print:h-16 print:w-16"
            />
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3">Design</th>
                <th className="py-2 pr-3">Size</th>
                <th className="py-2 pr-3 text-right">Pairs</th>
                <th className="py-2 pr-3 text-right">Rate</th>
                <th className="py-2 pr-3 text-right">Discount</th>
                <th className="py-2 pr-3 text-right">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-3 font-mono text-xs">{item.sku || "-"}</td>
                  <td className="py-3 pr-3 font-semibold text-brand-green-ink">{item.design}</td>
                  <td className="py-3 pr-3">{item.sizeRun}</td>
                  <td className="py-3 pr-3 text-right">{item.quantity}</td>
                  <td className="py-3 pr-3 text-right">{money(item.rate)}</td>
                  <td className="py-3 pr-3 text-right">{money(item.discount)}</td>
                  <td className="py-3 pr-3 text-right font-bold">{money(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-[1fr_280px] print:block">
          {/* Internal reconciliation ids — useful on screen, but not something a
              customer's printed bill needs, and it was pushing the receipt onto
              a second sheet. Hidden on paper. */}
          <div className="rounded-lg border border-dashed border-gray-200 p-4 print:hidden">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Billing IDs</p>
            <div className="mt-3 grid gap-2 text-sm text-gray-600">
              <p>
                Barcode value: <span className="font-mono font-bold text-brand-green-ink">{invoice.barcodeValue}</span>
              </p>
              <p className="break-all">
                QR payload: <span className="font-mono text-xs text-brand-green-ink">{invoice.qrPayload}</span>
              </p>
              <p>
                Stock movement IDs:{" "}
                <span className="font-mono text-xs text-brand-green-ink">
                  {invoice.stockMovementIds.length > 0 ? invoice.stockMovementIds.join(", ") : "Not posted"}
                </span>
              </p>
              <p>
                Ledger transaction:{" "}
                <span className="font-mono text-xs text-brand-green-ink">
                  {invoice.ledgerTransactionId || "Not linked"}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-brand-mist p-4">
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-bold">{money(invoice.subtotal)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-3 text-sm">
              <span className="text-gray-600">Discount</span>
              <span className="font-bold">{money(invoice.discount)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-3 text-sm">
              <span className="text-gray-600">Tax / VAT</span>
              <span className="font-bold">{money(invoice.tax)}</span>
            </div>
            <div className="mt-4 border-t border-gray-200 pt-4">
              <div className="flex justify-between gap-3">
                <span className="font-black text-brand-green-ink">Total</span>
                <span className="text-xl font-black text-brand-green-ink">{money(invoice.total)}</span>
              </div>
              <div className="mt-3 flex justify-between gap-3 text-sm">
                <span className="text-gray-600">Paid</span>
                <span className="font-bold text-brand-green">{money(invoice.paidAmount)}</span>
              </div>
              <div className="mt-2 flex justify-between gap-3 text-sm">
                <span className="text-gray-600">Credit</span>
                <span className="font-bold text-brand-clay">{money(invoice.creditAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
          Thank you for choosing KRISHOE
        </p>
      </div>
    </section>
  );
}
