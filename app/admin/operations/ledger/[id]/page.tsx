import EnterWalkForm from "@/components/admin/EnterWalkForm";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import Link from "next/link";
import { notFound } from "next/navigation";
import T from "@/components/T";
import {
  createLedgerTransactionAction,
  reverseLedgerTransactionAction,
  updateCustomerLedgerAction,
} from "@/app/admin/operations/actions";
import PrintLedgerButton from "@/app/admin/operations/ledger/PrintLedgerButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import LedgerTransactionFields from "@/app/admin/operations/_components/LedgerTransactionFields";
import { PageTabs, StatStrip } from "@/components/admin/PageKit";
import { money } from "@/lib/format-money";
import { whatsappToUrl } from "@/lib/commerce";
import { readSavedMessage } from "@/lib/saved-message";
import { getCustomerLedgerDetail, type LedgerTransaction } from "@/lib/operations";

type LedgerDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
};

const inputClass =
  "h-10 rounded-md border border-brand-green-line px-3 text-sm outline-none focus:border-brand-green";
const textareaClass =
  "min-h-24 rounded-md border border-brand-green-line px-3 py-2 text-sm outline-none focus:border-brand-green";

// The book's own words, in both languages (owner's sample 7ख, 2026-10-13):
// this page was English throughout.
const TYPE_WORDS: Record<LedgerTransaction["type"], { en: string; ne: string }> = {
  "Cash Payment": { en: "Cash taken", ne: "नगद लिएको" },
  "Cheque Payment": { en: "Cheque taken", ne: "चेक लिएको" },
  "Credit Sale": { en: "Credit sale", ne: "उधारो बिक्री" },
  "Return Adjustment": { en: "Goods returned", ne: "सामान फिर्ता" },
  "Manual Adjustment": { en: "Adjustment", ne: "हिसाब मिलान" },
};
const PRIORITY_WORDS: Record<string, { en: string; ne: string }> = {
  Urgent: { en: "Call today", ne: "आजै फोन गर्ने" },
  High: { en: "Remind within three days", ne: "तीन दिनभित्र सम्झाउने" },
  Medium: { en: "Follow up this week", ne: "यो हप्ता सम्झाउने" },
  Monitor: { en: "Normal follow-up", ne: "सामान्य रूपमा सम्झाउने" },
  Clear: { en: "Nothing due", ne: "बाँकी छैन" },
};
const said = (words: { en: string; ne: string } | undefined, fallback: string) =>
  words ? <T en={words.en} ne={words.ne} /> : fallback;

function reducesDue(type: LedgerTransaction["type"]) {
  return type === "Cash Payment" || type === "Cheque Payment" || type === "Return Adjustment";
}

function StatCard({ label, value, detail }: { label: ReactNode; value: ReactNode; detail: ReactNode }) {
  return (
    <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4 shadow-sm">
      <p className="text-sm font-medium text-brand-muted">{label}</p>
      <p className="mt-2 text-xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-2 text-xs font-semibold text-brand-muted-soft">{detail}</p>
    </div>
  );
}

export async function generateMetadata({ params }: LedgerDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCustomerLedgerDetail(id);

  return {
    title: detail ? `${detail.ledger.customerName} Ledger | KRISHOE Admin` : "Ledger Not Found",
  };
}

export const dynamic = "force-dynamic";

export default async function CustomerLedgerDetailPage({ params, searchParams }: LedgerDetailPageProps) {
  const { id } = await params;
  const saved = (await searchParams)?.saved;
  const detail = await getCustomerLedgerDetail(id);

  if (!detail) {
    notFound();
  }

  const { ledger, transactions, summary, paymentTransactions } = detail;
  const returnTo = `/admin/operations/ledger/${ledger.id}`;
  const savedWords = saved ? readSavedMessage(saved) : null;
  const reversedCount = transactions.filter((transaction) => transaction.reversedAt).length;
  const reminder = `Namaste ${ledger.customerName}, KRISHOE: Rs. ${summary.balanceDue.toLocaleString("en-IN")} is due on your account. Thank you.`;

  const historyTable =
    transactions.length === 0 ? (
      <div className="rounded-lg border border-dashed border-brand-green-line p-6 text-sm text-brand-muted">
        <T en="No transaction has been recorded for this customer yet." ne="यो ग्राहकको अझै कुनै हिसाब टिपिएको छैन।" />
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
              <th className="py-2 pr-3"><T en="Note" ne="टिपोट" /></th>
              <th className="py-2 pr-3 print:hidden"><T en="Take back" ne="फिर्ता" /></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.map((transaction) => {
              const reversed = Boolean(transaction.reversedAt);
              return (
                <tr key={transaction.id} className={reversed ? "opacity-70" : ""}>
                  <td className="reflow-primary py-3 pr-3 text-xs text-brand-muted"><DateDisplayAdmin date={transaction.createdAt} time={true} /></td>
                  <td data-label="Type" data-label-ne="किसिम" className="py-3 pr-3 font-semibold text-brand-green-ink">
                    {said(TYPE_WORDS[transaction.type], transaction.type)}
                    {reversed ? (
                      <span className="ms-1.5 inline-block rounded bg-brand-clay-tint px-2 py-0.5 text-xs font-black text-brand-clay">
                        <T en="taken back" ne="फिर्ता" />
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Effect" data-label-ne="असर" className="py-3 pr-3">
                    <span className="rounded-full bg-brand-mist px-3 py-1 text-xs font-bold text-brand-green">
                      {reversed ? (
                        <T en="no change" ne="फेरबदल छैन" />
                      ) : reducesDue(transaction.type) ? (
                        <T en="Due reduced" ne="बाँकी घट्यो" />
                      ) : (
                        <T en="Due added" ne="बाँकी बढ्यो" />
                      )}
                    </span>
                  </td>
                  <td data-label="Amount" data-label-ne="रकम" className={`py-3 pr-3 font-bold ${reversed ? "line-through" : ""}`}>{money(transaction.amount)}</td>
                  <td data-label="Note" data-label-ne="टिपोट" className="max-w-80 py-3 pr-3 text-brand-muted">
                    {transaction.note || "-"}
                    {reversed && transaction.reversalReason ? (
                      <span className="mt-1 block text-xs font-bold text-brand-clay">↩ {transaction.reversalReason}</span>
                    ) : null}
                  </td>
                  <td data-label="Take back" data-label-ne="फिर्ता" className="py-3 pr-3 print:hidden">
                    {reversed ? (
                      <span className="text-xs text-brand-muted">—</span>
                    ) : (
                      // Taken back with a reason, never deleted (owner,
                      // 2026-10-13): the line stays, crossed out.
                      <details>
                        <summary className="cursor-pointer text-xs font-black text-brand-clay underline underline-offset-2">
                          ↩ <T en="Take back" ne="फिर्ता गर्ने" />
                        </summary>
                        <form action={reverseLedgerTransactionAction} className="mt-2 grid gap-2 rounded-lg bg-brand-clay-tint p-2">
                          <input type="hidden" name="id" value={transaction.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <input
                            name="reason"
                            required
                            minLength={5}
                            aria-label="Reason for taking it back"
                            placeholder="Why? e.g. entered twice"
                            className="min-h-10 rounded-lg border border-brand-clay/30 bg-brand-paper px-2 text-xs"
                          />
                          <p className="text-xs leading-4 text-brand-clay">
                            <T
                              en="The line stays, crossed out with this reason, and the balance moves back. Nothing is removed."
                              ne="लाइन यही कारणसहित काटिएर रहन्छ, र बाँकी पहिलेजस्तै हुन्छ। केही मेटिँदैन।"
                            />
                          </p>
                          <FormSubmitButton className="min-h-10 rounded-lg bg-brand-clay px-3 text-xs font-black text-white">
                            <T en="Take back" ne="फिर्ता गर्ने" />
                          </FormSubmitButton>
                        </form>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  return (
    <section className="p-4 sm:p-6 print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/dues"
          className="inline-flex h-10 items-center rounded-full border border-brand-green-line bg-brand-paper px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
        >
          ← <T en="Credit / Dues" ne="उधारो" />
        </Link>
        <div className="flex flex-wrap gap-2">
          {ledger.phone ? (
            <>
              <a
                href={`tel:${ledger.phone}`}
                className="inline-flex h-10 items-center rounded-full border border-brand-green-line bg-brand-paper px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
              >
                📞 <T en="Call" ne="फोन गर्ने" />
              </a>
              <a
                href={whatsappToUrl(ledger.phone, reminder)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center rounded-full border border-emerald-500 bg-brand-paper px-4 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
              >
                💬 WhatsApp
              </a>
            </>
          ) : null}
          <PrintLedgerButton />
        </div>
      </div>

      {savedWords ? (
        <p role="status" className={`mb-4 rounded-xl border px-4 py-3 text-sm font-bold print:hidden ${savedWords.en.startsWith("⚠") ? "border-brand-clay/40 bg-brand-clay-tint text-brand-clay" : "border-brand-green-line bg-brand-green-wash text-brand-green-ink"}`}>
          <T en={savedWords.en} ne={savedWords.ne} />
        </p>
      ) : null}

      <div className="receipt-print rounded-lg border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-6 print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-brand-green-line pb-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
              <T en="Customer ledger" ne="ग्राहकको खाता" /> · {ledger.channel}
            </p>
            <h1 className="mt-2 break-words font-display text-3xl font-black text-brand-green-ink">{ledger.customerName}</h1>
            <p className="mt-2 text-sm text-brand-muted">
              {ledger.phone || <T en="No phone" ne="फोन छैन" />} · <T en="Last transaction" ne="पछिल्लो हिसाब" /> {ledger.lastTransaction}
            </p>
          </div>
          {/* On paper the due heads the statement; on screen it leads the
              figures below, behind the eye. */}
          <div className="hidden rounded-lg bg-brand-mist px-5 py-4 text-right print:block">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">Balance due</p>
            <p className="mt-2 text-3xl font-black text-brand-green-ink">{money(summary.balanceDue)}</p>
          </div>
        </div>

        {/* Three figures first (owner's sample 7ख); the eight that stood here
            and the priority line fold under ⓘ. None of it prints. */}
        <div className="mt-5 grid gap-3 print:hidden">
          <StatStrip
            items={[
              { en: "to collect", ne: "उठाउन बाँकी", value: summary.balanceDue, money: true, tone: summary.balanceDue > 0 ? "warn" : "good" },
              {
                en: "days since the last line",
                ne: "दिन, पछिल्लो हिसाबदेखि",
                value: summary.daysOutstanding,
                tone: summary.balanceDue > 0 && summary.daysOutstanding > 30 ? "warn" : undefined,
              },
              { en: "credit limit", ne: "उधारो सीमा", value: ledger.creditLimit > 0 ? ledger.creditLimit : "—", money: ledger.creditLimit > 0 },
            ]}
          />
          <details className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-3">
            <summary className="cursor-pointer text-sm font-black text-brand-green-ink">
              ⓘ <T en="More figures" ne="थप अंक" /> · {said(PRIORITY_WORDS[summary.collectionPriority], summary.collectionPriority)}
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label={<T en="Cash taken" ne="नगद लिएको" />} value={money(summary.cashPaid)} detail={<T en="received" ne="आएको" />} />
              <StatCard label={<T en="Cheques taken" ne="चेक लिएको" />} value={money(summary.chequePaid)} detail={<T en="received" ne="आएको" />} />
              <StatCard label={<T en="Credit given" ne="उधारो दिएको" />} value={money(summary.creditGiven)} detail={<T en="sales on credit" ne="उधारो बिक्री" />} />
              <StatCard label={<T en="Lines" ne="हिसाब" />} value={summary.transactionCount} detail={money(summary.transactionTotal)} />
              <StatCard label={<T en="Order payments" ne="अर्डरका भुक्तानी" />} value={summary.linkedPaymentCount} detail={money(summary.linkedPaymentTotal)} />
              <StatCard label={<T en="How old" ne="कति पुरानो" />} value={summary.agingBucket} detail={<T en={`${summary.daysOutstanding} days`} ne={`${summary.daysOutstanding} दिन`} />} />
              <StatCard label={<T en="Collected of credit" ne="उधारोमध्ये उठेको" />} value={`${summary.collectionCoverageRate}%`} detail={money(summary.collectionTotal)} />
              <StatCard label={<T en="Remind by" ne="कहिलेसम्म सम्झाउने" />} value={summary.followUpDueDate || "-"} detail={said(PRIORITY_WORDS[summary.collectionPriority], summary.collectionPriority)} />
            </div>
            <p className="mt-3 text-sm font-semibold text-brand-green-ink">{summary.nextAction}</p>
          </details>
        </div>

        <div className="mt-5">
          <PageTabs
            id="customer-ledger"
            openOnWide
            wideGridClassName="grid gap-6 lg:grid-cols-2"
            tabs={[
              {
                key: "collect",
                wideClassName: "lg:order-1",
                en: "💵 Take money",
                ne: "💵 पैसा लिने",
                content: (
                  <EnterWalkForm action={createLedgerTransactionAction} className="grid gap-3 rounded-lg border border-brand-green-line bg-brand-paper-deep p-4 print:hidden">
                    <h2 className="font-black text-brand-green-ink"><T en="New line on the account" ne="खातामा नयाँ हिसाब" /></h2>
                    <input type="hidden" name="ledgerId" value={ledger.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <LedgerTransactionFields
                      balanceDue={summary.balanceDue}
                      inputClass={inputClass}
                      textareaClass={textareaClass}
                    />
                    <FormSubmitButton className="h-10 rounded-full bg-brand-green px-4 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink">
                      <T en="Record transaction" ne="हिसाब टिप्ने" />
                    </FormSubmitButton>
                  </EnterWalkForm>
                ),
              },
              {
                key: "history",
                en: "📜 Lines",
                ne: "📜 हिसाब",
                wideClassName: "lg:order-3 lg:col-span-2",
                content: (
                  <div>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-black text-brand-green-ink"><T en="Transaction history" ne="हिसाबको क्रम" /></h2>
                        <p className="mt-1 text-sm text-brand-muted">
                          <T
                            en={`Cash, cheque, credit, return and adjustment.${reversedCount > 0 ? ` ${reversedCount} taken back, crossed out.` : ""}`}
                            ne={`नगद, चेक, उधारो, फिर्ता र मिलान।${reversedCount > 0 ? ` ${reversedCount} फिर्ता गरिएका, काटिएर।` : ""}`}
                          />
                        </p>
                      </div>
                      <p className="text-sm font-bold text-brand-clay">
                        <T en="Current due:" ne="अहिलेको बाँकी:" /> {money(summary.balanceDue)}
                      </p>
                    </div>
                    {historyTable}
                  </div>
                ),
              },
              {
                key: "orders",
                en: "🧾 Order payments",
                ne: "🧾 अर्डर",
                wideClassName: "lg:order-4 lg:col-span-2",
                content: (
                  <div>
                    <div className="mb-4">
                      <h2 className="text-lg font-black text-brand-green-ink"><T en="Linked order payments" ne="जोडिएका अर्डरका भुक्तानी" /></h2>
                      <p className="mt-1 text-sm text-brand-muted">
                        <T en="Order payment records connected to this ledger." ne="यो खातासँग जोडिएका अर्डरका भुक्तानी।" />
                      </p>
                    </div>

                    {paymentTransactions.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-brand-green-line p-6 text-sm text-brand-muted">
                        <T en="No order payment has been linked to this ledger yet." ne="यो खातामा अझै कुनै अर्डरको भुक्तानी जोडिएको छैन।" />
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="reflow-table min-w-full text-sm">
                          <thead className="border-b text-left text-brand-muted">
                            <tr>
                              <th className="py-2 pr-3"><T en="Date" ne="मिति" /></th>
                              <th className="py-2 pr-3"><T en="Order" ne="अर्डर" /></th>
                              <th className="py-2 pr-3"><T en="Status" ne="अवस्था" /></th>
                              <th className="py-2 pr-3"><T en="Provider" ne="कसरी" /></th>
                              <th className="py-2 pr-3"><T en="Amount" ne="रकम" /></th>
                              <th className="py-2 pr-3"><T en="Reference" ne="नम्बर" /></th>
                              <th className="py-2 pr-3"><T en="Note" ne="टिपोट" /></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {paymentTransactions.map((transaction) => (
                              <tr key={transaction.id}>
                                <td className="reflow-primary py-3 pr-3 text-xs text-brand-muted"><DateDisplayAdmin date={transaction.createdAt} time={true} /></td>
                                <td data-label="Order" data-label-ne="अर्डर" className="py-3 pr-3 font-mono text-xs text-brand-green-ink">{transaction.orderId}</td>
                                <td data-label="Status" data-label-ne="अवस्था" className="py-3 pr-3 font-semibold text-brand-green-ink">{transaction.paymentStatus}</td>
                                <td data-label="Provider" data-label-ne="कसरी" className="py-3 pr-3">{transaction.paymentProvider.toUpperCase()}</td>
                                <td data-label="Amount" data-label-ne="रकम" className="py-3 pr-3 font-bold">{money(transaction.amount)}</td>
                                <td data-label="Reference" data-label-ne="नम्बर" className="max-w-56 py-3 pr-3 text-brand-muted">
                                  {transaction.paymentTransactionId || transaction.paymentReference || "-"}
                                </td>
                                <td data-label="Note" data-label-ne="टिपोट" className="max-w-72 py-3 pr-3 text-brand-muted">{transaction.note || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "details",
                wideClassName: "lg:order-2",
                en: "✏️ Details",
                ne: "✏️ विवरण",
                content: (
                  <EnterWalkForm action={updateCustomerLedgerAction} className="grid gap-3 rounded-lg border border-brand-green-line bg-brand-paper-deep p-4 print:hidden">
                    <h2 className="font-black text-brand-green-ink"><T en="Customer details" ne="ग्राहकको विवरण" /></h2>
                    <input type="hidden" name="id" value={ledger.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label className="grid gap-1 text-sm font-bold text-brand-green-ink">
                      <T en="Name" ne="नाम" />
                      <input name="customerName" required className={inputClass} defaultValue={ledger.customerName} aria-label="Customer name" />
                    </label>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1 text-sm font-bold text-brand-green-ink">
                        <T en="Phone" ne="फोन" />
                        <input name="phone" className={inputClass} defaultValue={ledger.phone} aria-label="Phone" />
                      </label>
                      <label className="grid gap-1 text-sm font-bold text-brand-green-ink">
                        <T en="Sells through" ne="कसरी किन्छ" />
                        <select name="channel" className={inputClass} defaultValue={ledger.channel} aria-label="Channel">
                          <option>Wholesale</option>
                          <option>Retail</option>
                          <option>Online</option>
                        </select>
                      </label>
                    </div>
                    <label className="grid gap-1 text-sm font-bold text-brand-green-ink">
                      <T en="Credit limit (0 = no limit)" ne="उधारो सीमा (0 = सीमा छैन)" />
                      <input name="creditLimit" type="number" min="0" className={inputClass} defaultValue={ledger.creditLimit} aria-label="Credit limit (0 = no limit)" />
                    </label>
                    {/* The money moves only by a line on the account (owner,
                        2026-10-13): the boxes that set it by hand are gone. */}
                    <p className="text-xs leading-5 text-brand-muted">
                      <T
                        en="Cash, cheques, credit and what is due change only by a line on the account, so every rupee has its reason. To put the balance right, record an Adjustment."
                        ne="नगद, चेक, उधारो र बाँकी खाताको हिसाबबाट मात्र फेरिन्छ, ताकि हरेक रुपैयाँको कारण रहोस्। बाँकी मिलाउन “हिसाब मिलान” टिप्नुहोस्।"
                      />
                    </p>
                    <FormSubmitButton className="h-10 rounded-full bg-brand-green-ink px-4 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink">
                      <T en="Save customer" ne="विवरण राख्ने" />
                    </FormSubmitButton>
                  </EnterWalkForm>
                ),
              },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
