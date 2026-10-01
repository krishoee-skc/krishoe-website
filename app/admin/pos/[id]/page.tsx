/* eslint-disable @next/next/no-img-element */
import { businessContact, getSiteUrl } from "@/lib/seo";
import T from "@/components/T";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { repairPosInvoicePostingAction, voidTestBillAction } from "@/app/admin/pos/actions";
import { canAdmin, requireAdminPermission } from "@/lib/admin-permissions";
import { voidRefusal } from "@/lib/pos-void";
import PrintInvoiceButton from "@/app/admin/pos/[id]/PrintInvoiceButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { money } from "@/lib/format-money";
import { getPosInvoiceById } from "@/lib/pos";
import { getAdminSettings } from "@/lib/admin-settings";
import { amountInWords } from "@/lib/amount-in-words";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import { whatsappToUrl } from "@/lib/commerce";
import { groupBillLines, sizeSummary } from "@/lib/bill-lines";

type PosInvoicePageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ problem?: string }>;
};

export const dynamic = "force-dynamic";

// The HS Code column is kept, empty (owner, 2026-09-30). It printed 6402.99.90
// on every line — the heading for plastic uppers — on leather and fabric shoes
// as well. Put a code here if one is wanted on every bill; per-shoe codes can
// fill the same column later without touching the layout.
const HS_CODE = "";


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

export default async function PosInvoicePage({ params, searchParams }: PosInvoicePageProps) {
  const { id } = await params;
  const problem = (await searchParams)?.problem ?? "";
  const { role } = await requireAdminPermission("pos:read");
  const invoice = await getPosInvoiceById(id);

  if (!invoice) {
    notFound();
  }

  // A test bill can be cancelled by the Owner (owner, 2026-10-01) — see
  // lib/pos-void.ts for which bills, and why a return was not the way.
  const voided = invoice.status === "Voided";
  const canVoid =
    canAdmin(role, "settings:write") &&
    !voidRefusal({
      kind: invoice.kind,
      status: invoice.status,
      creditAmount: invoice.creditAmount,
      ledgerTransactionId: invoice.ledgerTransactionId,
      payments: invoice.payments ?? [],
    });

  // The seller block on the bill — legal name, address, phone and PAN — comes
  // from the shop's own company settings, so one edit there updates every bill.
  const company = (await getAdminSettings()).company;

  // Just the domain — a bill has no room for https:// and the customer does
  // not type that part anyway.
  const shopDomain = getSiteUrl()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
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

      {problem ? (
        <p role="alert" className="mx-auto mb-4 max-w-3xl rounded-xl border border-brand-clay/40 bg-brand-clay-tint px-4 py-3 text-base font-bold text-brand-clay print:hidden">
          ⚠ {problem}
        </p>
      ) : null}

      {voided ? (
        <div className="mx-auto mb-4 max-w-3xl rounded-xl border-2 border-brand-clay bg-brand-clay-tint px-4 py-3 text-brand-clay" data-bill-voided>
          <p className="text-lg font-black">
            ✕ <T en="CANCELLED — test bill" ne="रद्द — परीक्षण बिल" />
          </p>
          <p className="text-sm font-bold">
            <T
              en="Not a sale: its pairs went back to stock and it is left out of every total, report and the cheque book."
              ne="बिक्री होइन: यसका जोडी स्टकमा फर्किए, र यो कुनै जम्मा, रिपोर्ट वा चेक खातामा गनिँदैन।"
            />
          </p>
        </div>
      ) : null}

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
        <div className="receipt-fields grid gap-x-8 gap-y-2 border-b-2 border-brand-green-ink pb-3 text-sm sm:grid-cols-2">
          <div className="flex gap-1"><span className="w-28 shrink-0 text-brand-muted">Customer Name</span><span className="font-bold">: {invoice.customerName}</span></div>
          <div className="flex gap-1"><span className="w-28 shrink-0 text-brand-muted">Invoice No.</span><span className="font-bold">: {invoice.invoiceNumber}</span></div>
          <div className="flex items-end gap-1"><span className="w-28 shrink-0 text-brand-muted">Address</span>{invoice.customerAddress ? <span className="font-bold">: {invoice.customerAddress}</span> : <span className="flex-1 self-stretch border-b border-dotted border-brand-muted/50">:</span>}</div>
          <div className="flex gap-1"><span className="w-28 shrink-0 text-brand-muted">Invoice Date</span><span className="font-bold">: <DateDisplayAdmin date={invoice.createdAt} time={false} /></span></div>
          <div className="flex items-end gap-1"><span className="w-28 shrink-0 text-brand-muted">PAN No.</span>{invoice.customerPan ? <span className="font-bold">: {invoice.customerPan}</span> : <span className="flex-1 self-stretch border-b border-dotted border-brand-muted/50">:</span>}</div>
          {/* A bill paid in parts names every part: the customer's copy has to
              say where each rupee went, the exchange and the old credit too. */}
          <div className="flex gap-1">
            <span className="w-28 shrink-0 text-brand-muted">Payment Mode</span>
            <span className="font-bold">
              :{" "}
              {invoice.payments && invoice.payments.length > 0
                ? invoice.payments
                    .map((part) => {
                      const ref = part.reference ? ` (${part.reference})` : "";
                      if (part.method === "Exchange") return `Exchange ${money(part.amount)}${part.against ? ` (${part.against})` : ""}`;
                      if (part.purpose === "due") return `Old credit ${part.method} ${money(part.amount)}${ref}`;
                      if (part.purpose === "refund") return `Given back ${part.method} ${money(part.amount)}`;
                      return `${part.method} ${money(part.amount)}${ref}`;
                    })
                    .join(" + ")
                : invoice.paymentMethod}
            </span>
          </div>
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
              {/* One row per shoe, colour and rate, its sizes in the Size
                  column — a wholesale bill of two shoes in five sizes printed
                  ten rows. A line with its own discount keeps its own row, so
                  every row's amount is still quantity × rate less what shows. */}
              {groupBillLines(invoice.items, (item) => (item.discount > 0 ? item.id : "")).map((group, index) => {
                const first = group.lines[0];
                const pairs = group.lines.reduce((sum, item) => sum + item.quantity, 0);
                const total = group.lines.reduce((sum, item) => sum + item.lineTotal, 0);
                return (
                  <tr key={group.key}>
                    <td className="border border-brand-green-line px-2 py-2 text-center">{index + 1}</td>
                    <td className="border border-brand-green-line px-2 py-2 font-mono text-xs">{HS_CODE}</td>
                    <td className="border border-brand-green-line px-2 py-2 font-semibold text-brand-green-ink">
                      {first.design}
                      {group.color ? <span className="font-normal text-brand-muted"> · {group.color}</span> : null}
                    </td>
                    {/* The size the customer took; older bills only carry the stock row. */}
                    <td className="border border-brand-green-line px-2 py-2">
                      {sizeSummary(group.lines.map((item) => ({ size: item.size || item.sizeRun, pairs: item.quantity })))}
                    </td>
                    <td className="border border-brand-green-line px-2 py-2 text-right tabular-nums">{pairs}</td>
                    <td className="border border-brand-green-line px-2 py-2 text-right tabular-nums">{amount(group.rate)}</td>
                    <td className="border border-brand-green-line px-2 py-2 text-right font-bold tabular-nums">{amount(total)}</td>
                  </tr>
                );
              })}
            </tbody>
            {/* How many pairs in all — what a wholesale buyer counts first
                when the carton is opened (owner, 2026-09-30). */}
            <tfoot>
              <tr className="bg-brand-mist font-black">
                <td colSpan={4} className="border border-brand-green-line px-2 py-2 text-right">Total Pairs</td>
                <td className="border border-brand-green-line px-2 py-2 text-right tabular-nums">
                  {invoice.items.reduce((sum, item) => sum + item.quantity, 0)}
                </td>
                <td colSpan={2} className="border border-brand-green-line px-2 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Totals — Basic, Discount, Net. No VAT line: KRISHOE bills on PAN.
            Basic Total only when something comes off or on it: with neither,
            it printed the Net Total's figure twice (owner, 2026-09-30). */}
        <div className="mt-4 flex justify-end">
          <table className="border-collapse text-sm">
            <tbody>
              {invoice.discount > 0 || invoice.tax > 0 ? (
                <tr>
                  <td className="border border-brand-green-line px-3 py-1.5 text-brand-muted">Basic Total</td>
                  <td className="border border-brand-green-line px-3 py-1.5 text-right font-bold tabular-nums">{amount(invoice.subtotal)}</td>
                </tr>
              ) : null}
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

        {/* The bill used to carry "Goods once sold will not be taken back"
            here, which contradicts the shop: /return-policy and the storefront
            trust strip both promise seven days to exchange or return. A
            customer holding a bill that says the opposite of the website has
            been told two different things by the same shop, and the one on
            paper is the one they will believe.

            The shop's own line now prints at the foot instead, from Settings. */}
        {/* Remarks only when there is one; "Remarks: —" said nothing. */}
        {invoice.note ? (
          <div className="mt-2 text-xs text-brand-muted">
            <p>Remarks: {invoice.note}</p>
          </div>
        ) : null}

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

        {/* What the customer can actually use, on the paper they take home.
            The bill is the one thing they still have three days later, when
            the shoe turns out to be a size small — and until now the foot of
            it said "This is a computer generated invoice", which tells them
            nothing.

            The return line is the shop's own, from Settings, so the window
            stays the shop's decision. Blank prints nothing rather than an
            empty box. The phone and web address come from what the shop
            already knows about itself, so there is no second place to keep
            them in step. */}
        {company.billFooterNote ? (
          <p className="mt-3 border-t border-brand-green-line pt-2 text-center text-[11px] font-bold text-brand-green-ink">
            {company.billFooterNote}
          </p>
        ) : null}

        {/* Asking the counter customer for a review, on the paper they keep.
            Counter customers leave no email, so this is the only ask that
            reaches them (owner, 2026-09-29). */}
        <div className="mt-3 flex items-center justify-center gap-3 border-t border-dashed border-brand-green-line pt-2">
          <img src="/api/admin/review-qr" alt="QR code for the KRISHOE review page" className="h-16 w-16 shrink-0 object-contain" />
          <p className="text-left text-[12px] font-bold leading-snug text-brand-green-ink">
            <T
              en="How were your shoes? Scan the QR and write two lines 🙏"
              ne="जुत्ता कस्तो लाग्यो? QR स्क्यान गरी दुई शब्द लेखिदिनुहोस् 🙏"
            />
            <span className="block font-normal text-brand-muted">{shopDomain}/review</span>
          </p>
        </div>

        <p className="mt-1 text-center text-[11px] text-brand-muted">
          {company.phone ? <>☎ {company.phone} · </> : null}
          {businessContact.whatsappDisplay ? <>WhatsApp {businessContact.whatsappDisplay} · </> : null}
          <span className="font-bold">{shopDomain}</span>
        </p>

        <p className="mt-1 text-center text-[11px] text-brand-muted">
          Billed by {invoice.cashier} · KRISHOE POS
        </p>
      </div>

      {canVoid ? (
        <details className="mx-auto mt-6 max-w-3xl rounded-xl border border-brand-clay/40 bg-brand-paper p-4 print:hidden" data-void-test-bill>
          <summary className="cursor-pointer text-base font-black text-brand-clay">
            <T en="Cancel as a test bill" ne="परीक्षण बिल — रद्द गर्ने" />
          </summary>
          <p className="mt-2 text-sm leading-6 text-brand-muted">
            <T
              en="Only for a bill cut to try the counter, not a real sale. Its pairs go back to stock, it leaves the sales, reports and the cheque book, and it stays on file marked cancelled with your reason. It cannot be undone here."
              ne="साँचो बिक्री नभई counter जाँच्न काटिएको बिलका लागि मात्र। यसका जोडी स्टकमा फर्किन्छन्, यो बिक्री, रिपोर्ट र चेक खाताबाट हट्छ, र तपाईंको कारणसहित ‘रद्द’ भनेर रहन्छ। यहाँबाट फेरि फर्काउन मिल्दैन।"
            />
          </p>
          <form action={voidTestBillAction} className="mt-3 grid gap-3">
            <input type="hidden" name="id" value={invoice.id} />
            <label className="grid gap-1 text-sm font-bold text-brand-muted">
              <T en="Why (required)" ne="किन (अनिवार्य)" />
              <input
                name="reason"
                required
                maxLength={160}
                defaultValue="Test bill — not a real sale"
                className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink"
              />
            </label>
            <label className="flex items-start gap-2 text-base font-bold text-brand-green-ink">
              <input type="checkbox" name="confirm" value="yes" required className="mt-1 h-5 w-5" />
              <T
                en={`Yes — ${invoice.invoiceNumber} was a test, not a real sale.`}
                ne={`हो — ${invoice.invoiceNumber} परीक्षण थियो, साँचो बिक्री होइन।`}
              />
            </label>
            <FormSubmitButton className="min-h-11 w-fit rounded-xl bg-brand-clay px-5 text-base font-black text-white">
              <T en="Cancel this bill" ne="यो बिल रद्द गर्ने" />
            </FormSubmitButton>
          </form>
        </details>
      ) : null}
    </section>
  );
}
