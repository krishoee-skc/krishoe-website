import type { Metadata } from "next";
import { money } from "@/lib/format-money";
import Link from "next/link";
import T from "@/components/T";
import ExportButton from "@/components/admin/ExportButton";
import EnterWalkForm from "@/components/admin/EnterWalkForm";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import NepaliDateFieldUncontrolled from "@/components/admin/NepaliDateFieldUncontrolled";
import { PageTabs, StatStrip } from "@/components/admin/PageKit";
import { createWorkerPaymentAction } from "../actions";
import {
  getProductionAccountingSnapshot,
  getWeeklyWorkerSettlements,
} from "@/lib/production-accounting";
import { saturdayToFridayPeriod } from "@/lib/production-accounting-rules";
import WagesNav from "../_components/wages-nav";
import WorkerCashFields from "./WorkerCashFields";

export const metadata: Metadata = { title: "Payments | KRISHOE Admin" };
export const dynamic = "force-dynamic";

const input =
  "min-h-12 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 text-sm text-brand-green-ink outline-none focus:border-brand-green";
const card = "rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5";
const button =
  "min-h-12 rounded-xl bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink";
const chip = "rounded-full border border-brand-green-line bg-brand-paper px-3 py-2 text-xs font-black text-brand-green-ink";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

// The previous and next settlement week, for the arrows on the payment centre.
function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Saturday, which is when this shop actually hands money over.
 *
 * The payment centre used to sit at the bottom of an eighteen-section page,
 * below five forms that have never been used once. Paying ten workers meant
 * scrolling past all of them, every week.
 *
 * As the owner's sample 7ग (2026-10-13): both languages, three figures, and
 * this Saturday, everyone's balance, recent cash and the cash form behind four
 * tabs on a phone — every part still here, all open on a computer.
 */
export default async function WagesPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ settlementDate?: string }>;
}) {
  const query = await searchParams;
  const date = today();
  const reportDate = /^\d{4}-\d{2}-\d{2}$/.test(query.settlementDate ?? "")
    ? query.settlementDate!
    : date;
  const weeklyPeriod = saturdayToFridayPeriod(reportDate);
  const [data, weeklySettlements] = await Promise.all([
    getProductionAccountingSnapshot(),
    getWeeklyWorkerSettlements(weeklyPeriod),
  ]);
  const weeklyPayable = weeklySettlements.reduce((total, row) => total + row.payable, 0);
  const advanceToRecover = weeklySettlements.reduce((total, row) => total + row.advanceBalance, 0);

  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 pb-28 sm:p-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green"><T en="Factory accounts" ne="कारखानाको हिसाब" /></p>
          <h1 className="mt-1 text-2xl font-black text-brand-green-ink"><T en="Saturday payments" ne="शनिबारको भुक्तानी" /></h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
            <T
              en="Saturday kharcha, midweek advance, and what each worker is owed. Cash paid stays separate from work earned."
              ne="शनिबारको खर्च, हप्ताबीचको पेस्की, र हरेक कामदारलाई कति दिनुपर्छ। दिएको नगद र कमाएको ज्याला छुट्टै रहन्छन्।"
            />
          </p>
        </div>
        <WagesNav />
      </header>

      <div className="flex flex-wrap items-end gap-2">
        <form className="flex gap-2">
          <NepaliDateFieldUncontrolled name="settlementDate" defaultValue={reportDate} />
          <button className="min-h-11 rounded-xl border border-brand-green px-3 text-xs font-black text-brand-green">
            <T en="View week" ne="हप्ता हेर्ने" />
          </button>
        </form>
        <Link href={`?settlementDate=${shiftDate(reportDate, -7)}`} className={chip}>
          ← <T en="Previous week" ne="अघिल्लो हप्ता" />
        </Link>
        {reportDate !== date ? (
          <Link href={`?settlementDate=${date}`} className={chip}>
            <T en="Current week" ne="यो हप्ता" />
          </Link>
        ) : null}
        <Link href={`?settlementDate=${shiftDate(reportDate, 7)}`} className={chip}>
          <T en="Next week" ne="अर्को हप्ता" /> →
        </Link>
      </div>

      <StatStrip
        items={[
          { en: "to pay this Saturday", ne: "यो शनिबार दिनुपर्ने", value: weeklyPayable, money: true, tone: weeklyPayable > 0 ? "warn" : "good" },
          { en: "workers", ne: "कामदार", value: weeklySettlements.length },
          { en: "advance to recover", ne: "पेस्की कट्न बाँकी", value: advanceToRecover, money: true },
        ]}
      />

      <PageTabs
        id="wages-payments"
        openOnWide
        wideGridClassName="grid gap-5 xl:grid-cols-2"
        tabs={[
          {
            key: "saturday",
            en: "📅 This Saturday",
            ne: "📅 यो शनिबार",
            wideClassName: "xl:col-span-2",
            content: (
              <div className={card}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green"><T en="Saturday payment center" ne="शनिबारको भुक्तानी" /></p>
                    <h2 className="mt-1 text-lg font-black text-brand-green-ink">
                      {weeklyPeriod.start} <T en="to" ne="देखि" /> {weeklyPeriod.end}
                    </h2>
                  </div>
                  <ExportButton
                    href={`/api/admin/operations/production-export?type=weekly-settlements&date=${reportDate}`}
                    className="min-h-11 rounded-full bg-brand-green px-4 text-xs font-black text-white"
                  >
                    ⬇ <T en="Download payment sheet" ne="भुक्तानीको पाना" />
                  </ExportButton>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {weeklySettlements.map((row) => (
                    <Link
                      key={row.employeeId}
                      href={`/admin/operations/production-accounts/worker/${encodeURIComponent(row.employeeId)}?date=${reportDate}`}
                      className="hover-lift rounded-xl border border-brand-green-line bg-brand-paper-deep p-4 transition hover:border-brand-green"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-black text-brand-green-ink">{row.employeeName}</p>
                        <p className={`text-sm font-black ${row.closingBalance >= 0 ? "text-brand-green" : "text-brand-clay"}`}>
                          {row.closingBalance >= 0 ? money(row.payable) : <><T en="Advance" ne="पेस्की" /> {money(row.advanceBalance)}</>}
                        </p>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs tabular-nums">
                        <div><span className="text-brand-muted"><T en="Opening" ne="सुरुको" /></span><p className="mt-1 font-black">{money(row.openingBalance)}</p></div>
                        <div><span className="text-brand-muted"><T en="Earned" ne="कमाएको" /></span><p className="mt-1 font-black">{money(row.earned)}</p></div>
                        <div><span className="text-brand-muted"><T en="Cash" ne="नगद" /></span><p className="mt-1 font-black">{money(row.paid)}</p></div>
                      </div>
                      <p className="mt-3 text-xs font-bold text-brand-muted">
                        <T en={`${row.completedPairs} pairs · ${row.rejectedPairs} rejected`} ne={`${row.completedPairs} जोडी · ${row.rejectedPairs} बिग्रेको`} /> · <span className="text-brand-green"><T en="Pay →" ne="दिने →" /></span>
                      </p>
                    </Link>
                  ))}
                  {weeklySettlements.length === 0 ? (
                    <p className="text-sm text-brand-muted"><T en="No piece worker or production ledger yet." ne="अझै कुनै कामदारको हिसाब छैन।" /></p>
                  ) : null}
                </div>
              </div>
            ),
          },
          {
            key: "balances",
            en: "💰 Everyone's balance",
            ne: "💰 सबैको बाँकी",
            content: (
              <div className={card}>
                <h2 className="text-lg font-black text-brand-green-ink"><T en="Worker balance" ne="कामदारको बाँकी" /></h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {data.balances.map((row) => (
                    <Link
                      key={row.employeeId}
                      href={`/admin/operations/production-accounts/worker/${encodeURIComponent(row.employeeId)}`}
                      className="hover-lift rounded-xl border border-brand-green-line bg-brand-paper-deep p-4 transition hover:border-brand-green"
                    >
                      <p className="font-black text-brand-green-ink">{row.employeeName}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs tabular-nums">
                        <div><span className="text-brand-muted"><T en="Earned" ne="कमाएको" /></span><p className="mt-1 font-black">{money(row.earned)}</p></div>
                        <div><span className="text-brand-muted"><T en="Cash/adjustment" ne="नगद/मिलान" /></span><p className="mt-1 font-black">{money(row.paid)}</p></div>
                        <div><span className="text-brand-muted"><T en="Balance" ne="बाँकी" /></span><p className={`mt-1 font-black ${row.balance < 0 ? "text-brand-clay" : "text-brand-green"}`}>{money(row.balance)}</p></div>
                      </div>
                      <p className="mt-3 text-xs font-black text-brand-green"><T en="Open full ledger →" ne="पूरा खाता →" /></p>
                    </Link>
                  ))}
                  {data.balances.length === 0 ? <p className="text-sm text-brand-muted"><T en="No worker ledger yet. The clean start begins at zero." ne="अझै कुनै कामदारको खाता छैन। सुरु शून्यबाट हुन्छ।" /></p> : null}
                </div>
              </div>
            ),
          },
          {
            key: "recent",
            en: "💸 Recent cash",
            ne: "💸 भर्खरका",
            content: (
              <div className={card}>
                <h2 className="text-lg font-black text-brand-green-ink"><T en="Recent cash & adjustments" ne="भर्खरका नगद र मिलान" /></h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ExportButton href="/api/admin/operations/production-export?type=worker-payments" className="min-h-10 rounded-full bg-brand-green px-4 text-xs font-black text-white">
                    ⬇ <T en="Kharcha CSV" ne="खर्चको CSV" />
                  </ExportButton>
                  <ExportButton href="/api/admin/operations/production-export?type=work-entries" className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-4 text-xs font-black text-brand-green-ink">
                    ⬇ <T en="Work & wage CSV" ne="काम र ज्यालाको CSV" />
                  </ExportButton>
                </div>
                <p className="mt-2 text-xs leading-5 text-brand-muted">
                  <T
                    en="Friday: download both, filter Saturday to Friday, and compare earned wage, cash paid and what is left before Saturday's payment."
                    ne="शुक्रबार: दुवै डाउनलोड गरेर शनिबारदेखि शुक्रबारसम्म छानी, शनिबार दिनुअघि कमाएको, दिएको र बाँकी मिलाउनुहोस्।"
                  />
                </p>
                <div className="mt-4 space-y-2">
                  {data.payments.map((payment) => (
                    <Link
                      key={payment.id}
                      href={`/admin/operations/production-accounts/worker/${encodeURIComponent(payment.employeeId)}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-brand-paper-deep p-3 text-sm transition hover:bg-brand-green-wash"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-black text-brand-green-ink">{payment.employeeName} · {payment.paymentType}</p>
                        <p className="text-brand-muted">{payment.paymentDate} · {payment.receiptNumber}</p>
                      </div>
                      <p className={payment.direction === "Added" ? "font-black text-brand-green" : "font-black text-brand-clay"}>
                        {payment.direction === "Added" ? "+" : "−"}{money(payment.amount)}
                      </p>
                    </Link>
                  ))}
                  {data.payments.length === 0 ? <p className="text-sm text-brand-muted"><T en="No cash entry yet." ne="अझै कुनै नगद टिपिएको छैन।" /></p> : null}
                </div>
              </div>
            ),
          },
          {
            key: "cash",
            en: "＋ Cash",
            ne: "＋ नगद",
            wideClassName: "xl:col-span-2",
            content: (
              <EnterWalkForm action={createWorkerPaymentAction} className={card}>
                <h2 className="text-lg font-black text-brand-green-ink"><T en="Worker cash" ne="कामदारलाई नगद" /></h2>
                <p className="mt-1 text-sm text-brand-muted">
                  <T
                    en="Cash paid is separate from work earned and automatically reduces the balance."
                    ne="दिएको नगद कमाएको ज्यालाबाट छुट्टै टिपिन्छ, र बाँकी आफैँ घट्छ।"
                  />
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <WorkerCashFields employees={data.employees.map((employee) => ({ id: employee.id, name: employee.name }))} />
                  <input aria-label="Cash amount" name="amount" type="number" min="0.01" step="0.01" className={input} placeholder="Rs." required data-summary="money" />
                  <NepaliDateFieldUncontrolled name="paymentDate" defaultValue={date} required />
                  <input aria-label="Reason / note" name="note" className={`${input} sm:col-span-2`} placeholder="…" />
                </div>
                <FormSubmitButton className={`${button} mt-4`} pendingLabel="Approving cash…">
                  <T en="Owner approve cash" ne="नगद दिएको टिप्ने" />
                </FormSubmitButton>
              </EnterWalkForm>
            ),
          },
        ]}
      />
    </section>
  );
}
