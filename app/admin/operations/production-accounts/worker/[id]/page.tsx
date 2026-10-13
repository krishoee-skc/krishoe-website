import EnterWalkForm from "@/components/admin/EnterWalkForm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import T from "@/components/T";
import ExportButton from "@/components/admin/ExportButton";
import NepaliDateFieldUncontrolled from "@/components/admin/NepaliDateFieldUncontrolled";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { PageTabs, StatStrip } from "@/components/admin/PageKit";
import { money } from "@/lib/format-money";
import { getWorkerProductionAccount } from "@/lib/production-accounting";
import { saturdayToFridayPeriod } from "@/lib/production-accounting-rules";
import {
  createWorkerPaymentAction,
  reverseProductionWorkEntryAction,
  reverseWorkerPaymentAction,
} from "../../actions";

export const metadata: Metadata = { title: "Worker Ledger | KRISHOE Admin" };
export const dynamic = "force-dynamic";

function nepalToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

function tone(value: number) {
  return value < 0 ? "text-brand-clay" : "text-brand-green";
}

/**
 * A worker's production account (owner's sample 7ख, 2026-10-13): what Saturday
 * owes leads, behind the eye; the week's six figures and the lifetime three
 * fold under ⓘ; paying, the work and the cash sit behind three tabs on a phone
 * and all show on a computer. Reversing — never deleting — is as it was.
 */
export default async function WorkerProductionLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") ? query.date! : nepalToday();
  const period = saturdayToFridayPeriod(selectedDate);
  const account = await getWorkerProductionAccount(id, period);
  if (!account) notFound();

  const owing = account.statement.closingBalance >= 0;

  return (
    <section className="mx-auto max-w-6xl space-y-5 p-4 pb-28 sm:p-6">
      <header>
        <Link href="/admin/operations/production-accounts" className="text-sm font-bold text-brand-green underline underline-offset-4">
          ← <T en="Production accounts" ne="उत्पादन खाता" />
        </Link>
        <h1 className="mt-3 text-2xl font-black text-brand-green-ink">{account.employee.name}</h1>
        <p className="mt-1 text-sm text-brand-muted">
          {account.employee.id} · {account.employee.department}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-2">
        <form className="flex gap-2">
          <NepaliDateFieldUncontrolled name="date" defaultValue={selectedDate} />
          <button className="min-h-12 rounded-xl border border-brand-green px-4 text-sm font-black text-brand-green">
            <T en="View week" ne="हप्ता हेर्ने" />
          </button>
        </form>
        <ExportButton
          href={`/api/admin/operations/production-export?type=worker-statement&employeeId=${encodeURIComponent(id)}&date=${selectedDate}`}
          className="min-h-12 rounded-xl bg-brand-green px-4 text-sm font-black text-white"
        >
          ⬇ <T en="Download statement" ne="हिसाब डाउनलोड" />
        </ExportButton>
        {/* The same wages, read the other way: two pages, one press apart. */}
        <Link
          href={`/admin/factory/ledger?workerId=${encodeURIComponent(account.employee.id)}`}
          className="inline-flex min-h-12 items-center rounded-xl border border-brand-green-line px-4 text-sm font-black text-brand-green-ink"
        >
          📒 <T en="Worker's ledger" ne="कामदारको खाता" />
        </Link>
      </div>

      <StatStrip
        items={[
          owing
            ? { en: "to pay on Saturday", ne: "शनिबार दिनुपर्ने", value: account.statement.payable, money: true, tone: account.statement.payable > 0 ? "warn" : "good" }
            : { en: "advance still to recover", ne: "पेस्की कट्न बाँकी", value: account.statement.advanceBalance, money: true, tone: "warn" },
          { en: "pairs this week", ne: "यो हप्ताका जोडी", value: account.statement.pairs },
          { en: "earned this week", ne: "यो हप्ता कमाएको", value: account.statement.earned, money: true },
        ]}
      />

      <details className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-black text-brand-green-ink">
          ⓘ <T en={`The week ${period.start} to ${period.end}, in full`} ne={`${period.start} देखि ${period.end} सम्मको पूरा हिसाब`} />
        </summary>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            { en: "Opening balance", ne: "सुरुको बाँकी", value: money(account.statement.openingBalance) },
            { en: "Completed", ne: "बनेको", value: `${account.statement.pairs}` },
            { en: "Rejected", ne: "बिग्रेको", value: `${account.statement.rejectedPairs}` },
            { en: "Earned", ne: "कमाएको", value: money(account.statement.earned) },
            { en: "Cash / adjustment", ne: "नगद / मिलान", value: money(account.statement.paid) },
            { en: "Closing balance", ne: "अन्तिम बाँकी", value: money(account.statement.closingBalance) },
          ].map((cell) => (
            <div key={cell.en} className="rounded-xl bg-brand-paper-deep p-3">
              <p className="text-xs font-bold text-brand-muted"><T en={cell.en} ne={cell.ne} /></p>
              <p className="mt-1 font-black text-brand-green-ink">{cell.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs font-bold text-brand-muted">
          <T en="Opening balance + this week earned − cash/adjustments" ne="सुरुको बाँकी + यो हप्ता कमाएको − नगद/मिलान" />
        </p>
        <p className="mt-4 text-xs font-black uppercase tracking-wider text-brand-green"><T en="Since the start" ne="सुरुदेखि" /></p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {[
            { en: "Total earned", ne: "जम्मा कमाएको", value: money(account.lifetime.earned), color: "text-brand-green" },
            { en: "Cash / adjustments", ne: "नगद / मिलान", value: money(account.lifetime.paid), color: "text-brand-green-ink" },
            { en: "Current balance", ne: "अहिलेको बाँकी", value: money(account.lifetime.balance), color: tone(account.lifetime.balance) },
          ].map((cell) => (
            <div key={cell.en} className="rounded-xl border border-brand-green-line p-3">
              <p className="text-xs font-bold text-brand-muted"><T en={cell.en} ne={cell.ne} /></p>
              <p className={`mt-1 text-lg font-black ${cell.color}`}>{cell.value}</p>
            </div>
          ))}
        </div>
      </details>

      <PageTabs
        id="production-worker"
        openOnWide
        wideGridClassName="grid gap-5 xl:grid-cols-2"
        tabs={[
          {
            key: "pay",
            en: "💵 Saturday kharcha",
            ne: "💵 खर्च दिने",
            wideClassName: "xl:col-span-2",
            content: (
              <EnterWalkForm action={createWorkerPaymentAction} className="rounded-2xl border border-emerald-200 bg-brand-paper p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green"><T en="Owner cash approval" ne="मालिकले दिने नगद" /></p>
                    <h2 className="mt-1 text-lg font-black text-brand-green-ink"><T en="Record Saturday kharcha" ne="शनिबारको खर्च टिप्ने" /></h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
                      <T
                        en="Suggested amount is the current payable balance. Edit it to the cash actually handed over; the remaining amount automatically stays in the worker ledger."
                        ne="सुझाएको रकम अहिले दिनुपर्ने बाँकी हो। साँच्चै हातमा दिएको नगद लेख्नुहोस्; बाँकी आफैँ कामदारको खातामा रहन्छ।"
                      />
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                    <T en="Suggested" ne="सुझाव" /> {money(account.statement.payable)}
                  </span>
                </div>

                <input type="hidden" name="employeeId" value={account.employee.id} />
                <input type="hidden" name="paymentType" data-summary="text" value="Saturday Kharcha" />
                <input type="hidden" name="statementStart" value={period.start} />
                <input type="hidden" name="statementEnd" value={period.end} />

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm font-bold text-brand-green-ink">
                    <T en="Cash amount" ne="कति नगद" />
                    <input
                      name="amount" data-summary="money"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={account.statement.payable || ""}
                      className="mt-2 min-h-12 w-full rounded-xl border border-brand-green-line px-3 text-sm"
                      required
                    />
                  </label>
                  <label className="text-sm font-bold text-brand-green-ink">
                    <T en="Payment date" ne="कहिले दिइयो" />
                    <NepaliDateFieldUncontrolled name="paymentDate" defaultValue={nepalToday()} required />
                  </label>
                  <label className="text-sm font-bold text-brand-green-ink sm:col-span-2">
                    <T en="Note (optional)" ne="टिपोट (नलेखे पनि हुन्छ)" />
                    <input
                      name="note"
                      className="mt-2 min-h-12 w-full rounded-xl border border-brand-green-line px-3 text-sm"
                      placeholder="Worker request or payment detail"
                    />
                  </label>
                </div>

                <label className="mt-4 flex min-h-12 items-center gap-3 rounded-xl bg-brand-paper-deep px-3 text-sm font-bold text-brand-green-ink">
                  <input name="cashConfirmed" type="checkbox" value="yes" required className="size-5 accent-brand-green" />
                  <T en="I confirm this cash was handed to the worker." ne="यो नगद कामदारलाई हातमा दिएँ।" />
                </label>

                <FormSubmitButton
                  className="mt-4 min-h-12 rounded-xl bg-brand-green px-5 text-sm font-black text-white"
                  pendingLabel="Recording cash…"
                >
                  <T en="Approve & record cash" ne="नगद दिएको टिप्ने" />
                </FormSubmitButton>
              </EnterWalkForm>
            ),
          },
          {
            key: "work",
            en: "👟 Work",
            ne: "👟 काम",
            content: (
              <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5">
                <h2 className="text-lg font-black text-brand-green-ink"><T en="Work ledger" ne="कामको हिसाब" /></h2>
                <div className="mt-4 space-y-3">
                  {account.work.map((row) => (
                    <article key={row.id} className="rounded-xl border border-brand-green-line p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-black text-brand-green-ink">{row.itemName} · {row.stage}</p>
                          <p className="mt-1 text-brand-muted">
                            {row.workDate} · <T en={`${row.totalPairs} pairs`} ne={`${row.totalPairs} जोडी`} /> · <T en="rate" ne="दर" /> {money(row.ratePerPair)}
                          </p>
                          {Object.keys(row.sizeBreakdown).length ? (
                            <p className="mt-1 text-xs text-brand-muted">
                              <T en="Sizes" ne="साइज" />: {Object.entries(row.sizeBreakdown).map(([size, pairs]) => `${size}:${pairs}`).join(", ")}
                            </p>
                          ) : null}
                          {row.rejectedPairs ? (
                            <p className="mt-1 text-brand-clay">
                              <T en={`Reject: ${row.rejectedPairs} pairs`} ne={`बिग्रेको: ${row.rejectedPairs} जोडी`} />
                            </p>
                          ) : null}
                        </div>
                        <p className={`font-black ${row.status === "Reversed" ? "text-brand-muted-soft line-through" : "text-brand-green"}`}>
                          {money(row.earnedWage)}
                        </p>
                      </div>
                      {row.status === "Reversed" ? (
                        <p className="mt-2 rounded-lg bg-brand-mist px-2 py-1 text-xs font-black text-brand-muted">
                          <T en="Reversed — excluded from wage and production progress" ne="फिर्ता गरियो — ज्याला र उत्पादनमा गनिँदैन" />
                        </p>
                      ) : (
                        <details className="mt-3 border-t border-brand-green-line pt-3">
                          {/* Says what the form does. It reverses — the wage is
                              taken back, not fixed — and reading "Correct" here sent
                              the owner looking for the piece ledger's Correct
                              button. */}
                          <summary className="cursor-pointer text-xs font-black text-brand-clay">
                            <T en="Reverse this work entry" ne="यो काम फिर्ता गर्ने" />
                          </summary>
                          <EnterWalkForm action={reverseProductionWorkEntryAction} className="mt-3 space-y-3 rounded-xl bg-red-50 p-3">
                            <input type="hidden" name="entryId" value={row.id} />
                            <p className="text-xs leading-5 text-red-900">
                              <T
                                en="This removes the wage and recalculates the account. Finished stock cannot be reversed here."
                                ne="यसले ज्याला हटाएर खाता फेरि हिसाब गर्छ। लाइन काटिएर रहन्छ। तयार स्टक यहाँबाट फिर्ता हुँदैन।"
                              />
                            </p>
                            <p className="text-xs leading-5 text-brand-muted">
                              <T en="To change the colour, size, pairs or rate instead, open" ne="बरु रङ, साइज, जोडी वा दर फेर्न" />{" "}
                              <Link href="/admin/factory/ledger" className="font-black text-brand-green underline underline-offset-2">
                                <T en="the piece ledger" ne="कामदारको खाता" />
                              </Link>{" "}
                              <T en="and use Correct there." ne="खोलेर त्यहाँ सच्याउने थिच्नुहोस्।" />
                            </p>
                            <input aria-label="Reason for work reversal"
                              name="reason"
                              minLength={5}
                              className="min-h-11 w-full rounded-xl border border-red-200 bg-brand-paper px-3 text-sm"
                              placeholder="Reason for work reversal"
                              required
                            />
                            <label className="flex items-center gap-2 text-xs font-bold text-red-900">
                              <input name="reverseConfirmed" type="checkbox" value="yes" required className="size-4 accent-red-700" />
                              <T en="I confirm this completed-work entry is incorrect." ne="यो कामको entry गलत हो।" />
                            </label>
                            <FormSubmitButton
                              className="min-h-11 rounded-xl bg-red-700 px-4 text-xs font-black text-white"
                              pendingLabel="Reversing…"
                            >
                              <T en="Reverse this work" ne="काम फिर्ता गर्ने" />
                            </FormSubmitButton>
                          </EnterWalkForm>
                        </details>
                      )}
                    </article>
                  ))}
                  {account.work.length === 0 ? <p className="text-sm text-brand-muted"><T en="No work entry yet." ne="अझै कुनै काम टिपिएको छैन।" /></p> : null}
                </div>
              </div>
            ),
          },
          {
            key: "cash",
            en: "💸 Cash",
            ne: "💸 पैसा",
            content: (
              <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5">
                <h2 className="text-lg font-black text-brand-green-ink"><T en="Cash & adjustment ledger" ne="नगद र मिलानको हिसाब" /></h2>
                <div className="mt-4 space-y-3">
                  {account.payments.map((row) => (
                    <article key={row.id} className="rounded-xl border border-brand-green-line p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-black text-brand-green-ink">{row.paymentType}</p>
                          <p className="mt-1 text-brand-muted">{row.paymentDate} · <T en="Cash" ne="नगद" /> · {row.receiptNumber}</p>
                          <p className="mt-1 text-xs text-brand-muted"><T en="Approved by" ne="दिने" /> {row.approvedBy}{row.note ? ` · ${row.note}` : ""}</p>
                        </div>
                        <p className={`font-black ${row.direction === "Added" ? "text-brand-green" : "text-brand-clay"}`}>
                          {row.direction === "Added" ? "+" : "−"}{money(row.amount)}
                        </p>
                      </div>
                      <details className="mt-3 border-t border-brand-green-line pt-3">
                        <summary className="cursor-pointer text-xs font-black text-brand-clay">
                          <T en="Reverse this cash entry" ne="यो नगद फिर्ता गर्ने" />
                        </summary>
                        <EnterWalkForm action={reverseWorkerPaymentAction} className="mt-3 space-y-3 rounded-xl bg-red-50 p-3">
                          <input type="hidden" name="paymentId" value={row.id} />
                          <p className="text-xs leading-5 text-red-900">
                            <T
                              en={`This keeps receipt ${row.receiptNumber} in history but removes its effect from the worker balance.`}
                              ne={`रसिद ${row.receiptNumber} हिसाबमा रहन्छ, तर कामदारको बाँकीमा यसको असर हट्छ।`}
                            />
                          </p>
                          <input aria-label="Reason for reversal"
                            name="reason"
                            minLength={5}
                            className="min-h-11 w-full rounded-xl border border-red-200 bg-brand-paper px-3 text-sm"
                            placeholder="Reason for reversal"
                            required
                          />
                          <label className="flex items-center gap-2 text-xs font-bold text-red-900">
                            <input name="reverseConfirmed" type="checkbox" value="yes" required className="size-4 accent-red-700" />
                            <T en="I confirm this receipt is a mistaken entry." ne="यो रसिद गल्तीले टिपिएको हो।" />
                          </label>
                          <FormSubmitButton
                            className="min-h-11 rounded-xl bg-red-700 px-4 text-xs font-black text-white"
                            pendingLabel="Reversing…"
                          >
                            <T en="Reverse this payment" ne="भुक्तानी फिर्ता गर्ने" />
                          </FormSubmitButton>
                        </EnterWalkForm>
                      </details>
                    </article>
                  ))}
                  {account.payments.length === 0 ? <p className="text-sm text-brand-muted"><T en="No cash or adjustment entry yet." ne="अझै कुनै नगद वा मिलान टिपिएको छैन।" /></p> : null}
                </div>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}
