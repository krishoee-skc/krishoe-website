"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import T from "@/components/T";
import { useLanguage } from "@/components/LanguageProvider";
import EnterWalkForm from "@/components/admin/EnterWalkForm";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import ChequeFields, { type ChequeDetails } from "@/components/admin/ChequeFields";
import PrintButton from "@/components/admin/PrintButton";
import { Amount, AmountsToggle, PageHead } from "@/components/admin/PageKit";
import { recordDrawerAction, recordMoneyInAction, recordMoneyOutAction } from "@/app/admin/transactions/actions";
import { drawerCheck } from "@/lib/cash-days-rules";
import {
  cashInByBusiness,
  dayBookTotals,
  linesOfBusiness,
  type DayBookBusiness,
  type DayBookFilter,
  type DayBookRow,
} from "@/lib/day-book-rules";
import type { PartyRow } from "@/lib/day-book";
import { money } from "@/lib/format-money";
import { whatsappNumber } from "@/lib/phone-intl";
import { readSavedMessage } from "@/lib/saved-message";
import { VOUCHER_EVENT } from "@/app/admin/transactions/voucher-keys";

export type HubView = "sale" | "buy" | "in" | "out";

type May = {
  sale: boolean;
  purchase: boolean;
  moneyIn: boolean;
  moneyOut: boolean;
  wages: boolean;
  customerLedger: boolean;
  supplierLedger: boolean;
  reports: boolean;
};

type Props = {
  initialView: HubView;
  initialTab: "book" | "parties";
  day: string;
  dayBs: string;
  today: string;
  previousDay: string;
  nextDay: string;
  rows: DayBookRow[] | null;
  parties: PartyRow[];
  saved: string;
  said: string;
  /** The message came from the drawer check, not a money form. */
  drawerMessage: boolean;
  may: May;
  /** The factory and the shop are two businesses: each line says whose (owner, 2026-10-31). */
  twoBusiness?: boolean;
  /** The drawer's morning cash and evening count. */
  drawer: Drawer;
  /** The cheque book, for a cheque taken in Money in. */
  cheque: { ready: boolean; usedBanks: string[]; todayKey: string };
};

const inputClass =
  "h-11 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base outline-none focus:border-brand-green";
const labelClass = "grid gap-1 text-sm font-bold text-brand-green-ink";

const NEPAL_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit", hour12: false });

const TAG: Record<DayBookRow["area"], string> = {
  pos: "bg-brand-green-wash text-brand-green",
  purchase: "bg-brand-clay-tint text-brand-clay",
  customer: "bg-brand-purple/10 text-brand-purple dark:bg-violet-300/10 dark:text-[#C7A8EE]",
  supplier: "bg-brand-cream-soft text-brand-gold-ink",
  wages: "bg-brand-cream-soft text-brand-gold-ink",
  transfer: "bg-[#EAF1F8] text-[#2F5C8A]",
};

/** Whose line, as a small tag (owner, 2026-10-31, two businesses). */
function BusinessTag({ r }: { r: DayBookRow }) {
  const { text } = useLanguage();
  const [label, title, tone] =
    r.area === "transfer"
      ? ["🛒→🏭", text("Shop to factory", "पसलबाट कारखानामा"), "bg-brand-cream-soft text-brand-gold-ink"]
      : r.factoryShare >= 1
        ? ["🏭", text("Factory", "कारखाना"), "bg-[#EAF1F8] text-[#2F5C8A]"]
        : r.factoryShare <= 0
          ? ["🛒", text("Shop", "पसल"), "bg-brand-green-wash text-brand-green"]
          : ["🏭+🛒", text("Both", "दुवै"), "bg-brand-cream-soft text-brand-gold-ink"];
  return (
    <span title={title} className={`mr-1 inline-block whitespace-nowrap rounded-full px-1.5 text-xs font-black ${tone}`}>
      {label}
    </span>
  );
}

const FILTERS: Array<{ key: "all" | DayBookFilter; en: string; ne: string }> = [
  { key: "all", en: "All", ne: "सबै" },
  { key: "sale", en: "Sales", ne: "बिक्री" },
  { key: "purchase", en: "Purchases", ne: "खरिद" },
  { key: "in", en: "In", ne: "आयो" },
  { key: "out", en: "Out", ne: "गयो" },
  { key: "cheque", en: "Cheques", ne: "चेक" },
];

const METHOD_WORDS: Record<string, { en: string; ne: string }> = {
  "Cash Payment": { en: "Cash", ne: "नगद" },
  "Cheque Payment": { en: "Cheque", ne: "चेक" },
  "Bank Payment": { en: "Bank", ne: "बैंक" },
  "QR Payment": { en: "QR", ne: "QR" },
};

function rupees(value: number) {
  return value.toLocaleString("en-IN");
}

/** One way of paying, as a pressable chip; a "soon" one shows but cannot be chosen. */
function MethodChips({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: Array<{ value: string; en: string; ne: string; soon?: boolean }>;
  value: string;
  onChange: (next: string) => void;
}) {
  const { text } = useLanguage();
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5">
      {options.map((option) =>
        option.soon ? (
          <span
            key={option.value}
            className="inline-flex min-h-10 items-center rounded-xl border border-dashed border-brand-green-line px-3 text-sm font-black text-brand-muted opacity-70"
          >
            {text(option.en, option.ne)} · {text("soon", "छिट्टै")}
          </span>
        ) : (
          <label
            key={option.value}
            className={`inline-flex min-h-10 cursor-pointer items-center rounded-xl border px-3 text-sm font-black has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-gold ${
              value === option.value
                ? "border-brand-green bg-brand-green-wash text-brand-green"
                : "border-brand-green-line bg-brand-paper text-brand-green-ink"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {text(option.en, option.ne)}
          </label>
        ),
      )}
    </div>
  );
}

function Banner({ raw, refused }: { raw: string; refused: boolean }) {
  if (!raw) return null;
  const words = readSavedMessage(raw);
  return (
    <p
      role={refused ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm font-bold ${
        refused ? "border-brand-clay/40 bg-brand-clay-tint text-brand-clay" : "border-brand-green-line bg-brand-green-wash text-brand-green-ink"
      }`}
    >
      {refused && !words.en.startsWith("✕") ? "✕ " : ""}
      <T en={words.en} ne={words.ne} />
    </p>
  );
}

/**
 * Who pays or is paid, the amount filled to what is owed until typed over —
 * the same as the supplier's form and the customer's account — and what the
 * account will owe once it is saved.
 */
function AccountPayment({
  parties,
  chosen,
  onChoose,
  pickLabel,
  dueLabel,
  amount,
  setAmount,
  touched,
  setTouched,
  idName,
}: {
  parties: PartyRow[];
  chosen: string;
  onChoose: (id: string) => void;
  pickLabel: { en: string; ne: string };
  dueLabel: { en: string; ne: string };
  amount: string;
  setAmount: (value: string) => void;
  touched: boolean;
  setTouched: (value: boolean) => void;
  idName: string;
}) {
  const { text } = useLanguage();
  const [find, setFind] = useState("");
  const shown = useMemo(() => {
    const words = find.trim().toLowerCase();
    if (!words) return parties;
    const digits = words.replace(/\D/g, "");
    // The one already chosen stays in the list, so typing more never un-chooses it.
    return parties.filter(
      (party) => party.id === chosen || party.name.toLowerCase().includes(words) || (digits !== "" && party.phone.replace(/\D/g, "").includes(digits)),
    );
  }, [find, parties, chosen]);
  const party = parties.find((p) => p.id === chosen);
  const typed = Math.max(0, Math.round(Number(amount) || 0));

  return (
    <>
      <label className={labelClass}>
        {text(pickLabel.en, pickLabel.ne)}
        <input
          type="search"
          value={find}
          onChange={(event) => setFind(event.target.value)}
          placeholder={text("Name or phone", "नाम वा फोन")}
          aria-label={text("Find by name or phone", "नाम वा फोनले खोज्ने")}
          className={inputClass}
          enterKeyHint="next"
        />
        <select
          name={idName}
          required
          value={chosen}
          onChange={(event) => onChoose(event.target.value)}
          aria-label={text(pickLabel.en, pickLabel.ne)}
          data-summary="text"
          className={inputClass}
        >
          <option value="">{text(`Choose (${shown.length})`, `छान्नुहोस् (${shown.length})`)}</option>
          {shown.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.phone ? ` · ${p.phone}` : ""} — {money(p.due)}
            </option>
          ))}
        </select>
      </label>
      {party ? (
        <p className="flex flex-wrap justify-between gap-2 rounded-xl px-3 py-2 text-sm font-black bg-brand-purple/10 text-brand-purple dark:bg-violet-300/10 dark:text-[#C7A8EE]">
          <span>
            {text(dueLabel.en, dueLabel.ne)}: {money(party.due)}
          </span>
          {typed > 0 ? (
            <span className={typed > party.due ? "text-brand-clay" : undefined}>
              {typed > party.due
                ? text(`More than is owed by ${money(typed - party.due)}`, `बाँकीभन्दा ${money(typed - party.due)} बढी`)
                : text(`After: ${money(party.due - typed)}`, `पछि: ${money(party.due - typed)}`)}
            </span>
          ) : null}
        </p>
      ) : null}
      <label className={labelClass}>
        {text("Amount (Rs.)", "कति रुपैयाँ")}
        <input
          name="amount"
          type="number"
          inputMode="numeric"
          min="1"
          required
          value={amount}
          onChange={(event) => {
            setTouched(true);
            setAmount(event.target.value);
          }}
          data-summary="money"
          className={inputClass}
        />
      </label>
      {party && !touched && amount ? (
        <p className="-mt-1 text-xs font-semibold text-brand-muted">
          {text("Full due filled — edit for a part payment.", "पूरा बाँकी भरिएको — थोरै भए फेर्नुहोस्।")}
        </p>
      ) : null}
    </>
  );
}

type ChequeBook = { ready: boolean; usedBanks: string[]; todayKey: string };

function MoneyInForm({ parties, raw, refused, presetId, cheque }: { parties: PartyRow[]; raw: string; refused: boolean; presetId: string; cheque: ChequeBook }) {
  const { text } = useLanguage();
  const owing = useMemo(() => parties.filter((p) => p.side === "customer" && p.due > 0), [parties]);
  const preset = owing.find((p) => p.id === presetId);
  const [chosen, setChosen] = useState(preset?.id ?? "");
  const [amount, setAmount] = useState(preset ? String(preset.due) : "");
  const [touched, setTouched] = useState(false);
  const [type, setType] = useState("Cash Payment");
  const [details, setDetails] = useState<ChequeDetails>({ bank: "", date: "", name: "" });

  function choose(id: string) {
    setChosen(id);
    if (!touched) {
      const due = owing.find((p) => p.id === id)?.due ?? 0;
      setAmount(due > 0 ? String(due) : "");
    }
  }

  return (
    <EnterWalkForm action={recordMoneyInAction} oncePerPress className="grid gap-3">
      <h2 className="text-lg font-black text-brand-green-ink">
        <T en="Money in" ne="पैसा आयो" />
        <span className="ml-2 text-sm font-semibold text-brand-muted">
          <T en="a customer paid what they owed" ne="ग्राहकले उधारो तिर्‍यो" />
        </span>
      </h2>
      <Banner raw={raw} refused={refused} />
      {owing.length === 0 ? (
        <p className="rounded-xl border border-brand-green-line bg-brand-paper-deep p-4 text-sm font-semibold text-brand-muted">
          <T en="No customer owes the shop right now." ne="अहिले कुनै ग्राहकको उधारो बाँकी छैन।" />
        </p>
      ) : (
        <>
          <AccountPayment
            parties={owing}
            chosen={chosen}
            onChoose={choose}
            pickLabel={{ en: "Who paid", ne: "कसले तिर्‍यो" }}
            dueLabel={{ en: "Owes now", ne: "अहिले बाँकी" }}
            amount={amount}
            setAmount={setAmount}
            touched={touched}
            setTouched={setTouched}
            idName="ledgerId"
          />
          <div className={labelClass}>
            {text("How", "कसरी")}
            <MethodChips
              name="type"
              value={type}
              onChange={setType}
              options={[
                { value: "Cash Payment", en: "Cash", ne: "नगद" },
                { value: "Cheque Payment", en: "Cheque", ne: "चेक" },
                { value: "QR", en: "QR", ne: "QR", soon: true },
              ]}
            />
          </div>
          {/* A cheque goes into the cheque book too (2026-10-29): its bank and
              date, as a purchase asks, so it is deposited and a bounce noticed. */}
          {type === "Cheque Payment" && cheque.ready ? (
            <div className="grid gap-3 rounded-2xl border border-brand-green-line bg-brand-paper-deep p-3">
              <ChequeFields
                direction="in"
                value={details}
                onChange={setDetails}
                usedBanks={cheque.usedBanks}
                todayKey={cheque.todayKey}
                inputClass={inputClass}
              />
              <label className={labelClass}>
                {text("Cheque no.", "चेक नं.")}
                <input name="chequeNo" inputMode="numeric" autoComplete="off" className={inputClass} />
              </label>
              <input type="hidden" name="partyPhone" value={owing.find((p) => p.id === chosen)?.phone ?? ""} />
            </div>
          ) : null}
          <label className={labelClass}>
            {text("Note", "टिपोट")}
            <input
              name="note"
              placeholder={
                type === "Cheque Payment"
                  ? cheque.ready
                    ? text("Remark", "टिपोट")
                    : text("Bank and cheque no.", "बैंक र चेक नं.")
                  : text("Voucher, reference or remark", "भौचर, नम्बर वा टिपोट")
              }
              className={inputClass}
            />
          </label>
          <FormSubmitButton
            pendingLabel={text("Recording…", "टिप्दै…")}
            className="min-h-12 rounded-full bg-brand-green px-5 text-base font-black text-white transition hover:bg-brand-green-ink disabled:opacity-60"
          >
            {/* The way it was paid, on the button pressed — what is saved is what is read. */}
            <T en="Record money in" ne="पैसा आयो टिप्ने" /> · {type === "Cheque Payment" ? text("Cheque", "चेक") : text("Cash", "नगद")}
          </FormSubmitButton>
        </>
      )}
    </EnterWalkForm>
  );
}

function MoneyOutForm({ parties, raw, refused, may, presetId }: { parties: PartyRow[]; raw: string; refused: boolean; may: May; presetId: string }) {
  const { text } = useLanguage();
  const owed = useMemo(() => parties.filter((p) => p.side === "supplier" && p.due > 0), [parties]);
  const preset = owed.find((p) => p.id === presetId);
  const [chosen, setChosen] = useState(preset?.id ?? "");
  const [amount, setAmount] = useState(preset ? String(preset.due) : "");
  const [touched, setTouched] = useState(false);
  const [type, setType] = useState("Cash Payment");

  function choose(id: string) {
    setChosen(id);
    if (!touched) {
      const due = owed.find((p) => p.id === id)?.due ?? 0;
      setAmount(due > 0 ? String(due) : "");
    }
  }

  return (
    <div className="grid gap-3">
      <h2 className="text-lg font-black text-brand-green-ink">
        <T en="Money out" ne="पैसा गयो" />
        <span className="ml-2 text-sm font-semibold text-brand-muted">
          <T en="the shop paid someone" ne="पसलले कसैलाई तिर्‍यो" />
        </span>
      </h2>
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex min-h-10 items-center rounded-xl border border-brand-green bg-brand-green-wash px-3 text-sm font-black text-brand-green">
          <T en="Supplier" ne="साहु" />
        </span>
        {may.wages ? (
          <Link
            href="/admin/operations/production-accounts/payments"
            className="inline-flex min-h-10 items-center rounded-xl border border-brand-green-line bg-brand-paper px-3 text-sm font-black text-brand-green-ink hover:border-brand-green"
          >
            <T en="Worker wages & kharcha →" ne="कामदारको ज्याला र खर्च →" />
          </Link>
        ) : null}
      </div>
      <Banner raw={raw} refused={refused} />
      {!may.moneyOut ? (
        <p className="rounded-xl border border-brand-green-line bg-brand-paper-deep p-4 text-sm font-semibold text-brand-muted">
          <T en="Paying a supplier is for staff who may buy." ne="साहुलाई तिर्ने काम किनमेल गर्न पाउने staff को हो।" />
        </p>
      ) : owed.length === 0 ? (
        <p className="rounded-xl border border-brand-green-line bg-brand-paper-deep p-4 text-sm font-semibold text-brand-muted">
          <T en="No supplier is owed anything." ne="कुनै साहुलाई तिर्न बाँकी छैन।" />
        </p>
      ) : (
        <EnterWalkForm action={recordMoneyOutAction} oncePerPress className="grid gap-3">
          <AccountPayment
            parties={owed}
            chosen={chosen}
            onChoose={choose}
            pickLabel={{ en: "Supplier", ne: "साहु" }}
            dueLabel={{ en: "To pay", ne: "तिर्न बाँकी" }}
            amount={amount}
            setAmount={setAmount}
            touched={touched}
            setTouched={setTouched}
            idName="supplierLedgerId"
          />
          <div className={labelClass}>
            {text("How", "कसरी")}
            <MethodChips
              name="type"
              value={type}
              onChange={setType}
              options={[
                { value: "Cash Payment", en: "Cash", ne: "नगद" },
                { value: "Cheque Payment", en: "Cheque", ne: "चेक" },
                { value: "Bank Payment", en: "Bank", ne: "बैंक" },
                { value: "QR Payment", en: "QR", ne: "QR" },
              ]}
            />
          </div>
          <label className={labelClass}>
            {text("Note", "टिपोट")}
            <input
              name="note"
              placeholder={text("Voucher, cheque, bank reference or remark", "भौचर, चेक नं., बैंकको नम्बर वा टिपोट")}
              className={inputClass}
            />
          </label>
          <FormSubmitButton
            pendingLabel={text("Recording…", "टिप्दै…")}
            className="min-h-12 rounded-full bg-brand-green px-5 text-base font-black text-white transition hover:bg-brand-green-ink disabled:opacity-60"
          >
            <T en="Record money out" ne="पैसा गयो टिप्ने" /> · {METHOD_WORDS[type] ? text(METHOD_WORDS[type].en, METHOD_WORDS[type].ne) : type}
          </FormSubmitButton>
        </EnterWalkForm>
      )}
    </div>
  );
}

function downloadCsv(rows: DayBookRow[], day: string) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    ["Time", "What", "Ref", "Who", "How", "In", "Out", "Due", "Bounced"],
    ...rows.map((r) => [NEPAL_TIME.format(new Date(r.at)), r.en, r.ref, r.party, r.method, r.moneyIn, r.moneyOut, r.due, r.bounced ? "yes" : ""]),
  ];
  const blob = new Blob(["﻿" + lines.map((line) => line.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `krishoe-day-book-${day}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}


type Drawer = {
  ready: boolean;
  opening: number | null;
  counted: number | null;
  mayWrite: boolean;
  mayPrepare: boolean;
  /** A message the drawer's own forms left. */
  saved: string;
  said: string;
};

/**
 * The drawer check (owner, 2026-10-29): the morning's cash, the day's cash in
 * and out, what should be in the drawer, the evening's count, and the
 * difference. The counter bills' cash is shown apart — the figure the POS
 * cashier close counts — so the two can be read side by side.
 */
function DrawerCheck({
  drawer,
  day,
  cashIn,
  cashOut,
  rows,
  twoBusiness = false,
}: {
  drawer: Drawer;
  day: string;
  cashIn: number;
  cashOut: number;
  rows: DayBookRow[];
  twoBusiness?: boolean;
}) {
  const { text } = useLanguage();
  if (!drawer.ready) {
    return drawer.mayPrepare ? (
      <p className="rounded-2xl border border-dashed border-brand-gold/60 bg-brand-cream-soft px-4 py-3 text-sm font-bold text-brand-gold-ink print:hidden">
        💵 {text("To keep the morning's cash and the evening count, press OK once in Settings.", "बिहानको नगद र साँझको गन्ती राख्न Settings मा एक पटक OK थिच्नुहोस्।")}{" "}
        <Link href="/admin/settings#cash-days-database" className="underline underline-offset-4">
          {text("Open Settings →", "Settings खोल्ने →")}
        </Link>
      </p>
    ) : null;
  }
  const check = drawerCheck(drawer.opening, cashIn, cashOut, drawer.counted);
  const byBusiness = cashInByBusiness(rows);
  const posCash = rows.filter((r) => r.area === "pos").reduce((sum, r) => sum + r.cashIn - r.cashOut, 0);
  const otherCash = cashIn - cashOut - posCash;
  const line = "flex flex-wrap items-baseline justify-between gap-2 py-1.5";
  const form = (field: "opening" | "counted", label: { en: string; ne: string }, value: number | null) =>
    drawer.mayWrite ? (
      <EnterWalkForm action={recordDrawerAction} oncePerPress className="flex flex-wrap items-center gap-1.5 print:hidden">
        <input type="hidden" name="day" value={day} />
        <input type="hidden" name="field" value={field} />
        <input
          name="amount"
          type="number"
          inputMode="numeric"
          min="0"
          required
          defaultValue={value ?? ""}
          aria-label={text(label.en, label.ne)}
          placeholder={text("Rs.", "रु.")}
          className="h-10 w-32 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base outline-none focus:border-brand-green"
        />
        <FormSubmitButton
          pendingLabel={text("Saving…", "राख्दै…")}
          className="min-h-10 rounded-full border border-brand-green bg-brand-green-wash px-3 text-sm font-black text-brand-green disabled:opacity-60"
        >
          {value == null ? text("Write", "टिप्ने") : text("Change", "बदल्ने")}
        </FormSubmitButton>
      </EnterWalkForm>
    ) : null;
  const differenceTone =
    check.difference == null ? "text-brand-muted" : check.difference === 0 ? "text-brand-green" : "text-brand-clay";

  return (
    <div className="grid gap-1 rounded-2xl border border-brand-green-line bg-brand-paper px-4 py-3">
      <h3 className="text-base font-black text-brand-green-ink">💵 {text("Drawer check", "गल्ला मिलान")}</h3>
      <Banner raw={drawer.saved || drawer.said} refused={Boolean(drawer.said)} />
      <div className={line}>
        <span className="font-bold text-brand-green-ink">{text("Morning cash", "बिहानको नगद")}</span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-black tabular-nums">{drawer.opening == null ? text("not written", "टिपिएको छैन") : <Amount>{money(drawer.opening)}</Amount>}</span>
          {form("opening", { en: "Morning cash", ne: "बिहानको नगद" }, drawer.opening)}
        </span>
      </div>
      <div className={`${line} text-sm`}>
        <span className="text-brand-muted">{text("+ cash in today", "+ आज आएको नगद")}</span>
        <span className="font-black tabular-nums text-brand-green"><Amount>{money(cashIn)}</Amount></span>
      </div>
      {twoBusiness && cashIn > 0 ? (
        // One drawer (choice 3(क)): the cash in it, shown by whose it is.
        <p className="-mt-1 pl-3 text-xs font-bold text-brand-muted">
          🛒 {text("Shop", "पसल")} <Amount>{money(byBusiness.shop)}</Amount> · 🏭 {text("Factory", "कारखाना")} <Amount>{money(byBusiness.factory)}</Amount>
        </p>
      ) : null}
      <div className={`${line} text-sm`}>
        <span className="text-brand-muted">{text("− cash out today", "− आज गएको नगद")}</span>
        <span className="font-black tabular-nums text-brand-clay"><Amount>{money(cashOut)}</Amount></span>
      </div>
      <div className={`${line} border-t border-brand-green-line`}>
        <span className="font-black text-brand-green-ink">{text("Should be in the drawer", "गल्लामा हुनुपर्ने")}</span>
        <span className="font-display text-xl font-black tabular-nums">
          {check.expected == null ? (
            <span className="text-sm text-brand-muted">{text("write the morning cash first", "पहिले बिहानको नगद टिप्नुहोस्")}</span>
          ) : (
            <Amount>{money(check.expected)}</Amount>
          )}
        </span>
      </div>
      <div className={line}>
        <span className="font-bold text-brand-green-ink">{text("Counted at close", "साँझ गनेको")}</span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-black tabular-nums">{drawer.counted == null ? text("not written", "टिपिएको छैन") : <Amount>{money(drawer.counted)}</Amount>}</span>
          {form("counted", { en: "Counted at close", ne: "साँझ गनेको" }, drawer.counted)}
        </span>
      </div>
      {check.difference != null ? (
        <p
          role="status"
          className={`rounded-xl px-3 py-2 text-sm font-black ${differenceTone} ${check.difference === 0 ? "bg-brand-green-wash" : "bg-brand-clay-tint"}`}
        >
          {check.difference === 0 ? (
            text("✓ The drawer agrees with the books.", "✓ गल्ला हिसाबसँग मिल्यो।")
          ) : check.difference < 0 ? (
            <>
              {text("Short by", "कम छ:")} <Amount>{money(-check.difference)}</Amount>
            </>
          ) : (
            <>
              {text("More than the books by", "हिसाबभन्दा बढी:")} <Amount>{money(check.difference)}</Amount>
            </>
          )}
        </p>
      ) : null}
      <p className="text-xs font-semibold text-brand-muted">
        {text("Of today's cash: counter bills (the POS cashier close)", "आजको नगदमध्ये: बिल काटेको (POS को Cashier close)")} <Amount>{money(posCash)}</Amount>
        {" · "}
        {text("everything else", "अरू सबै")} <Amount>{money(otherCash)}</Amount>
      </p>
    </div>
  );
}

function DayBook({
  rows,
  day,
  dayBs,
  today,
  previousDay,
  nextDay,
  may,
  drawer,
  twoBusiness = false,
}: Pick<Props, "rows" | "day" | "dayBs" | "today" | "previousDay" | "nextDay" | "may" | "drawer" | "twoBusiness">) {
  const { text } = useLanguage();
  const [filter, setFilter] = useState<"all" | DayBookFilter>("all");
  // Whose lines (owner, 2026-10-31): all, the factory's or the shop's — each
  // line at its share of the money, so the totals are that business's.
  const [business, setBusiness] = useState<"all" | DayBookBusiness>("all");
  const everything = useMemo(() => rows ?? [], [rows]);
  const all = useMemo(
    () => (twoBusiness && business !== "all" ? linesOfBusiness(everything, business) : everything),
    [everything, business, twoBusiness],
  );
  const totals = useMemo(() => dayBookTotals(all), [all]);
  const shown = filter === "all" ? all : all.filter((r) => r.filters.includes(filter));
  const isToday = day === today;
  const navClass = "inline-flex min-h-10 items-center rounded-full border border-brand-green-line bg-brand-paper px-3 text-sm font-black text-brand-green-ink hover:border-brand-green";

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-brand-green-ink">
          <T en="Day Book" ne="दैनिक कारोबार" />
          <span className="ml-2 text-sm font-semibold text-brand-muted">
            {isToday ? text("today", "आज") : ""} {dayBs} · {day}
          </span>
        </h2>
        <div className="flex flex-wrap gap-1.5 print:hidden">
          <Link href={`/admin/transactions?tab=book&day=${previousDay}`} className={navClass} prefetch={false}>
            ◀ <T en="Day before" ne="अघिल्लो दिन" />
          </Link>
          {nextDay ? (
            <Link href={`/admin/transactions?tab=book&day=${nextDay}`} className={navClass} prefetch={false}>
              <T en="Next day" ne="पछिल्लो दिन" /> ▶
            </Link>
          ) : null}
          {!isToday ? (
            <Link href="/admin/transactions?tab=book" className={navClass} prefetch={false}>
              <T en="Today" ne="आज" />
            </Link>
          ) : null}
        </div>
      </div>

      {rows === null ? (
        <p className="rounded-xl border border-brand-green-line bg-brand-paper-deep p-4 text-sm font-semibold text-brand-muted">
          <T en="The Day Book reads the shop's database; this copy of the app has none." ne="Day Book ले database पढ्छ; यो app मा database छैन।" />
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { en: "Cash today (in − out)", ne: "आजको नगद (आयो − गयो)", value: totals.cashNet },
              { en: "Money in", ne: "पैसा आयो", value: totals.moneyIn },
              { en: "Money out", ne: "पैसा गयो", value: totals.moneyOut },
            ].map((tile) => (
              <div key={tile.en} className="grid min-w-0 content-start gap-0.5 rounded-2xl border border-brand-green-line bg-brand-paper px-3 py-2">
                <span className="truncate font-display text-lg font-black tabular-nums text-brand-green-ink sm:text-2xl">
                  <Amount>{money(tile.value)}</Amount>
                </span>
                <span className="text-xs font-bold leading-tight text-brand-muted">{text(tile.en, tile.ne)}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AmountsToggle />
            {totals.due > 0 ? (
              <span className="text-xs font-bold text-brand-muted">
                {text("Credit on the day's lines is shown, not counted as money.", "उधारो देखाइएको छ, पैसामा गनिएको छैन।")}
              </span>
            ) : null}
          </div>

          {/* One drawer for both (choice 3(क)): always the whole day's cash. */}
          <DrawerCheck
            drawer={drawer}
            day={day}
            cashIn={dayBookTotals(everything).cashIn}
            cashOut={dayBookTotals(everything).cashOut}
            rows={everything}
            twoBusiness={twoBusiness}
          />

          {twoBusiness ? (
            <div role="group" aria-label={text("Whose lines", "कसको कारोबार")} className="flex flex-wrap gap-1.5 print:hidden">
              {([
                { key: "all", en: "All", ne: "सबै" },
                { key: "factory", en: "🏭 Factory", ne: "🏭 कारखाना" },
                { key: "shop", en: "🛒 Shop", ne: "🛒 पसल" },
              ] as const).map((b) => (
                <button
                  key={b.key}
                  type="button"
                  aria-pressed={business === b.key}
                  onClick={() => setBusiness(b.key)}
                  className={`min-h-10 rounded-xl border px-4 text-sm font-black ${
                    business === b.key ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"
                  }`}
                >
                  {text(b.en, b.ne)}
                </button>
              ))}
            </div>
          ) : null}

          <div role="group" aria-label={text("Show only", "मात्र देखाउने")} className="flex flex-wrap gap-1.5 print:hidden">
            {FILTERS.map((f) => {
              const count = f.key === "all" ? all.length : all.filter((r) => r.filters.includes(f.key as DayBookFilter)).length;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`min-h-9 rounded-full border px-3 text-xs font-black ${
                    filter === f.key ? "border-brand-green-ink bg-brand-green-ink text-white" : "border-brand-green-line bg-brand-paper text-brand-muted"
                  }`}
                >
                  {text(f.en, f.ne)} {count}
                </button>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-brand-green-line p-6 text-center text-sm font-semibold text-brand-muted">
              {all.length === 0
                ? text("Nothing yet on this day. A bill, a purchase or a payment shows here as it is saved.", "यो दिन अझै केही छैन। बिल, खरिद वा भुक्तानी save हुनासाथ यहाँ आउँछ।")
                : text("Nothing of this kind on this day.", "यो दिन यस्तो केही छैन।")}
            </p>
          ) : (
            <>
            {/* A phone has no room for five columns: each line is a card, the rupees on the right. */}
            <ul className="grid gap-1.5 sm:hidden print:hidden">
              {shown.map((r) => {
                const owedOut = r.area === "purchase" || r.area === "supplier";
                return (
                  <li
                    key={r.id}
                    className={`flex items-start justify-between gap-3 rounded-xl border border-brand-green-line px-3 py-2 ${r.bounced ? "bg-brand-clay-tint/50" : "bg-brand-paper"}`}
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1 text-sm">
                        <span className="tabular-nums text-brand-muted">{NEPAL_TIME.format(new Date(r.at))}</span>
                        {twoBusiness ? <BusinessTag r={r} /> : null}
                        <span className={`whitespace-nowrap rounded-full px-2 text-xs font-black ${TAG[r.area]}`}>{text(r.en, r.ne)}</span>
                        {r.ref ? (
                          <Link href={r.href} prefetch={false} className="truncate font-bold text-brand-green-ink underline decoration-brand-green-line underline-offset-2">
                            {r.ref}
                          </Link>
                        ) : null}
                      </p>
                      <p className="truncate text-sm font-semibold text-brand-green-ink">{r.party || "—"}</p>
                      {r.method || r.bounced ? (
                        <p className="text-xs text-brand-muted">
                          {r.method}
                          {r.bounced ? <span className="ml-1 font-black text-brand-clay">✕ {text("bounced", "बाउन्स")}</span> : null}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      {r.moneyIn > 0 ? <p className="font-black text-brand-green">+{rupees(r.moneyIn)}</p> : null}
                      {r.moneyOut > 0 ? <p className="font-black text-brand-clay">−{rupees(r.moneyOut)}</p> : null}
                      {r.moved > 0 ? <p className="font-black text-brand-gold-ink">↔ {rupees(r.moved)}</p> : null}
                      {r.due > 0 ? (
                        <p className="text-xs font-bold text-brand-muted">
                          {rupees(r.due)} {owedOut ? text("to pay", "तिर्न बाँकी") : text("due", "उधारो")}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto sm:block print:block">
              <table className="min-w-full text-sm">
                <thead className="border-b border-brand-green-line text-left text-xs text-brand-muted">
                  <tr>
                    <th className="py-2 pr-2"><T en="Time" ne="समय" /></th>
                    <th className="py-2 pr-2"><T en="What" ne="के" /></th>
                    <th className="py-2 pr-2"><T en="Who" ne="को" /></th>
                    <th className="py-2 pr-2 text-right"><T en="In" ne="आयो" /></th>
                    <th className="py-2 text-right"><T en="Out" ne="गयो" /></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} className={`border-b border-brand-green-line/60 align-top ${r.bounced ? "bg-brand-clay-tint/50" : ""}`}>
                      <td className="whitespace-nowrap py-2 pr-2 tabular-nums text-brand-muted">{NEPAL_TIME.format(new Date(r.at))}</td>
                      <td className="py-2 pr-2">
                        {twoBusiness ? <BusinessTag r={r} /> : null}
                        <span className={`mr-1 inline-block whitespace-nowrap rounded-full px-2 text-xs font-black ${TAG[r.area]}`}>{text(r.en, r.ne)}</span>
                        {r.ref ? (
                          <Link href={r.href} prefetch={false} className="font-bold text-brand-green-ink underline decoration-brand-green-line underline-offset-2">
                            {r.ref}
                          </Link>
                        ) : null}
                        {r.method ? <span className="ml-1 text-xs text-brand-muted">· {r.method}</span> : null}
                        {r.bounced ? <span className="ml-1 text-xs font-black text-brand-clay">✕ {text("bounced", "बाउन्स")}</span> : null}
                      </td>
                      <td className="py-2 pr-2 font-semibold text-brand-green-ink">{r.party || "—"}</td>
                      <td className="whitespace-nowrap py-2 pr-2 text-right tabular-nums">
                        {r.moneyIn > 0 ? <span className="font-black text-brand-green">{rupees(r.moneyIn)}</span> : null}
                        {r.due > 0 && r.area !== "purchase" && r.area !== "supplier" ? (
                          <span className="block text-xs font-bold text-brand-muted">{rupees(r.due)} {text("due", "उधारो")}</span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap py-2 text-right tabular-nums">
                        {r.moneyOut > 0 ? <span className="font-black text-brand-clay">{rupees(r.moneyOut)}</span> : null}
                        {r.moved > 0 ? (
                          <span className="block font-black text-brand-gold-ink" title={text("Moved between the two — not in or out", "दुईबीच सारिएको — आयो/गयोमा गनिँदैन")}>
                            ↔ {rupees(r.moved)}
                          </span>
                        ) : null}
                        {r.due > 0 && (r.area === "purchase" || r.area === "supplier") ? (
                          <span className="block text-xs font-bold text-brand-muted">{rupees(r.due)} {text("due", "उधारो")}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          <div className="flex flex-wrap gap-1.5 print:hidden">
            <PrintButton className="inline-flex min-h-10 items-center rounded-full bg-brand-green px-4 text-sm font-black text-white hover:bg-brand-green-ink">
              🖨️ <T en="Print" ne="छाप्ने" />
            </PrintButton>
            <button type="button" onClick={() => downloadCsv(all, day)} disabled={all.length === 0} className={`${navClass} disabled:opacity-50`}>
              ⬇ CSV
            </button>
            {may.reports ? (
              <Link href="/admin/pos?view=reports" className={navClass}>
                📊 <T en="Reports and day close" ne="रिपोर्ट र दिनको हिसाब" />
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function Parties({ parties, may, onPay }: { parties: PartyRow[]; may: May; onPay: (view: "in" | "out", id: string) => void }) {
  const { text } = useLanguage();
  const [find, setFind] = useState("");
  const shown = useMemo(() => {
    const words = find.trim().toLowerCase();
    const digits = words.replace(/\D/g, "");
    const list = words
      ? parties.filter((p) => p.name.toLowerCase().includes(words) || (digits && p.phone.replace(/\D/g, "").includes(digits)))
      : parties.filter((p) => p.due > 0);
    return list.slice(0, 60);
  }, [find, parties]);

  return (
    <div className="grid gap-3">
      <input
        type="search"
        value={find}
        onChange={(event) => setFind(event.target.value)}
        placeholder={text("Customer or supplier — name or phone", "ग्राहक वा साहु — नाम वा फोन")}
        aria-label={text("Find a customer or supplier", "ग्राहक वा साहु खोज्ने")}
        className={inputClass}
      />
      <p className="text-xs font-semibold text-brand-muted">
        {find.trim()
          ? text(`${shown.length} found`, `${shown.length} भेटियो`)
          : text("Everyone with money owed either way. Type to find anyone.", "जसको लिनु वा दिनु बाँकी छ। अरूलाई खोज्न टाइप गर्नुहोस्।")}
      </p>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-brand-green-line p-6 text-center text-sm font-semibold text-brand-muted">
          {find.trim() ? text("No one by that name or phone.", "त्यो नाम वा फोनको कोही छैन।") : text("Every account is settled.", "सबै खाता चुक्ता छन्।")}
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {shown.map((p) => {
            const ledgerHref =
              p.side === "customer"
                ? may.customerLedger
                  ? `/admin/operations/ledger/${p.id}`
                  : ""
                : may.supplierLedger
                  ? `/admin/purchasing/supplier/${p.id}`
                  : "";
            const canPay = p.due > 0 && (p.side === "customer" ? may.moneyIn : may.moneyOut);
            return (
              <li key={`${p.side}:${p.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-black text-brand-green-ink">{p.name}</p>
                  <p className="text-xs font-semibold text-brand-muted">
                    {p.side === "customer" ? text("Customer", "ग्राहक") : text("Supplier", "साहु")}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                      p.due <= 0 ? "bg-brand-green-wash text-brand-green" : p.side === "customer" ? "bg-brand-cream-soft text-brand-gold-ink" : "bg-brand-clay-tint text-brand-clay"
                    }`}
                  >
                    {p.due <= 0 ? (
                      text("Settled", "चुक्ता")
                    ) : (
                      <>
                        {p.side === "customer" ? text("Owes", "लिनु") : text("To pay", "दिनु")} <Amount>{money(p.due)}</Amount>
                      </>
                    )}
                  </span>
                  {p.phone ? (
                    <>
                      <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-9 items-center rounded-full bg-brand-green px-2.5 text-xs font-black text-white">
                        📞 <T en="Call" ne="फोन" />
                      </a>
                      <a
                        href={`https://wa.me/${whatsappNumber(p.phone) || p.phone.replace(/[^\d]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-9 items-center rounded-full bg-[#25D366] px-2.5 text-xs font-black text-white"
                        aria-label="WhatsApp"
                      >
                        💬
                      </a>
                    </>
                  ) : null}
                  {canPay ? (
                    <button
                      type="button"
                      onClick={() => onPay(p.side === "customer" ? "in" : "out", p.id)}
                      className="inline-flex min-h-9 items-center rounded-full border border-brand-green bg-brand-green-wash px-2.5 text-xs font-black text-brand-green"
                    >
                      {p.side === "customer" ? text("Money in", "पैसा आयो") : text("Money out", "पैसा गयो")}
                    </button>
                  ) : null}
                  {ledgerHref ? (
                    <Link href={ledgerHref} className="inline-flex min-h-9 items-center rounded-full border border-brand-green-line bg-brand-paper px-2.5 text-xs font-black text-brand-green-ink">
                      <T en="Open ledger" ne="खाता" />
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function TransactionsHub(props: Props) {
  const { text } = useLanguage();
  const { may } = props;
  const [view, setView] = useState<HubView>(props.initialView);
  const [tab, setTab] = useState<"book" | "parties">(props.initialTab);
  // A name pressed in Parties opens its form already chosen.
  const [presetId, setPresetId] = useState("");

  function choose(next: "in" | "out", id = "") {
    setView(next);
    setPresetId(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("v", next);
      url.searchParams.delete("saved");
      url.searchParams.delete("said");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // The address bar is a convenience; the form shows either way.
    }
  }

  // Alt + 3 / Alt + 4 while already here switch the form without a page load.
  useEffect(() => {
    function onVoucher(event: Event) {
      const next = (event as CustomEvent<HubView>).detail;
      if (next === "in" || next === "out") {
        choose(next);
        document.getElementById("transactions-form")?.scrollIntoView({ block: "nearest" });
      }
    }
    window.addEventListener(VOUCHER_EVENT, onVoucher);
    return () => window.removeEventListener(VOUCHER_EVENT, onVoucher);
  }, []);

  // A message belongs to the form that wrote it.
  // A message belongs to the form that wrote it; the drawer's go to the drawer.
  const savedFor = (v: HubView) => (props.initialView === v && !props.drawerMessage ? props.saved || props.said : "");
  const refusedFor = (v: HubView) => props.initialView === v && !props.drawerMessage && Boolean(props.said);

  const vouchers: Array<{ key: HubView; en: string; ne: string; keys: string; order: string; href?: string; allowed: boolean }> = [
    { key: "sale", en: "Sale", ne: "बिक्री", keys: "Alt 1", order: "order-3 sm:order-1", href: "/admin/pos?from=transactions", allowed: may.sale },
    { key: "buy", en: "Purchase", ne: "खरिद", keys: "Alt 2", order: "order-4 sm:order-2", href: "/admin/purchasing?from=transactions", allowed: may.purchase },
    { key: "in", en: "Money in", ne: "पैसा आयो", keys: "Alt 3", order: "order-1 sm:order-3", allowed: may.moneyIn },
    { key: "out", en: "Money out", ne: "पैसा गयो", keys: "Alt 4", order: "order-2 sm:order-4", allowed: may.moneyOut || may.wages },
  ];
  const voucherClass = (on: boolean) =>
    `grid min-h-16 content-center rounded-2xl border-2 px-3 py-2 text-center text-base font-black leading-tight transition ${
      on ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink hover:border-brand-green"
    }`;
  // Only a form this person may use: Money in needs the customer books, Money out the buying ones.
  const shownView: "in" | "out" = view === "out" ? (may.moneyOut || may.wages ? "out" : "in") : may.moneyIn ? "in" : "out";

  return (
    <section className="report-print p-4 sm:p-6">
      <PageHead eyebrow={<T en="Money" ne="पैसा" />} title={<T en="Transactions" ne="कारोबार" />} />
      <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted print:hidden">
        <T en="Every sale, purchase and payment of the day, in one place." ne="दिनभरको बिक्री, खरिद र भुक्तानी एकै ठाउँमा।" />
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 print:hidden">
        {vouchers
          .filter((v) => v.allowed)
          .map((v) =>
            v.href ? (
              <Link key={v.key} href={v.href} className={`${v.order} ${voucherClass(false)}`}>
                {text(v.en, v.ne)}
                <span className="text-xs font-bold opacity-70">
                  {text(v.ne, v.en)}
                  <span className="hidden md:inline"> · {v.keys}</span>
                </span>
              </Link>
            ) : (
              <button
                key={v.key}
                type="button"
                aria-pressed={shownView === v.key}
                onClick={() => choose(v.key as "in" | "out")}
                className={`${v.order} ${voucherClass(shownView === v.key)}`}
              >
                {text(v.en, v.ne)}
                <span className="text-xs font-bold opacity-80">
                  {text(v.ne, v.en)}
                  <span className="hidden md:inline"> · {v.keys}</span>
                </span>
              </button>
            ),
          )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        {may.moneyIn || may.moneyOut || may.wages ? (
          <div id="transactions-form" className="scroll-mt-24 rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm print:hidden sm:p-5">
            {shownView === "out" ? (
              <MoneyOutForm key={`out:${presetId}`} parties={props.parties} raw={savedFor("out")} refused={refusedFor("out")} may={may} presetId={presetId} />
            ) : (
              <MoneyInForm key={`in:${presetId}`} parties={props.parties} raw={savedFor("in")} refused={refusedFor("in")} presetId={presetId} cheque={props.cheque} />
            )}
          </div>
        ) : null}

        <div className="min-w-0 rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5">
          <div role="tablist" className="mb-3 flex gap-1.5 print:hidden">
            {(
              [
                { key: "book", en: "Day Book", ne: "दैनिक कारोबार" },
                { key: "parties", en: "Parties", ne: "खाता" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`min-h-10 rounded-full border px-4 text-sm font-black ${
                  tab === t.key ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-muted"
                }`}
              >
                {text(t.en, t.ne)}
              </button>
            ))}
          </div>
          {tab === "book" ? (
            <DayBook rows={props.rows} day={props.day} dayBs={props.dayBs} today={props.today} previousDay={props.previousDay} nextDay={props.nextDay} may={may} drawer={props.drawer} twoBusiness={props.twoBusiness} />
          ) : (
            <Parties
              parties={props.parties}
              may={may}
              onPay={(v, id) => {
                choose(v, id);
                document.getElementById("transactions-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
