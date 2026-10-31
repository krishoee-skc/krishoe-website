"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { money } from "@/lib/format-money";
import type { CartLine, RepeatBill } from "@/app/admin/pos/_components/pos-bill-rules";

/**
 * Small parts of the counter bill, split out of PosBillForm.tsx (owner,
 * 2026-10-27: the same screen, in smaller files). Each draws what it is given;
 * the form keeps the bill, its figures and what every press does.
 */

export type BillKind = "Sale" | "Return" | "Exchange";

/** The day so far, as the strip at the top shows it. */
export type TodayFigures = {
  bills: number;
  netSales: number;
  cash: number;
  /** QR, eSewa, Khalti and bank together. */
  digital: number;
  credit: number;
};

/** One pill of a two- or three-way choice. */
export const segment = (active: boolean, tone: "green" | "clay" = "green") =>
  `h-10 rounded-xl px-4 text-sm font-black transition ${
    active
      ? tone === "clay"
        ? "bg-brand-clay text-white"
        : "bg-brand-green text-white"
      : "text-brand-muted hover:text-brand-green-ink"
  }`;

/** How long this bill has been open — the counter's own clock. */
export function BillTimer({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  if (startedAt === null) return null;
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <span className="font-mono text-xs text-brand-muted" aria-hidden="true">
      ⏱ {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
    </span>
  );
}

/** Today's bills, sales, cash, QR and credit, in one line at the top. */
export function TodayStrip({ today }: { today: TodayFigures }) {
  const { text } = useLanguage();
  return (
    <div className="flex gap-x-5 gap-y-1 overflow-x-auto whitespace-nowrap rounded-2xl border border-brand-green-line bg-brand-paper px-4 py-2 text-sm tabular-nums [scrollbar-width:none]">
      <span className="font-bold text-brand-muted">{text("Today", "आज")}</span>
      <span>
        <b className="text-brand-green-ink">{today.bills}</b> {text("bills", "बिल")}
      </span>
      <span>
        {text("Sales", "बिक्री")} <b className="text-brand-green-ink">{money(today.netSales)}</b>
      </span>
      <span>
        {text("Cash", "नगद")} <b className="text-brand-green-ink">{money(today.cash)}</b>
      </span>
      <span>
        {text("QR/wallet", "QR/वालेट")} <b className="text-brand-green-ink">{money(today.digital)}</b>
      </span>
      {today.credit > 0 ? (
        <span>
          {text("Credit", "उधारो")} <b className="text-brand-green-ink">{money(today.credit)}</b>
        </span>
      ) : null}
    </div>
  );
}

/**
 * What kind of bill, and who it is for — each with a small name above it, since
 * two rows of look-alike pills side by side said nothing about which was
 * which — and the last bill again.
 */
export function BillTypeBar({
  kind,
  onKind,
  paymentsReady,
  onExchange,
  channel,
  onChannel,
  lastBill,
  onRepeatLast,
  business,
  onBusiness,
  factoryReady = false,
}: {
  kind: BillKind;
  onKind: (kind: BillKind) => void;
  /** Exchange waits for the Owner's database button. */
  paymentsReady: boolean;
  onExchange: () => void;
  channel: string;
  onChannel: (channel: string) => void;
  lastBill?: RepeatBill | null;
  onRepeatLast: () => void;
  /**
   * Whose bill (owner, 2026-10-31): the shop's or the factory's. Absent until
   * the two businesses are set up in Settings.
   */
  business?: "shop" | "factory";
  onBusiness?: (business: "shop" | "factory") => void;
  /** The factory's name and PAN are filled, so its bills can be cut. */
  factoryReady?: boolean;
}) {
  const { text } = useLanguage();
  return (
    <div className="flex flex-wrap items-end gap-2">
      {business && onBusiness ? (
        <div className="grid gap-0.5">
          <span className="px-1 text-xs font-black uppercase tracking-[0.12em] text-brand-muted-soft">
            {text("Whose bill", "कसको बिल")}
          </span>
          <div className="inline-flex rounded-2xl border border-brand-green-line bg-brand-paper p-1" role="group" aria-label={text("Whose bill", "कसको बिल")}>
            <button type="button" aria-pressed={business === "shop"} onClick={() => onBusiness("shop")} className={segment(business === "shop")}>
              🛒 {text("Shop", "पसल")} <span className="font-mono text-xs opacity-80">KRB</span>
            </button>
            <button
              type="button"
              aria-pressed={business === "factory"}
              disabled={!factoryReady || channel === "Online"}
              title={
                !factoryReady
                  ? text("Fill in the factory's name and PAN in Settings first", "पहिले Settings मा कारखानाको नाम र PAN भर्नुहोस्")
                  : channel === "Online"
                    ? text("Online sales are the shop's", "अनलाइन बिक्री पसलको हो")
                    : undefined
              }
              onClick={() => onBusiness("factory")}
              className={`${segment(business === "factory")} disabled:cursor-not-allowed disabled:opacity-40 ${business === "factory" ? "!bg-[#2F5C8A]" : ""}`}
            >
              🏭 {text("Factory", "कारखाना")} <span className="font-mono text-xs opacity-80">KRF</span>
            </button>
          </div>
          {!factoryReady ? (
            <span className="px-1 text-xs font-bold text-brand-muted">
              {text("Factory: fill its name and PAN in Settings first", "कारखाना: पहिले Settings मा नाम र PAN भर्नुहोस्")}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-0.5">
      <span className="px-1 text-xs font-black uppercase tracking-[0.12em] text-brand-muted-soft">
        {text("What", "के गर्ने")}
      </span>
      <div className="inline-flex rounded-2xl border border-brand-green-line bg-brand-paper p-1" role="group" aria-label={text("Bill type", "बिलको किसिम")}>
        <button type="button" aria-pressed={kind === "Sale"} onClick={() => onKind("Sale")} className={segment(kind === "Sale")}>
          {text("Sale", "बिक्री")}
        </button>
        {paymentsReady ? (
          <button
            type="button"
            aria-pressed={kind === "Exchange"}
            onClick={onExchange}
            className={segment(kind === "Exchange")}
          >
            {text("Exchange", "साटफेर")}
          </button>
        ) : null}
        <button type="button" aria-pressed={kind === "Return"} onClick={() => onKind("Return")} className={segment(kind === "Return", "clay")}>
          {text("Return", "फिर्ता")}
        </button>
      </div>
      </div>
      <div className="grid gap-0.5">
      <span className="px-1 text-xs font-black uppercase tracking-[0.12em] text-brand-muted-soft">
        {text("Who for", "कसलाई")}
      </span>
      <div className="inline-flex rounded-2xl border border-brand-green-line bg-brand-paper p-1" role="group" aria-label={text("Sales channel", "बिक्रीको बाटो")}>
        {(["Retail", "Wholesale", "Online"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={channel === option}
            onClick={() => onChannel(option)}
            className={segment(channel === option)}
          >
            {option === "Retail" ? text("Retail", "खुद्रा") : option === "Wholesale" ? text("Wholesale", "थोक") : text("Online", "अनलाइन")}
          </button>
        ))}
      </div>
      </div>
      {lastBill && lastBill.items.length > 0 ? (
        <button
          type="button"
          onClick={onRepeatLast}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-brand-green-line bg-brand-paper px-4 text-sm font-bold text-brand-green-ink hover:border-brand-green"
        >
          ↻ {text("Repeat last bill", "अघिल्लो बिल दोहोर्‍याउने")}
          <span className="hidden font-mono text-xs text-brand-muted sm:inline">{lastBill.invoiceNumber}</span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * Which side the next tapped shoe goes to on an exchange. The pair that came
 * back first, as the customer hands it over, then the new one.
 */
export function ExchangeSides({ addingBack, onSide }: { addingBack: boolean; onSide: (back: boolean) => void }) {
  const { text } = useLanguage();
  return (
    <div className="mb-3 grid grid-cols-2 gap-2" role="group" aria-label={text("Exchange side", "साटफेरको पक्ष")}>
      <button
        type="button"
        aria-pressed={addingBack}
        onClick={() => onSide(true)}
        className={`min-h-12 rounded-2xl border-2 text-sm font-black ${
          addingBack ? "border-brand-clay bg-brand-clay-tint text-brand-clay" : "border-brand-green-line text-brand-muted"
        }`}
      >
        ↩ {text("The pair that came back", "फिर्ता आएको जुत्ता")}
      </button>
      <button
        type="button"
        aria-pressed={!addingBack}
        onClick={() => onSide(false)}
        className={`min-h-12 rounded-2xl border-2 text-sm font-black ${
          !addingBack ? "border-brand-green bg-brand-green-tint text-brand-green" : "border-brand-green-line text-brand-muted"
        }`}
      >
        ↗ {text("The new pair", "नयाँ लगेको जुत्ता")}
      </button>
    </div>
  );
}

/** Bills put on hold, each a tap from coming back. */
export function HeldBills({ bills, onResume }: { bills: Array<{ id: string; cart: CartLine[] }>; onResume: (id: string) => void }) {
  const { text } = useLanguage();
  return (
    <div className="flex flex-wrap gap-1.5">
      {bills.map((bill, index) => (
        <button
          key={bill.id}
          type="button"
          onClick={() => onResume(bill.id)}
          className="rounded-full border border-dashed border-brand-gold bg-brand-cream-soft px-3 py-1 text-xs font-black text-brand-gold-deep"
        >
          ⏸ {text(`Held ${index + 1}`, `होल्ड ${index + 1}`)} ·{" "}
          {text(
            `${bill.cart.reduce((sum, line) => sum + line.quantity, 0)} pairs — open`,
            `${bill.cart.reduce((sum, line) => sum + line.quantity, 0)} जोडी — खोल्ने`,
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * The total, beside Save (owner, 2026-10-04: the namuna's model), then Hold
 * and Clear.
 */
export function TotalAndSave({
  hasLines,
  totalLabel,
  totalAmount,
  totalInClay,
  saveDisabled,
  saveLabel,
  isReturn,
  onHold,
  onClear,
}: {
  hasLines: boolean;
  totalLabel: string;
  totalAmount: number;
  /** Money going back to the customer reads in clay. */
  totalInClay: boolean;
  saveDisabled: boolean;
  saveLabel: string;
  isReturn: boolean;
  onHold: () => void;
  onClear: () => void;
}) {
  const { text } = useLanguage();
  return (
    <>
      {hasLines ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-bold text-brand-green-ink lg:text-xl">
              {totalLabel}
            </span>
            <span
              className={`text-4xl font-black tabular-nums lg:text-6xl ${
                totalInClay ? "text-brand-clay" : "text-brand-green-ink"
              }`}
            >
              {money(totalAmount)}
            </span>
          </div>
        ) : null}
      <button
        type="submit"
        disabled={saveDisabled}
        className={`min-h-16 w-full rounded-2xl px-4 text-xl font-black text-white transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-gold focus-visible:ring-offset-2 lg:text-2xl disabled:cursor-not-allowed disabled:opacity-60 ${
          isReturn ? "bg-brand-clay" : "bg-brand-green-ink hover:bg-brand-green"
        }`}
      >
        {saveLabel}
        <span className="ml-2 hidden font-mono text-xs opacity-70 md:inline">F9</span>
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onHold}
          disabled={!hasLines}
          className="h-11 rounded-xl border border-brand-green-line text-sm font-bold text-brand-green-ink disabled:opacity-50"
        >
          ⏸ {text("Hold", "होल्ड")}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!hasLines}
          className="h-11 rounded-xl border border-brand-green-line text-sm font-bold text-brand-green-ink disabled:opacity-50"
        >
          ✕ {text("Clear", "खाली गर्ने")}
        </button>
      </div>
    </>
  );
}

/**
 * On a phone the bill waits in a bar above the dock: the channel, the pairs,
 * anything to fix, the total, and the button that opens the bill.
 */
export function PhoneBillBar({
  channel,
  pairs,
  toFix,
  total,
  hasLines,
  onOpen,
}: {
  channel: string;
  pairs: number;
  toFix: number;
  total: number;
  hasLines: boolean;
  onOpen: () => void;
}) {
  const { text } = useLanguage();
  return (
    <div data-pos-bar className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 rounded-2xl border border-brand-green-line bg-brand-paper px-4 py-2.5 shadow-[0_12px_40px_rgba(16,35,29,0.18)] md:hidden print:hidden">
      <div className="tabular-nums">
        <p className="text-xs text-brand-muted">
          {/* Which rate, beside the count: on a phone the bill itself is a tap away. */}
          <span className={`mr-1 rounded-full px-2 font-black ${channel === "Wholesale" ? "bg-brand-gold-bright/30 text-brand-gold-deep" : "bg-brand-green-wash text-brand-green"}`}>
            {channel === "Wholesale" ? text("Wholesale", "थोक") : channel === "Online" ? text("Online", "अनलाइन") : text("Retail", "खुद्रा")}
          </span>
          {text(`${pairs} pairs`, `${pairs} जोडी`)}
          {toFix > 0 ? (
            <span className="ml-1 font-black text-brand-gold-deep">⚠ {text(`${toFix} to fix`, `${toFix} मिलाउनु`)}</span>
          ) : null}
        </p>
        <p className="text-xl font-black text-brand-green-ink">{money(total)}</p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="h-12 rounded-xl bg-brand-green px-5 text-base font-black text-white"
      >
        {hasLines ? text("Bill & save ▲", "बिल र राख्ने ▲") : text("Open bill ▲", "बिल हेर्ने ▲")}
      </button>
    </div>
  );
}
