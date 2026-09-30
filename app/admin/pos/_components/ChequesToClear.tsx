import Link from "next/link";
import T from "@/components/T";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import { money } from "@/lib/format-money";
import { setChequeStateAction } from "@/app/admin/pos/actions";
import type { chequesToWatch } from "@/lib/cheques";
import type { PosInvoice } from "@/lib/pos";

type Row = ReturnType<typeof chequesToWatch<PosInvoice>>[number];

const button = "inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-black";

function StateButton({ id, state, className, children }: { id: string; state: string; className: string; children: React.ReactNode }) {
  return (
    <form action={setChequeStateAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="state" value={state} />
      <FormSubmitButton className={`${button} ${className}`}>{children}</FormSubmitButton>
    </form>
  );
}

/**
 * Cheques taken on bills and not yet paid by the bank (owner, 2026-09-30). A
 * cheque bill used to read "Paid" the moment it was saved; it stays here until
 * someone says the bank paid it — or that it bounced, and then until the money
 * is collected.
 */
export default function ChequesToClear({
  rows,
  ready,
  isOwner,
  canMark,
}: {
  rows: Row[];
  ready: boolean;
  isOwner: boolean;
  canMark: boolean;
}) {
  if (!ready) {
    if (!isOwner || rows.length === 0) return null;
    return (
      <Link
        href="/admin/settings"
        className="mt-8 block rounded-2xl border border-brand-gold bg-brand-cream-soft px-4 py-3 text-base font-bold text-brand-gold-deep"
      >
        <T
          en={`${rows.length} bill(s) were paid by cheque. To watch them until the bank pays, prepare the database in Settings →`}
          ne={`${rows.length} बिल चेकबाट तिरिएका छन्। बैंकले नसाटेसम्म हेर्न Settings मा database तयार गर्नुहोस् →`}
        />
      </Link>
    );
  }
  if (rows.length === 0) return null;

  const waiting = rows.filter((row) => row.state === "waiting");
  const waitingTotal = waiting.reduce((sum, row) => sum + row.amount, 0);

  return (
    <section className="mt-8 rounded-2xl border-2 border-brand-gold/60 bg-brand-cream-soft p-4 sm:p-5">
      <h2 className="text-lg font-black text-brand-green-ink">
        <T en={`Cheques to clear (${rows.length})`} ne={`चेक साट्न बाँकी (${rows.length})`} />
      </h2>
      <p className="mt-1 text-sm text-brand-muted">
        {waiting.length > 0 ? (
          <T
            en={`${money(waitingTotal)} is on paper until the bank pays. Mark each one when it clears — or if it bounces.`}
            ne={`बैंकले नसाटेसम्म ${money(waitingTotal)} कागजमा मात्र छ। साटिएपछि वा बाउन्स भएमा यहाँ थिच्नुहोस्।`}
          />
        ) : (
          <T en="These bounced: collect the money from the customer." ne="यी बाउन्स भए: ग्राहकबाट रकम उठाउनुहोस्।" />
        )}
      </p>
      <ul className="mt-3 grid gap-2">
        {rows.map(({ invoice, amount, state }) => (
          <li
            key={invoice.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
              state === "bounced" ? "border-brand-clay bg-brand-clay-tint" : "border-brand-green-line bg-brand-paper"
            }`}
          >
            <div className="min-w-0 text-base">
              <p className="font-black text-brand-green-ink">
                {money(amount)} · {invoice.customerName}
                {invoice.phone ? <span className="font-normal text-brand-muted"> · {invoice.phone}</span> : null}
              </p>
              <p className="text-sm text-brand-muted">
                <Link href={`/admin/pos/${invoice.id}`} className="underline">{invoice.invoiceNumber}</Link>
                {invoice.paymentReference ? ` · ${invoice.paymentReference}` : ""} · <DateDisplayAdmin date={invoice.createdAt} time={false} />
                {state === "bounced" ? (
                  <b className="text-brand-clay"> · <T en="bounced" ne="बाउन्स भयो" /></b>
                ) : null}
              </p>
            </div>
            {canMark ? (
              <div className="flex flex-wrap gap-2">
                {state === "waiting" ? (
                  <>
                    <StateButton id={invoice.id} state="cleared" className="bg-brand-green text-white">
                      <T en="✓ Bank paid" ne="✓ साटियो" />
                    </StateButton>
                    <StateButton id={invoice.id} state="bounced" className="border border-brand-clay text-brand-clay">
                      <T en="✕ Bounced" ne="✕ बाउन्स भयो" />
                    </StateButton>
                  </>
                ) : (
                  <StateButton id={invoice.id} state="recovered" className="bg-brand-green text-white">
                    <T en="✓ Money collected" ne="✓ रकम उठ्यो" />
                  </StateButton>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
