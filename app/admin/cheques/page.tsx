import type { Metadata } from "next";
import Link from "next/link";
import T from "@/components/T";
import NepaliDateFieldUncontrolled from "@/components/admin/NepaliDateFieldUncontrolled";
import { canAdmin, requireAdminPermission } from "@/lib/admin-permissions";
import { bikramMonthKeyOf, bikramMonthRange, toBikramSambatNumeric } from "@/lib/bikram-sambat";
import { chequeBookReady, getCheques } from "@/lib/cheque-book";
import {
  allowedActions,
  billsMissingDetails,
  bounceReasonWords,
  BOUNCE_REASONS,
  chequeRupees,
  chequeStage,
  chequeTotals,
  chequeWeeks,
  daysBetween,
  needsDetails,
  NEPAL_BANKS,
  type Cheque,
  type ChequeAction,
  type ChequeStage,
} from "@/lib/cheque-book-rules";
import { chequeAmount } from "@/lib/cheques";
import { nepalDayKey } from "@/lib/dashboard-figures";
import { getPosInvoices } from "@/lib/pos";
import { reportError } from "@/lib/report-error";
import { addBillChequeAction, editChequeAction, moveChequeAction } from "./actions";
import ChequeWhatsApp from "./ChequeWhatsApp";

export const metadata: Metadata = { title: "Cheques | KRISHOE Admin" };
export const dynamic = "force-dynamic";

/**
 * The cheque book (owner, 2026-10-01): every cheque taken on a bill or given
 * on a purchase — whose, which bank, the number, the amount, the date to
 * deposit or from which it can be cashed, and what the bank did and when.
 * Bigger type than the rest of the admin, at the owner's asking.
 */

type Tab = "in" | "out" | "dates";

const bs = (key: string) => (key ? toBikramSambatNumeric(`${key}T00:00:00Z`) : "");

const STAGE: Record<ChequeStage, { en: string; ne: string; tone: string }> = {
  hold: { en: "In hand", ne: "हातमा", tone: "bg-brand-cream-soft text-brand-gold-deep" },
  deposit: { en: "Deposit now", ne: "अब बैंकमा राख्ने", tone: "bg-amber-100 text-amber-900" },
  "in-bank": { en: "In the bank", ne: "बैंकमा", tone: "bg-sky-100 text-sky-900" },
  cashable: { en: "Given", ne: "दिइएको", tone: "bg-violet-100 text-violet-900" },
  cleared: { en: "Cleared ✓", ne: "पास भयो ✓", tone: "bg-emerald-100 text-emerald-900" },
  bounced: { en: "Bounced", ne: "फर्कियो", tone: "bg-red-100 text-red-900" },
  recovered: { en: "Collected ✓", ne: "उठ्यो ✓", tone: "bg-emerald-100 text-emerald-900" },
  cancelled: { en: "Cancelled", ne: "रद्द", tone: "bg-brand-mist text-brand-muted" },
  "no-date": { en: "No date", ne: "मिति छैन", tone: "bg-brand-mist text-brand-muted" },
};

const ACTION_WORDS: Record<ChequeAction, { en: string; ne: string; outEn?: string; outNe?: string }> = {
  deposit: { en: "🏦 Deposited", ne: "🏦 बैंकमा राखेँ" },
  clear: { en: "✓ Bank paid", ne: "✓ बैंकले दियो", outEn: "✓ Supplier cashed it", outNe: "✓ Supplier ले साट्यो" },
  bounce: { en: "✕ Bounced", ne: "✕ फर्कियो", outEn: "✕ Came back", outNe: "✕ फर्कियो" },
  recover: { en: "✓ Money collected", ne: "✓ पैसा उठ्यो", outEn: "✓ Paid again", outNe: "✓ फेरि तिरियो" },
  cancel: { en: "Cancel this cheque", ne: "यो चेक रद्द गर्ने" },
};

function StagePill({ cheque, todayKey }: { cheque: Cheque; todayKey: string }) {
  const stage = chequeStage(cheque, todayKey);
  const words = STAGE[stage];
  const overdue = stage === "deposit" && cheque.chequeDate < todayKey;
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-black ${words.tone}`}>
      <T en={words.en} ne={words.ne} />
      {overdue ? (
        <>
          {" · "}
          <T en={`${daysBetween(cheque.chequeDate, todayKey)} days late`} ne={`${daysBetween(cheque.chequeDate, todayKey)} दिन ढिला`} />
        </>
      ) : null}
    </span>
  );
}

/** The cheque's story, oldest step first, with the next one still to come. */
function Timeline({ cheque, todayKey }: { cheque: Cheque; todayKey: string }) {
  const out = cheque.direction === "out";
  const steps: Array<{ en: string; ne: string; when: string; tone: "done" | "next" | "bad" }> = [
    {
      ...(out
        ? { en: `Given with ${cheque.sourceNumber || "a purchase"}`, ne: `${cheque.sourceNumber || "खरिद"} सँगै दिइयो` }
        : { en: `Taken with ${cheque.sourceNumber || "a bill"}`, ne: `${cheque.sourceNumber || "बिल"} सँगै लिइयो` }),
      when: bs(nepalDayKey(cheque.createdAt)),
      tone: "done",
    },
  ];
  if (cheque.depositedOn) steps.push({ en: "Put in the bank", ne: "बैंकमा राखियो", when: bs(cheque.depositedOn), tone: "done" });
  if (cheque.clearedOn) {
    const words = out ? { en: "Cashed by the supplier", ne: "Supplier ले साट्यो" } : { en: "The bank paid it", ne: "बैंकले पैसा दियो" };
    steps.push({ ...words, when: bs(cheque.clearedOn), tone: "done" });
  }
  if (cheque.bouncedOn) {
    const reason = bounceReasonWords(cheque.bounceReason);
    steps.push({ en: `Bounced — ${reason.en}`, ne: `फर्कियो — ${reason.ne}`, when: bs(cheque.bouncedOn), tone: "bad" });
    if (cheque.bankCharge > 0) {
      steps.push({ en: `Bank charge ${chequeRupees(cheque.bankCharge)}`, ne: `बैंकको शुल्क ${chequeRupees(cheque.bankCharge)}`, when: "", tone: "bad" });
    }
  }
  if (cheque.state === "recovered") steps.push({ en: "Money collected", ne: "पैसा उठ्यो", when: "", tone: "done" });
  if (cheque.state === "cancelled") steps.push({ en: "Cancelled", ne: "रद्द गरियो", when: "", tone: "done" });

  const stage = chequeStage(cheque, todayKey);
  if (stage === "hold") steps.push({ en: "Deposit on its date", ne: "मितिमा बैंकमा राख्ने", when: bs(cheque.chequeDate), tone: "next" });
  if (stage === "deposit") steps.push({ en: "Take it to the bank", ne: "बैंकमा लैजाने", when: bs(cheque.chequeDate), tone: "next" });
  if (stage === "in-bank") steps.push({ en: "The bank to pay — usually 1–3 days", ne: "बैंकले दिन बाँकी — प्रायः १–३ दिन", when: "", tone: "next" });
  if (stage === "cashable") {
    steps.push({ en: "Keep the money in the bank; the supplier may cash it from", ne: "बैंकमा पैसा राख्ने; Supplier ले साट्न सक्ने मिति", when: bs(cheque.chequeDate), tone: "next" });
  }
  if (cheque.state === "bounced") {
    const owed = chequeRupees(cheque.amount + cheque.bankCharge);
    const words = out ? { en: "Pay the supplier again", ne: "Supplier लाई फेरि तिर्ने" } : { en: `Collect ${owed}`, ne: `${owed} उठाउने` };
    steps.push({ ...words, when: "", tone: "next" });
  }

  return (
    <ol className="grid gap-0 pl-0">
      {steps.map((step, index) => (
        <li key={index} className="relative list-none pb-3 pl-8 last:pb-0">
          <span
            aria-hidden="true"
            className={`absolute left-1.5 top-1.5 h-4 w-4 rounded-full ${
              step.tone === "done" ? "bg-brand-green" : step.tone === "bad" ? "bg-brand-clay" : "border-2 border-amber-500 bg-brand-paper"
            }`}
          />
          {index < steps.length - 1 ? <span aria-hidden="true" className="absolute bottom-0 left-[13px] top-6 w-px bg-brand-green-line" /> : null}
          <b className="block text-base text-brand-green-ink">
            <T en={step.en} ne={step.ne} />
          </b>
          {step.when ? <span className="text-sm text-brand-muted">{step.when}</span> : null}
        </li>
      ))}
    </ol>
  );
}

function ChequeCard({
  cheque,
  todayKey,
  open,
  tab,
  canWrite,
}: {
  cheque: Cheque;
  todayKey: string;
  open: boolean;
  tab: Tab;
  canWrite: boolean;
}) {
  const out = cheque.direction === "out";
  const actions = canWrite ? allowedActions(cheque) : [];
  const href = `/admin/cheques?tab=${tab}&open=${cheque.id}#cq-${cheque.id}`;
  return (
    <article id={`cq-${cheque.id}`} className={`rounded-2xl border bg-brand-paper ${open ? "border-2 border-brand-green" : "border-brand-green-line"}`}>
      <Link href={open ? `/admin/cheques?tab=${tab}` : href} scroll={false} className="grid gap-1 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <span className="min-w-0">
          <span className="block text-lg font-black text-brand-green-ink">
            {out ? <T en="To: " ne="पाउने: " /> : null}
            {cheque.partyName || <T en="No name" ne="नाम छैन" />}
          </span>
          <span className="block text-base text-brand-muted">
            {cheque.bank || <T en="Bank not written" ne="बैंक लेखिएको छैन" />}
            {" · "}
            <T en="no." ne="नं." /> {cheque.chequeNo || "—"}
            {cheque.chequeDate ? (
              <>
                {" · "}
                <T en="dated" ne="मिति" /> {bs(cheque.chequeDate)}
              </>
            ) : null}
          </span>
        </span>
        <span className="flex items-center gap-3 sm:flex-col sm:items-end">
          <b className="font-display text-2xl text-brand-green-ink">{chequeRupees(cheque.amount)}</b>
          <StagePill cheque={cheque} todayKey={todayKey} />
        </span>
      </Link>

      {open ? (
        <div className="grid gap-4 border-t border-brand-green-line p-4">
          <p className="text-base text-brand-muted">
            {cheque.sourceNumber ? (
              <>
                {out ? <T en="Purchase" ne="खरिद" /> : <T en="Bill" ne="बिल" />} <b className="text-brand-green-ink">{cheque.sourceNumber}</b>
              </>
            ) : null}
            {cheque.nameOnCheque ? (
              <>
                {" · "}
                <T en="Name on cheque:" ne="चेकमा नाम:" /> <b className="text-brand-green-ink">{cheque.nameOnCheque}</b>
              </>
            ) : null}
            {cheque.partyPhone ? <> · 📞 {cheque.partyPhone}</> : null}
          </p>
          <Timeline cheque={cheque} todayKey={todayKey} />

          <div className="flex flex-wrap gap-2">
            {cheque.state !== "cancelled" ? <ChequeWhatsApp cheque={cheque} dateWords={bs(cheque.chequeDate)} /> : null}
            {cheque.partyPhone ? (
              <a href={`tel:${cheque.partyPhone.replace(/[^0-9+]/g, "")}`} className="inline-flex min-h-11 items-center rounded-xl border border-brand-green-line px-4 text-base font-black text-brand-green-ink">
                📞 <T en="Call" ne="फोन" />
              </a>
            ) : null}
          </div>

          {actions.filter((action) => action !== "bounce" && action !== "cancel").map((action) => (
            <form key={action} action={moveChequeAction} className="flex flex-wrap items-end gap-2 rounded-xl bg-brand-paper-deep p-3">
              <input type="hidden" name="id" value={cheque.id} />
              <input type="hidden" name="tab" value={tab} />
              <input type="hidden" name="action" value={action} />
              <label className="grid gap-1 text-sm font-bold text-brand-muted">
                <T en="On" ne="मिति" />
                <NepaliDateFieldUncontrolled name="on" defaultValue={todayKey} />
              </label>
              <button className="min-h-11 rounded-xl bg-brand-green-ink px-5 text-base font-black text-white">
                <T en={out ? ACTION_WORDS[action].outEn ?? ACTION_WORDS[action].en : ACTION_WORDS[action].en} ne={out ? ACTION_WORDS[action].outNe ?? ACTION_WORDS[action].ne : ACTION_WORDS[action].ne} />
              </button>
            </form>
          ))}

          {actions.includes("bounce") ? (
            <details className="rounded-xl border border-brand-clay/40 p-3">
              <summary className="cursor-pointer text-base font-black text-brand-clay">
                <T en={out ? "✕ It came back" : "✕ It bounced"} ne="✕ चेक फर्कियो" />
              </summary>
              <form action={moveChequeAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={cheque.id} />
                <input type="hidden" name="tab" value={tab} />
                <input type="hidden" name="action" value="bounce" />
                <label className="grid gap-1 text-sm font-bold text-brand-muted">
                  <T en="Why" ne="किन" />
                  <select name="reason" className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink">
                    {BOUNCE_REASONS.map((reason) => (
                      <option key={reason.id} value={reason.id}>
                        {reason.en} · {reason.ne}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-bold text-brand-muted">
                  <T en="Bank's charge (Rs.)" ne="बैंकको शुल्क (रु.)" />
                  <input name="bankCharge" inputMode="numeric" defaultValue="0" className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink" />
                </label>
                <label className="grid gap-1 text-sm font-bold text-brand-muted">
                  <T en="On" ne="मिति" />
                  <NepaliDateFieldUncontrolled name="on" defaultValue={todayKey} />
                </label>
                <button className="min-h-11 self-end rounded-xl bg-brand-clay px-5 text-base font-black text-white">
                  <T en="Save: bounced" ne="सेभ: फर्कियो" />
                </button>
              </form>
            </details>
          ) : null}

          {canWrite ? (
            <details className="rounded-xl border border-brand-green-line p-3">
              <summary className="cursor-pointer text-base font-black text-brand-green-ink">
                <T en="✎ Correct the details" ne="✎ विवरण मिलाउने" />
              </summary>
              <form action={editChequeAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={cheque.id} />
                <input type="hidden" name="tab" value={tab} />
                <label className="grid gap-1 text-sm font-bold text-brand-muted">
                  <T en="Bank" ne="बैंक" />
                  <input name="chequeBank" list="cheque-bank-list" defaultValue={cheque.bank} required className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink" />
                </label>
                <label className="grid gap-1 text-sm font-bold text-brand-muted">
                  <T en="Cheque no." ne="चेक नं." />
                  <input name="chequeNo" defaultValue={cheque.chequeNo} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink" />
                </label>
                <label className="grid gap-1 text-sm font-bold text-brand-muted">
                  <T en="Cheque date" ne="चेकको मिति" />
                  <NepaliDateFieldUncontrolled name="chequeDate" defaultValue={cheque.chequeDate} required />
                </label>
                <label className="grid gap-1 text-sm font-bold text-brand-muted">
                  <T en="Name on cheque" ne="चेकमा नाम" />
                  <input name="chequeName" defaultValue={cheque.nameOnCheque} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink" />
                </label>
                <label className="grid gap-1 text-sm font-bold text-brand-muted">
                  <T en="Mobile (for WhatsApp)" ne="मोबाइल (WhatsApp का लागि)" />
                  <input name="partyPhone" inputMode="tel" defaultValue={cheque.partyPhone} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink" />
                </label>
                <button className="min-h-11 self-end rounded-xl bg-brand-green-ink px-5 text-base font-black text-white">
                  <T en="Save" ne="सेभ" />
                </button>
              </form>
              {actions.includes("cancel") ? (
                <form action={moveChequeAction} className="mt-3 border-t border-brand-green-line pt-3">
                  <input type="hidden" name="id" value={cheque.id} />
                  <input type="hidden" name="tab" value={tab} />
                  <input type="hidden" name="action" value="cancel" />
                  <button className="min-h-11 rounded-xl border border-brand-clay/50 px-4 text-sm font-black text-brand-clay">
                    <T en={ACTION_WORDS.cancel.en} ne={ACTION_WORDS.cancel.ne} />
                  </button>
                  <span className="ml-2 text-sm text-brand-muted">
                    <T en="Torn, replaced or handed back — the bill itself is not changed." ne="च्यातिएको, फेरिएको वा फिर्ता दिइएको — बिल आफैँ बदलिँदैन।" />
                  </span>
                </form>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default async function ChequesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; open?: string; problem?: string }>;
}) {
  const { role } = await requireAdminPermission("pos:read");
  const params = (await searchParams) ?? {};
  const seesGiven = canAdmin(role, "purchasing:read");
  const tab: Tab = params.tab === "out" && seesGiven ? "out" : params.tab === "dates" ? "dates" : "in";
  const todayKey = nepalDayKey(new Date());
  const monthStartKey = bikramMonthRange(bikramMonthKeyOf(new Date()))?.startKey ?? todayKey.slice(0, 8) + "01";

  const ready = await chequeBookReady();
  const all = ready
    ? await getCheques().catch((error) => {
        reportError("read the cheque book", error);
        return [] as Cheque[];
      })
    : [];
  const cheques = seesGiven ? all : all.filter((cheque) => cheque.direction === "in");
  const totals = chequeTotals(cheques, monthStartKey);

  // Bills paid by cheque before the book: filled in once, here.
  const chequeBills = ready
    ? (await getPosInvoices().catch(() => [])).filter((invoice) => chequeAmount(invoice) > 0)
    : [];
  const missing = billsMissingDetails(chequeBills, all);
  // Taken with the amount only (owner, 2026-10-01): filled here, after.
  const toFill = canAdmin(role, "pos:write") ? all.filter(needsDetails) : [];
  const canWriteIn = canAdmin(role, "pos:write");
  const canWriteOut = canAdmin(role, "purchasing:write");

  const tabLink = (id: Tab, words: { en: string; ne: string }, count: number) => (
    <Link
      key={id}
      href={`/admin/cheques?tab=${id}`}
      className={`inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border px-4 text-base font-black ${
        tab === id ? "border-brand-green-ink bg-brand-green-ink text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"
      }`}
    >
      <T en={`${words.en} (${count})`} ne={`${words.ne} (${count})`} />
    </Link>
  );

  const listed = cheques
    .filter((cheque) => cheque.direction === (tab === "out" ? "out" : "in"))
    .sort((a, b) => {
      // Open ones first, nearest date first; the finished after, newest first.
      const openA = a.state === "waiting" || a.state === "deposited" || a.state === "bounced";
      const openB = b.state === "waiting" || b.state === "deposited" || b.state === "bounced";
      if (openA !== openB) return openA ? -1 : 1;
      if (openA) return (a.chequeDate || "9999").localeCompare(b.chequeDate || "9999");
      return b.createdAt.localeCompare(a.createdAt);
    });
  const calendar = chequeWeeks(cheques, todayKey);

  return (
    <section className="grid gap-5 p-4 text-base sm:p-6">
      <datalist id="cheque-bank-list">
        {NEPAL_BANKS.map((bank) => (
          <option key={bank} value={bank} />
        ))}
      </datalist>
      <div>
        <h1 className="font-display text-3xl font-black text-brand-green-ink sm:text-4xl">
          🏦 <T en="Cheques" ne="चेक खाता" />
        </h1>
        <p className="mt-1 max-w-3xl text-lg leading-7 text-brand-muted">
          <T
            en="Every cheque taken or given — whose, which bank, how much, when to deposit, and what the bank did."
            ne="लिएको र दिएको हरेक चेक — कसको, कुन बैंकको, कति, कहिले साट्ने, र बैंकले के गर्‍यो।"
          />
        </p>
      </div>

      {params.problem ? (
        <p role="alert" className="rounded-2xl border border-brand-clay/40 bg-brand-clay-tint px-4 py-3 text-base font-bold text-brand-clay">
          ⚠ {params.problem}
        </p>
      ) : null}

      {!ready ? (
        <div className="rounded-2xl border-2 border-brand-gold bg-brand-cream-soft p-5">
          <p className="text-lg font-black text-brand-green-ink">
            <T en="The cheque book needs one button first" ne="चेक खाता सुरु गर्न एउटा बटन थिच्नुपर्छ" />
          </p>
          <p className="mt-1 text-base text-brand-muted">
            <T
              en="Settings → “Prepare the database for the cheque book” → Preview → OK. Bills and purchases work as before until then."
              ne="Settings → “चेक खाताका लागि database तयार गर्ने” → पहिले हेर्ने → OK। त्यतिन्जेल बिल र खरिद पहिलेजस्तै चल्छन्।"
            />
          </p>
          {canAdmin(role, "settings:write") ? (
            <Link href="/admin/settings#cheques-database" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-brand-green-ink px-5 text-base font-black text-white">
              <T en="Open Settings →" ne="Settings खोल्ने →" />
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-cheque-totals>
            {[
              { en: "To deposit", ne: "साट्न बाँकी", value: totals.toDeposit, bar: "bg-amber-500" },
              { en: "In the bank", ne: "बैंकमा", value: totals.inBank, bar: "bg-sky-700" },
              { en: "Cleared this month", ne: "यो महिना पास", value: totals.clearedThisMonth, bar: "bg-brand-green" },
              { en: "Bounced, still owed", ne: "फर्किएको, उठ्न बाँकी", value: totals.bouncedOwed, bar: "bg-brand-clay" },
              ...(seesGiven ? [{ en: "Given, to be cashed", ne: "दिएको, साटिन बाँकी", value: totals.givenOpen, bar: "bg-violet-700" }] : []),
            ].map((tile) => (
              <div key={tile.en} className="relative overflow-hidden rounded-2xl border border-brand-green-line bg-brand-paper p-4 pl-5">
                <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${tile.bar}`} />
                <span className="block text-sm font-black text-brand-muted">
                  <T en={tile.en} ne={tile.ne} />
                </span>
                <b className="block font-display text-2xl text-brand-green-ink">{chequeRupees(tile.value.amount)}</b>
                <span className="text-sm text-brand-muted">
                  <T en={`${tile.value.count} cheque${tile.value.count === 1 ? "" : "s"}`} ne={`${tile.value.count} चेक`} />
                </span>
              </div>
            ))}
          </div>

          {toFill.length > 0 ? (
            <div id="to-fill" className="grid gap-3 rounded-2xl border-2 border-brand-gold bg-brand-cream-soft p-4">
              <p className="text-lg font-black text-brand-green-ink">
                <T
                  en={`✎ ${toFill.length} cheque${toFill.length === 1 ? "" : "s"} to fill — number, bank and date, so the reminders work`}
                  ne={`✎ ${toFill.length} चेकको विवरण भर्न बाँकी — नम्बर, बैंक र मिति, ताकि सम्झना आओस्`}
                />
              </p>
              {toFill.map((cheque) => (
                <form key={cheque.id} action={editChequeAction} className="grid gap-3 rounded-xl bg-brand-paper p-3 sm:grid-cols-2 lg:grid-cols-5">
                  <input type="hidden" name="id" value={cheque.id} />
                  <input type="hidden" name="tab" value="in" />
                  <input type="hidden" name="partyPhone" value={cheque.partyPhone} />
                  <p className="text-base text-brand-green-ink sm:col-span-2 lg:col-span-5">
                    <b>{cheque.partyName || "—"}</b> · <b>{chequeRupees(cheque.amount)}</b>
                    {cheque.sourceNumber ? <> · {cheque.sourceNumber}</> : null} · {bs(nepalDayKey(cheque.createdAt))}
                  </p>
                  <label className="grid gap-1 text-sm font-bold text-brand-muted">
                    <T en="Cheque no." ne="चेक नं." />
                    <input name="chequeNo" defaultValue={cheque.chequeNo} inputMode="numeric" className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink" />
                  </label>
                  <label className="grid gap-1 text-sm font-bold text-brand-muted">
                    <T en="Bank *" ne="बैंक *" />
                    <input name="chequeBank" list="cheque-bank-list" defaultValue={cheque.bank} required className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink" />
                  </label>
                  <label className="grid gap-1 text-sm font-bold text-brand-muted">
                    <T en="Cheque date *" ne="चेकको मिति *" />
                    <NepaliDateFieldUncontrolled name="chequeDate" defaultValue={cheque.chequeDate} required />
                  </label>
                  <label className="grid gap-1 text-sm font-bold text-brand-muted">
                    <T en="Name on cheque" ne="चेकमा नाम" />
                    <input name="chequeName" defaultValue={cheque.nameOnCheque || cheque.partyName} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink" />
                  </label>
                  <button className="min-h-11 self-end rounded-xl bg-brand-green-ink px-5 text-base font-black text-white">
                    <T en="Save details" ne="विवरण सेभ" />
                  </button>
                </form>
              ))}
            </div>
          ) : null}

          {missing.length > 0 && canWriteIn ? (
            <div className="grid gap-3 rounded-2xl border-2 border-brand-gold bg-brand-cream-soft p-4">
              <p className="text-lg font-black text-brand-green-ink">
                <T
                  en={`${missing.length} cheque bill${missing.length === 1 ? "" : "s"} from before — add the bank and date once`}
                  ne={`पहिलेका ${missing.length} चेक बिल — बैंक र मिति एकपटक भर्नुहोस्`}
                />
              </p>
              {missing.map((invoice) => (
                <form key={invoice.id} action={addBillChequeAction} className="grid gap-3 rounded-xl bg-brand-paper p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <p className="text-base text-brand-green-ink sm:col-span-2 lg:col-span-4">
                    <b>{invoice.invoiceNumber}</b> · {invoice.customerName || "—"} · <b>{chequeRupees(chequeAmount(invoice))}</b>
                    {invoice.paymentReference ? (
                      <>
                        {" · "}
                        <T en="cheque no." ne="चेक नं." /> {invoice.paymentReference}
                      </>
                    ) : null}
                  </p>
                  <label className="grid gap-1 text-sm font-bold text-brand-muted">
                    <T en="Bank *" ne="बैंक *" />
                    <input name="chequeBank" list="cheque-bank-list" required className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink" />
                  </label>
                  <label className="grid gap-1 text-sm font-bold text-brand-muted">
                    <T en="Cheque date *" ne="चेकको मिति *" />
                    <NepaliDateFieldUncontrolled name="chequeDate" defaultValue={nepalDayKey(invoice.createdAt)} required />
                  </label>
                  <label className="grid gap-1 text-sm font-bold text-brand-muted">
                    <T en="Name on cheque" ne="चेकमा नाम" />
                    <input name="chequeName" defaultValue={invoice.customerName} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink" />
                  </label>
                  <button className="min-h-11 self-end rounded-xl bg-brand-green-ink px-5 text-base font-black text-white">
                    <T en="Save to the book" ne="चेक खातामा राख्ने" />
                  </button>
                </form>
              ))}
            </div>
          ) : null}

          <nav className="flex flex-wrap gap-2" aria-label="Cheques">
            {tabLink("in", { en: "⬇ Taken", ne: "⬇ लिएको" }, cheques.filter((cheque) => cheque.direction === "in").length)}
            {seesGiven ? tabLink("out", { en: "⬆ Given", ne: "⬆ दिएको" }, cheques.filter((cheque) => cheque.direction === "out").length) : null}
            {tabLink("dates", { en: "📅 By date", ne: "📅 मितिअनुसार" }, calendar.earlier.length + calendar.weeks.reduce((sum, week) => sum + week.days.reduce((n, day) => n + day.cheques.length, 0), 0) + calendar.later.length)}
          </nav>

          {tab === "dates" ? (
            <div className="grid gap-4">
              {calendar.earlier.length > 0 ? (
                <div className="rounded-2xl border-2 border-amber-400 bg-brand-paper p-4">
                  <p className="text-lg font-black text-amber-900">
                    <T en="Date already passed — still open" ne="मिति नाघिसकेको — अझै बाँकी" />
                  </p>
                  <ul className="mt-2 grid gap-2 pl-0">
                    {calendar.earlier.map((cheque) => (
                      <DateRow key={cheque.id} cheque={cheque} />
                    ))}
                  </ul>
                </div>
              ) : null}
              {calendar.weeks.map((week) => (
                <div key={week.startKey} className="rounded-2xl border border-brand-green-line bg-brand-paper p-4">
                  <p className="flex flex-wrap items-baseline justify-between gap-2 text-lg font-black text-brand-green-ink">
                    <span>
                      <T en="Week from" ne="हप्ता" /> {bs(week.startKey)}
                    </span>
                    <span className="text-base">
                      <span className="text-brand-green">⬇ {chequeRupees(week.inAmount)}</span>
                      {seesGiven ? <span className="ml-3 text-violet-800">⬆ {chequeRupees(week.outAmount)}</span> : null}
                    </span>
                  </p>
                  {week.days.length === 0 ? (
                    <p className="text-base text-brand-muted">
                      <T en="No cheque dated this week." ne="यो हप्ता कुनै चेकको मिति छैन।" />
                    </p>
                  ) : (
                    <ul className="mt-2 grid gap-2 pl-0">
                      {week.days.flatMap((day) => day.cheques).map((cheque) => (
                        <DateRow key={cheque.id} cheque={cheque} />
                      ))}
                    </ul>
                  )}
                  {seesGiven && week.outAmount > 0 ? (
                    <p className="mt-2 rounded-xl bg-violet-100 px-3 py-2 text-base font-bold text-violet-900">
                      🏦{" "}
                      <T
                        en={`Keep ${chequeRupees(week.outAmount)} in the bank for the cheques given this week.`}
                        ne={`यो हप्ता दिएका चेकका लागि बैंकमा ${chequeRupees(week.outAmount)} राख्नुहोस्।`}
                      />
                    </p>
                  ) : null}
                </div>
              ))}
              {calendar.later.length > 0 ? (
                <p className="text-base text-brand-muted">
                  <T en={`${calendar.later.length} more dated later.`} ne={`अझ पछिका ${calendar.later.length} चेक।`} />
                </p>
              ) : null}
            </div>
          ) : listed.length === 0 ? (
            <p className="rounded-2xl border border-brand-green-line bg-brand-paper px-4 py-8 text-center text-lg text-brand-muted">
              {tab === "out" ? (
                <T en="No cheque given yet. Pay a purchase bill by cheque and it appears here." ne="अहिलेसम्म कुनै चेक दिइएको छैन। खरिद बिल चेकबाट तिर्दा यहाँ आउँछ।" />
              ) : (
                <T en="No cheque taken yet. Cut a bill paid by cheque and it appears here." ne="अहिलेसम्म कुनै चेक लिइएको छैन। चेकबाट बिल काट्दा यहाँ आउँछ।" />
              )}
            </p>
          ) : (
            <div className="grid gap-3">
              {listed.map((cheque) => (
                <ChequeCard
                  key={cheque.id}
                  cheque={cheque}
                  todayKey={todayKey}
                  open={params.open === cheque.id}
                  tab={tab}
                  canWrite={cheque.direction === "in" ? canWriteIn : canWriteOut}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** A line of the "by date" view, opening the cheque in its own list. */
function DateRow({ cheque }: { cheque: Cheque }) {
  const out = cheque.direction === "out";
  return (
    <li className="list-none">
      <Link
        href={`/admin/cheques?tab=${out ? "out" : "in"}&open=${cheque.id}#cq-${cheque.id}`}
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-base ${out ? "bg-violet-50" : "bg-brand-green-wash"}`}
      >
        <span className="min-w-0">
          <b className={out ? "text-violet-800" : "text-brand-green"}>{out ? "⬆" : "⬇"}</b> <b className="text-brand-green-ink">{bs(cheque.chequeDate)}</b>{" "}
          · {cheque.partyName || "—"} · {cheque.bank || "—"}
        </span>
        <b className="text-brand-green-ink">{chequeRupees(cheque.amount)}</b>
      </Link>
    </li>
  );
}
