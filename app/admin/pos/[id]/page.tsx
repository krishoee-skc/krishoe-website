/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { repairPosInvoicePostingAction } from "@/app/admin/pos/actions";
import PrintInvoiceButton from "@/app/admin/pos/[id]/PrintInvoiceButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { getPosInvoiceById } from "@/lib/pos";
import { getAdminSettings } from "@/lib/admin-settings";
import { amountInWords } from "@/lib/amount-in-words";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import { whatsappToUrl } from "@/lib/commerce";

type PosInvoicePageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

// Every pair KRISHOE makes is footwear under one customs heading; shown on the
// bill the way the sample invoice carries it. Per-product codes can replace this
// later without touching the layout.
const HS_CODE = "6402.99.90";
const RETURN_NOTE = "Goods once sold will not be taken back.";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

// Plain rupees for the invoice columns (the sample prints amounts without the
// "Rs." prefix, which sits in the header instead).
function amount(value: number) {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  // The seller block on the bill — legal name, address, phone and PAN — comes
  // from the shop's own company settings, so one edit there updates every bill.
  const company = (await getAdminSettings()).company;
  const sellerName = company.legalName || company.companyName || "KRISHOE";

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
          className="inline-flex h-10 items-center rounded-full border border-brand-green-line bg-brand-paper px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
        >
          Back to POS
        </Link>
        <div className="flex flex-wrap gap-2">
          {invoice.phone ? (
            <a
              href={whatsappToUrl(invoice.phone, whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-emerald-500 bg-brand-paper px-4 text-sm font-bold text-emerald-700 transition hover:bg-emerald-500 hover:text-white"
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

      <div className="receipt-print mx-auto max-w-3xl rounded-lg border-2 border-brand-green-ink bg-white p-6 text-brand-green-ink shadow-sm print:border-2 print:shadow-none">
        {/* Seller header — legal name, address, phone and PAN, centred like a
            standard Nepal PAN sales invoice. Everything here comes from the
            shop's company settings, so one edit updates every future bill. */}
        <div className="border-b-2 border-brand-green-ink pb-3 text-center">
          <div className="flex items-center justify-center gap-3">
            <Image src="/images/logo-mark.png" alt="" aria-hidden width={128} height={128} className="h-9 w-9 shrink-0" />
            <h1 className="font-display text-2xl font-black uppercase tracking-wide text-brand-green-ink md:text-3xl">
              {sellerName}
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-brand-muted">
            {company.address || "—"}
            {company.phone ? <> · <span className="font-mono">+977 {company.phone}</span></> : null}
          </p>
          {company.panVatNumber ? (
            <p className="mt-1 inline-block border-b-4 border-brand-gold/60 text-sm font-black text-brand-green-ink">
              PAN No.: {company.panVatNumber}
            </p>
          ) : null}
        </div>

        <div className="my-4 flex justify-center">
          <span className="rounded bg-brand-green-ink px-6 py-1.5 text-sm font-black uppercase tracking-[0.16em] text-white">
            {invoice.kind === "Return" ? "Return Invoice" : "Sales Invoice"}
          </span>
        </div>

        {/* Customer (left) and invoice meta (right). Address and PAN carry a
            write-on line for now — a wholesale buyer's PAN can be filled by hand
            until it is captured on the bill form. */}
        <div className="grid gap-x-8 gap-y-2 border-b-2 border-brand-green-ink pb-3 text-sm sm:grid-cols-2">
          <div className="flex gap-1"><span className="w-28 shrink-0 text-brand-muted">Customer Name</span><span className="font-bold">: {invoice.customerName}</span></div>
          <div className="flex gap-1"><span className="w-28 shrink-0 text-brand-muted">Invoice No.</span><span className="font-bold">: {invoice.invoiceNumber}</span></div>
          <div className="flex items-end gap-1"><span className="w-28 shrink-0 text-brand-muted">Address</span>{invoice.customerAddress ? <span className="font-bold">: {invoice.customerAddress}</span> : <span className="flex-1 self-stretch border-b border-dotted border-brand-muted/50">:</span>}</div>
          <div className="flex gap-1"><span className="w-28 shrink-0 text-brand-muted">Invoice Date</span><span className="font-bold">: <DateDisplayAdmin date={invoice.createdAt} time={false} /></span></div>
          <div className="flex items-end gap-1"><span className="w-28 shrink-0 text-brand-muted">PAN No.</span>{invoice.customerPan ? <span className="font-bold">: {invoice.customerPan}</span> : <span className="flex-1 self-stretch border-b border-dotted border-brand-muted/50">:</span>}</div>
          <div className="flex gap-1"><span className="w-28 shrink-0 text-brand-muted">Payment Mode</span><span className="font-bold">: {invoice.paymentMethod}</span></div>
        </div>

        {/* Items — S.No, HS Code, Description, Size, Qty, Rate, Amount */}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-brand-green-ink text-left text-xs uppercase tracking-wide text-white">
                <th className="border border-brand-green-ink px-2 py-2">S.No</th>
                <th className="border border-brand-green-ink px-2 py-2">HS Code</th>
                <th className="border border-brand-green-ink px-2 py-2">Product Description</th>
                <th className="border border-brand-green-ink px-2 py-2">Size</th>
                <th className="border border-brand-green-ink px-2 py-2 text-right">Qty</th>
                <th className="border border-brand-green-ink px-2 py-2 text-right">Rate</th>
                <th className="border border-brand-green-ink px-2 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="border border-brand-green-line px-2 py-2 text-center">{index + 1}</td>
                  <td className="border border-brand-green-line px-2 py-2 font-mono text-xs">{HS_CODE}</td>
                  <td className="border border-brand-green-line px-2 py-2 font-semibold text-brand-green-ink">{item.design}</td>
                  <td className="border border-brand-green-line px-2 py-2">{item.sizeRun}</td>
                  <td className="border border-brand-green-line px-2 py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="border border-brand-green-line px-2 py-2 text-right tabular-nums">{amount(item.rate)}</td>
                  <td className="border border-brand-green-line px-2 py-2 text-right font-bold tabular-nums">{amount(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals — Basic, Discount, Net. No VAT line: KRISHOE bills on PAN. */}
        <div className="mt-4 flex justify-end">
          <table className="border-collapse text-sm">
            <tbody>
              <tr>
                <td className="border border-brand-green-line px-3 py-1.5 text-brand-muted">Basic Total</td>
                <td className="border border-brand-green-line px-3 py-1.5 text-right font-bold tabular-nums">{amount(invoice.subtotal)}</td>
              </tr>
              {invoice.discount > 0 ? (
                <tr>
                  <td className="border border-brand-green-line px-3 py-1.5 text-brand-muted">Discount</td>
                  <td className="border border-brand-green-line px-3 py-1.5 text-right font-bold tabular-nums">{amount(invoice.discount)}</td>
                </tr>
              ) : null}
              {invoice.tax > 0 ? (
                <tr>
                  <td className="border border-brand-green-line px-3 py-1.5 text-brand-muted">VAT</td>
                  <td className="border border-brand-green-line px-3 py-1.5 text-right font-bold tabular-nums">{amount(invoice.tax)}</td>
                </tr>
              ) : null}
              <tr className="bg-brand-mist">
                <td className="border-2 border-brand-green-ink px-3 py-2 font-black text-brand-green-ink">Net Total</td>
                <td className="border-2 border-brand-green-ink px-3 py-2 text-right text-base font-black tabular-nums text-brand-green-ink">{amount(invoice.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 border-y border-brand-green-ink py-2 text-sm">
          <span className="font-black">In Words:</span>{" "}
          <span className="italic text-brand-muted">{amountInWords(invoice.total)}</span>
        </div>

        <div className="mt-2 text-xs text-brand-muted">
          <p>Remarks: {invoice.note || "—"}</p>
          <p className="mt-0.5">Note: {RETURN_NOTE}</p>
        </div>

        {invoice.creditAmount > 0 ? (
          <div className="mt-2 flex justify-end gap-6 text-sm">
            <span className="text-brand-muted">Paid <span className="font-bold text-brand-green">{money(invoice.paidAmount)}</span></span>
            <span className="text-brand-muted">Balance <span className="font-bold text-brand-clay">{money(invoice.creditAmount)}</span></span>
          </div>
        ) : null}

        <div className="mt-8 flex items-end justify-between gap-8">
          <div className="flex-1 text-center">
            <div className="mt-6 border-t border-brand-green-ink pt-1 text-xs text-brand-muted">Received By</div>
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs font-black text-brand-green-ink">For: {sellerName}</p>
            <div className="mt-6 border-t border-brand-green-ink pt-1 text-xs text-brand-muted">Authorized Signature</div>
          </div>
        </div>

        {/* What this system adds over a plain paper bill: the sales channel, a
            scannable barcode and QR, and a one-tap WhatsApp send. */}
        <div className="mt-4 flex items-center gap-3 border-t border-dashed border-brand-green-line pt-3">
          <span className="shrink-0 rounded-full border border-brand-green-ink px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-brand-green-ink">
            {invoice.channel}
          </span>
          <img src={`/api/admin/pos/${invoice.id}/barcode`} alt={`Barcode for ${invoice.invoiceNumber}`} className="h-9 flex-1 object-contain" />
          <img src={`/api/admin/pos/${invoice.id}/qr`} alt={`QR code for ${invoice.invoiceNumber}`} className="h-12 w-12 shrink-0 object-contain" />
          {invoice.phone ? (
            <span className="shrink-0 rounded-full border border-emerald-500 px-2.5 py-1 text-[10px] font-black text-emerald-700 print:hidden">WhatsApp ✓</span>
          ) : null}
        </div>

        <p className="mt-3 border-t border-brand-green-line pt-2 text-center text-[11px] text-brand-muted">
          Billed by {invoice.cashier} · This is a computer generated invoice · KRISHOE POS
        </p>
      </div>
    </section>
  );
}
