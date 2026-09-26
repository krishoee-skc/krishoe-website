"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPosInvoiceAction, openPosCustomerLedgerAction } from "@/app/admin/pos/actions";
import type { ActionState } from "@/app/admin/actions";
import ActionMessage from "@/components/admin/ActionMessage";
import EnterWalkForm from "@/components/admin/EnterWalkForm";
import { useLanguage } from "@/components/LanguageProvider";
import { money } from "@/lib/format-money";
import { settleExchange } from "@/lib/pos-payments";
import PosProductPicker from "@/app/admin/pos/_components/PosProductPicker";
import PosSizeSheet from "@/app/admin/pos/_components/PosSizeSheet";
import {
  addPair,
  belowCost,
  billTotals,
  canAddPair,
  findByCode,
  hasSizes,
  isShoeSize,
  likelyNotes,
  lineKey,
  percentOff,
  planPayment,
  repriceForChannel,
  returnedValue,
  setPairs,
  setRate,
  type CartLine,
  type LedgerOption,
  type RepeatBill,
  type SellableItem,
} from "@/app/admin/pos/_components/pos-bill-rules";

export type { RepeatBill, RepeatBillItem, SellableItem } from "@/app/admin/pos/_components/pos-bill-rules";

/** Today's counter, for the strip above the bill. */
export type TodayFigures = {
  bills: number;
  netSales: number;
  cash: number;
  /** QR, eSewa, Khalti and bank together. */
  digital: number;
  credit: number;
};

type PosBillFormProps = {
  ledgers: LedgerOption[];
  catalog: SellableItem[];
  lastBill?: RepeatBill | null;
  /** Whether this admin may open a customer account without leaving the bill. */
  canOpenLedger?: boolean;
  /** Who is signed in — the bill's cashier unless changed. */
  cashierName?: string;
  today?: TodayFigures | null;
  /**
   * Whether the database takes a bill paid in parts. Until the Owner prepares
   * it in Settings, the counter offers no split payment, no exchange in one
   * bill and no old credit on a bill — everything else works as it is.
   */
  paymentsReady?: boolean;
};

type Kind = "Sale" | "Return" | "Exchange";
type Payment = "Cash" | "QR" | "eSewa" | "Khalti" | "Credit" | "Bank" | "Cheque";
type DiscountMode = "none" | "5" | "10" | "amount";

const PAYMENTS: Payment[] = ["Cash", "QR", "eSewa", "Khalti", "Credit", "Bank", "Cheque"];
// The server refuses these without a transaction number once money is in, so
// the box is asked for here, before Save, not after.
const NEEDS_REFERENCE = new Set<Payment>(["Cheque", "QR", "eSewa", "Khalti", "Bank"]);

type HeldBill = {
  id: string;
  heldAt: number;
  cart: CartLine[];
  channel: string;
  kind: Kind;
  phone: string;
  customerName: string;
};

// Held bills live on this device only: a bill set aside while the customer
// tries another size is this counter's business, and nobody else's.
const HELD_KEY = "krishoe-pos-held";

function readHeld(): HeldBill[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(HELD_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((bill): bill is HeldBill => Array.isArray((bill as HeldBill)?.cart))
      : [];
  } catch {
    return [];
  }
}

// One copy of the held bills for the page, read from storage the first time
// it is asked for. The server has no idea what this device held, so it always
// answers "none" and the real list arrives as the page wakes.
const NONE_HELD: HeldBill[] = [];
let heldCache: HeldBill[] | null = null;
const heldListeners = new Set<() => void>();

function heldSnapshot() {
  if (heldCache === null) heldCache = readHeld();
  return heldCache;
}

function subscribeHeld(listener: () => void) {
  heldListeners.add(listener);
  return () => {
    heldListeners.delete(listener);
  };
}

function saveHeld(bills: HeldBill[]) {
  heldCache = bills;
  try {
    window.localStorage.setItem(HELD_KEY, JSON.stringify(bills));
  } catch {
    // Storage refused (a private window): the bill is still held on screen.
  }
  heldListeners.forEach((listener) => listener());
}

/** A held bill's name tag and the moment it was set aside. */
function heldStamp() {
  const now = Date.now();
  return { id: `h-${now}-${Math.random().toString(36).slice(2, 6)}`, heldAt: now };
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

/** Two numbers are one phone when their last ten digits agree. */
function samePhone(left: string | undefined, right: string) {
  const a = digits(left ?? "").slice(-10);
  const b = digits(right).slice(-10);
  return a.length >= 7 && a === b;
}

// F9 reaches the form by its id: EnterWalkForm keeps its own ref.
const BILL_FORM_ID = "pos-bill-form";

const inputClass =
  "h-11 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink outline-none focus:border-brand-green";

function BillTimer({ startedAt }: { startedAt: number | null }) {
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

/**
 * The counter bill.
 *
 * Shoes are tapped in from the shelf on the left, the size chosen on a sheet,
 * and the bill on the right settles itself: the rate from the channel, the
 * paid amount from the payment, the change from the notes handed over. What is
 * left to type is only what the counter actually knows — a bargained rate, a
 * phone number, a transaction number.
 *
 * On a phone the shelf fills the screen and the bill waits in a bar above the
 * dock, opening over the shelf when tapped, with Save at the thumb.
 *
 * Every rule the save enforces is asked here first, while the bill can still
 * be finished: the account for anything unpaid, the number for a QR payment,
 * the cash that does not cover the bill. Save stays the only way a bill is
 * filed — Enter walks the boxes and asks before it saves, F9 saves.
 */
export default function PosBillForm({
  ledgers,
  catalog,
  lastBill,
  canOpenLedger = false,
  cashierName = "",
  today = null,
  paymentsReady = false,
}: PosBillFormProps) {
  const { text } = useLanguage();
  const router = useRouter();
  const [submissionKey] = useState(() => `pos-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>("Sale");
  const [channel, setChannel] = useState("Retail");
  const [payment, setPayment] = useState<Payment>("Cash");
  const [received, setReceived] = useState("");
  // How a cash shortfall is covered: credit, or another method's second part.
  const [restMethod, setRestMethod] = useState<Payment | "">("");
  const [restReference, setRestReference] = useState("");
  // In an exchange: whether the next tapped shoe is one coming back.
  const [addingBack, setAddingBack] = useState(true);
  const [collectDue, setCollectDue] = useState(false);
  const [dueText, setDueText] = useState("");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("none");
  const [discountText, setDiscountText] = useState("");
  const [tax, setTax] = useState("");
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [ledgerId, setLedgerId] = useState("");
  const [ledgerOptions, setLedgerOptions] = useState(ledgers);
  const [ledgerNote, setLedgerNote] = useState("");
  const [isOpeningLedger, setIsOpeningLedger] = useState(false);
  const [reference, setReference] = useState("");
  const [cashier, setCashier] = useState(cashierName);

  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [picking, setPicking] = useState<SellableItem | null>(null);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ label: string; cart: CartLine[] } | null>(null);
  const held = useSyncExternalStore(subscribeHeld, heldSnapshot, () => NONE_HELD);
  const [cartOpen, setCartOpen] = useState(false);
  const [readingPhoto, setReadingPhoto] = useState(false);

  const [state, setState] = useState<ActionState | null>(null);
  const [saveLocked, setSaveLocked] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const submitStarted = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  const byDesign = useMemo(() => {
    const map = new Map<string, SellableItem>();
    for (const item of catalog) map.set(item.design.trim().toLowerCase(), item);
    return map;
  }, [catalog]);
  const itemFor = (design: string) => byDesign.get(design.trim().toLowerCase());

  // ---- what the bill comes to -------------------------------------------
  const lines = billTotals(cart, 0, 0);
  const discountValue =
    discountMode === "5" || discountMode === "10"
      ? percentOff(lines.subtotal, Number(discountMode))
      : discountMode === "amount"
        ? Number(digits(discountText)) || 0
        : 0;
  const totals = billTotals(cart, discountValue, Number(digits(tax)) || 0);
  const isReturn = kind === "Return";
  const isExchange = kind === "Exchange";
  // An exchange: the pairs coming back pay for the new ones as far as they go.
  const backValue = returnedValue(cart);
  const settle = settleExchange(backValue, totals.total);
  const amountDue = isExchange ? settle.toPay : totals.total;

  const phoneAccount = phone ? ledgerOptions.find((ledger) => samePhone(ledger.phone, phone)) : undefined;
  const accountId = ledgerId || phoneAccount?.id || "";
  const account = ledgerOptions.find((ledger) => ledger.id === accountId);

  // Old credit cleared on the bill: only on a sale, only by money, only when
  // the database can record the part.
  const oldDue = account?.balanceDue ?? 0;
  const canCollectDue = paymentsReady && kind === "Sale" && payment !== "Credit" && oldDue > 0;
  const dueAmount = canCollectDue && collectDue ? Math.min(oldDue, Number(digits(dueText)) || oldDue) : 0;

  const plan = isReturn
    ? null
    : planPayment({
        total: amountDue,
        method: payment,
        received: received === "" ? null : Number(received),
        restMethod,
        reference,
        restReference,
        due: dueAmount,
      });
  // What the bill records as paid. A return pays nothing in: it goes to the
  // customer's account, the way it always has. A credit bill is the due itself.
  const paid = plan ? plan.paid : 0;
  const creditAmount = plan ? plan.credit : 0;
  const needsAccount = isReturn ? totals.total > 0 : creditAmount > 0;
  const needsReference = Boolean(plan) && NEEDS_REFERENCE.has(payment) && amountDue + dueAmount > 0;
  const needsRestReference = Boolean(plan?.split) && NEEDS_REFERENCE.has(restMethod as Payment);
  const unpriced = cart.filter((line) => !(line.rate > 0));
  const belowCostLines = cart.filter((line) => !line.back && belowCost(line.rate, itemFor(line.design)?.costPerPair));
  const backLines = cart.filter((line) => line.back);
  const outLines = cart.filter((line) => !line.back);

  let blocked = "";
  if (cart.length === 0) {
    blocked = text("Tap a shoe to start", "जुत्ता थपेर सुरु गर्नुहोस्");
  } else if (isExchange && (backLines.length === 0 || outLines.length === 0)) {
    blocked =
      backLines.length === 0
        ? text("Add the pair that came back", "फिर्ता आएको जुत्ता थप्नुहोस्")
        : text("Add the new pair", "नयाँ लगेको जुत्ता थप्नुहोस्");
  } else if (unpriced.length > 0) {
    blocked = text("A line has no rate — tap its price", "एउटा लाइनमा रेट छैन — मूल्यमा थिच्नुहोस्");
  } else if (plan && plan.short > 0) {
    blocked = text(`Cash is ${money(plan.short)} short`, `नगद ${money(plan.short)} कम छ`);
  } else if (needsReference && !reference.trim()) {
    blocked = text(`Type the ${payment} number`, `${payment} को नम्बर लेख्नुहोस्`);
  } else if (needsRestReference && !restReference.trim()) {
    blocked = text(`Type the ${restMethod} number`, `${restMethod} को नम्बर लेख्नुहोस्`);
  } else if (needsAccount && !accountId) {
    blocked = isReturn
      ? text("Pick whose account the return goes to", "फिर्ता कसको खातामा जाने, छान्नुहोस्")
      : text("Pick whose account the unpaid part goes to", "बाँकी रकम कसको खातामा, छान्नुहोस्");
  }

  // ---- putting shoes on the bill -----------------------------------------
  const add = useCallback(
    (item: SellableItem, size: string, color = "") => {
      // A pair coming back in an exchange takes nothing off the shelf, so it
      // is never refused for want of stock.
      const back = kind === "Exchange" && addingBack;
      if (back) {
        setCart((current) => addPair(current, item, channel, size, color, true));
        setStartedAt((value) => value ?? Date.now());
        setNote(
          text(
            `Came back: ${item.design}${size ? `, size ${size}` : ""}.`,
            `फिर्ता आयो: ${item.design}${size ? `, साइज ${size}` : ""}।`,
          ),
        );
        setState(null);
        return;
      }
      if (kind !== "Return" && !canAddPair(item, size, cart)) {
        setNote(
          size
            ? text(`${item.design} size ${size} is not in stock.`, `${item.design} साइज ${size} stock मा छैन।`)
            : text(`${item.design} is out of stock.`, `${item.design} stock मा छैन।`),
        );
        return;
      }
      setCart((current) => addPair(current, item, channel, size, color));
      setStartedAt((value) => value ?? Date.now());
      setNote(
        size
          ? text(`Added ${item.design}, size ${size}.`, `${item.design}, साइज ${size} थपियो।`)
          : text(`Added ${item.design}.`, `${item.design} थपियो।`),
      );
      setState(null);
    },
    [addingBack, cart, channel, kind, text],
  );

  function choose(item: SellableItem, sizeFilter: string) {
    const colors = (item.colors ?? []).filter(Boolean);
    if (!hasSizes(item)) {
      add(item, "", colors[0] ?? "");
      return;
    }
    // The size is already named in the filter and there is no colour to ask:
    // one tap is the whole job.
    if (sizeFilter && colors.length <= 1 && (kind === "Sale" || (kind === "Exchange" && !addingBack))) {
      add(item, sizeFilter, colors[0] ?? "");
      return;
    }
    setPicking(item);
  }

  function submitQuery(value: string, shown: SellableItem[]) {
    const code = findByCode(catalog, value);
    if (code) {
      setQuery("");
      if (code.size || !hasSizes(code.item)) add(code.item, code.size, (code.item.colors ?? [])[0] ?? "");
      else setPicking(code.item);
      return;
    }
    if (shown.length > 0) {
      choose(shown[0], isShoeSize(value) ? value.trim() : "");
      if (!isShoeSize(value)) setQuery("");
      return;
    }
    if (value.trim()) {
      setNote(
        text(
          `"${value.trim()}" not found. Check the code or the name.`,
          `"${value.trim()}" भेटिएन। कोड वा नाम हेर्नुहोस्।`,
        ),
      );
    }
  }

  async function readPhoto(file: File | undefined) {
    if (!file) return;
    setReadingPhoto(true);
    setNote(text("Reading the barcode in the photo…", "फोटोको बारकोड पढ्दै…"));
    const imageUrl = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(imageUrl);
      submitQuery(result.getText().trim(), []);
    } catch {
      setNote(
        text(
          "No barcode found. Try a clearer photo, or search the name.",
          "बारकोड भेटिएन। अझ प्रस्ट फोटो खिच्नुहोस्, वा नाम खोज्नुहोस्।",
        ),
      );
    } finally {
      URL.revokeObjectURL(imageUrl);
      setReadingPhoto(false);
    }
  }

  function changePairs(line: CartLine, next: number) {
    const item = itemFor(line.design);
    if (next > line.quantity && kind !== "Return" && !line.back && item && !canAddPair(item, line.size, cart)) {
      setNote(text("No more pairs of that size.", "त्यो साइज अब बाँकी छैन।"));
      return;
    }
    if (next <= 0) {
      setUndo({
        label: text(`Removed ${line.design}${line.size ? ` (${line.size})` : ""}`, `${line.design}${line.size ? ` (${line.size})` : ""} हटाइयो`),
        cart,
      });
    }
    setCart((current) => setPairs(current, line.key, next));
  }

  // The value is read here, in the handler: React runs a state updater later,
  // when the event has already let go of its input.
  function commitRate(key: string, typed: string) {
    const rate = Number(digits(typed));
    setCart((current) => setRate(current, key, rate));
  }

  function changeChannel(next: string) {
    setChannel(next);
    setCart((current) => repriceForChannel(current, catalog, next));
  }

  function resetBill() {
    setCart([]);
    setStartedAt(null);
    setReceived("");
    setRestMethod("");
    setRestReference("");
    setCollectDue(false);
    setDueText("");
    setAddingBack(true);
    setDiscountMode("none");
    setDiscountText("");
    setTax("");
    setPhone("");
    setCustomerName("");
    setLedgerId("");
    setReference("");
    setKind("Sale");
    setEditingRate(null);
  }

  function holdBill() {
    if (cart.length === 0) return;
    const next = [
      ...held,
      { ...heldStamp(), cart, channel, kind, phone, customerName },
    ];
    saveHeld(next);
    resetBill();
    setNote(text("Bill held. Serve the next customer.", "बिल होल्डमा राखियो। अर्को ग्राहकको बिल काट्नुहोस्।"));
  }

  function resumeBill(id: string) {
    const bill = held.find((entry) => entry.id === id);
    if (!bill) return;
    let rest = held.filter((entry) => entry.id !== id);
    if (cart.length > 0) {
      rest = [...rest, { ...heldStamp(), cart, channel, kind, phone, customerName }];
    }
    saveHeld(rest);
    resetBill();
    setCart(bill.cart);
    setChannel(bill.channel);
    setKind(bill.kind);
    setPhone(bill.phone);
    setCustomerName(bill.customerName);
    setStartedAt(bill.heldAt);
  }

  function repeatLast() {
    if (!lastBill || lastBill.items.length === 0) return;
    setChannel(lastBill.channel);
    setKind("Sale");
    setCart(
      lastBill.items.map((item) => ({
        key: lineKey(item.design, item.size, item.color),
        design: item.design,
        sku: item.sku,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        rate: item.rate,
        listRate: item.rate,
      })),
    );
    setStartedAt(Date.now());
  }

  function openLedger() {
    setLedgerNote("");
    setIsOpeningLedger(true);
    startSaving(async () => {
      const result = await openPosCustomerLedgerAction({ customerName, phone, channel });
      setIsOpeningLedger(false);
      setLedgerNote(result.message);
      if (result.ok && result.ledger) {
        const opened: LedgerOption = { ...result.ledger, phone: digits(phone), customerName, balanceDue: 0 };
        setLedgerOptions((current) => [opened, ...current]);
        setLedgerId(opened.id);
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitStarted.current) return;
    if (blocked) {
      setState({ ok: false, message: blocked });
      return;
    }

    const formData = new FormData(event.currentTarget);
    submitStarted.current = true;
    setSaveLocked(true);
    startSaving(async () => {
      const result = await createPosInvoiceAction(state, formData);
      setState(result);
      if (result.ok && result.href) {
        router.push(result.href);
        return;
      }
      submitStarted.current = false;
      setSaveLocked(false);
    });
  }

  // F2 goes to the search box from anywhere; F9 saves from anywhere.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        setCartOpen(false);
        searchRef.current?.focus();
      }
      if (event.key === "F9") {
        event.preventDefault();
        (document.getElementById(BILL_FORM_ID) as HTMLFormElement | null)?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const saveLabel = isOpeningLedger
    ? text("Opening the account…", "खाता खोल्दैछौँ…")
    : isSaving || saveLocked
      ? text("Saving…", "राख्दैछौँ…")
      : blocked && cart.length > 0
        ? blocked
        : isReturn
          ? text(`Save return · ${money(totals.total)}`, `फिर्ता बिल राख्ने · ${money(totals.total)}`)
          : isExchange
            ? settle.toRefund > 0
              ? text(`Save exchange · give back ${money(settle.toRefund)}`, `साटफेर राख्ने · ${money(settle.toRefund)} फिर्ता`)
              : text(`Save exchange · ${money(settle.toPay)}`, `साटफेर राख्ने · ${money(settle.toPay)}`)
          : payment === "Credit"
            ? text(`Save on credit · ${money(totals.total)}`, `उधारोमा बिल राख्ने · ${money(totals.total)}`)
            : text(`Save bill · ${money(totals.total + dueAmount)}`, `बिल राख्ने · ${money(totals.total + dueAmount)}`);

  const payLabel: Record<Payment, string> = {
    Cash: text("Cash", "नगद"),
    QR: "QR",
    eSewa: "eSewa",
    Khalti: "Khalti",
    Credit: text("Credit", "उधारो"),
    Bank: text("Bank", "बैंक"),
    Cheque: text("Cheque", "चेक"),
  };

  const segment = (active: boolean, tone: "green" | "clay" = "green") =>
    `h-10 rounded-xl px-4 text-sm font-black transition ${
      active
        ? tone === "clay"
          ? "bg-brand-clay text-white"
          : "bg-brand-green text-white"
        : "text-brand-muted hover:text-brand-green-ink"
    }`;

  return (
    // min-w-0 all the way down: the size row scrolls sideways, and without it
    // that row would stretch the whole column past a phone screen.
    <div className="grid min-w-0 gap-3">
      {today ? (
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
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-2xl border border-brand-green-line bg-brand-paper p-1" role="group" aria-label={text("Bill type", "बिलको किसिम")}>
          <button type="button" aria-pressed={kind === "Sale"} onClick={() => setKind("Sale")} className={segment(kind === "Sale")}>
            {text("Sale", "बिक्री")}
          </button>
          {paymentsReady ? (
            <button
              type="button"
              aria-pressed={kind === "Exchange"}
              onClick={() => {
                setKind("Exchange");
                setAddingBack(true);
              }}
              className={segment(kind === "Exchange")}
            >
              {text("Exchange", "साटफेर")}
            </button>
          ) : null}
          <button type="button" aria-pressed={kind === "Return"} onClick={() => setKind("Return")} className={segment(kind === "Return", "clay")}>
            {text("Return", "फिर्ता")}
          </button>
        </div>
        <div className="inline-flex rounded-2xl border border-brand-green-line bg-brand-paper p-1" role="group" aria-label={text("Sales channel", "बिक्रीको बाटो")}>
          {(["Retail", "Wholesale", "Online"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={channel === option}
              onClick={() => changeChannel(option)}
              className={segment(channel === option)}
            >
              {option === "Retail" ? text("Retail", "खुद्रा") : option === "Wholesale" ? text("Wholesale", "थोक") : text("Online", "अनलाइन")}
            </button>
          ))}
        </div>
        {lastBill && lastBill.items.length > 0 ? (
          <button
            type="button"
            onClick={repeatLast}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-brand-green-line bg-brand-paper px-4 text-sm font-bold text-brand-green-ink hover:border-brand-green"
          >
            ↻ {text("Repeat last bill", "अघिल्लो बिल दोहोर्‍याउने")}
            <span className="hidden font-mono text-xs text-brand-muted sm:inline">{lastBill.invoiceNumber}</span>
          </button>
        ) : null}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="min-w-0 rounded-3xl border border-brand-green-line bg-brand-paper p-3 sm:p-4">
          {isExchange ? (
            // Which side the next tapped shoe goes to. The pair that came back
            // first, as the customer hands it over, then the new one.
            <div className="mb-3 grid grid-cols-2 gap-2" role="group" aria-label={text("Exchange side", "साटफेरको पक्ष")}>
              <button
                type="button"
                aria-pressed={addingBack}
                onClick={() => setAddingBack(true)}
                className={`min-h-12 rounded-2xl border-2 text-sm font-black ${
                  addingBack ? "border-brand-clay bg-brand-clay-tint text-brand-clay" : "border-brand-green-line text-brand-muted"
                }`}
              >
                ↩ {text("The pair that came back", "फिर्ता आएको जुत्ता")}
              </button>
              <button
                type="button"
                aria-pressed={!addingBack}
                onClick={() => setAddingBack(false)}
                className={`min-h-12 rounded-2xl border-2 text-sm font-black ${
                  !addingBack ? "border-brand-green bg-brand-green-tint text-brand-green" : "border-brand-green-line text-brand-muted"
                }`}
              >
                ↗ {text("The new pair", "नयाँ लगेको जुत्ता")}
              </button>
            </div>
          ) : null}
          <PosProductPicker
            catalog={catalog}
            cart={cart}
            channel={channel}
            returning={isReturn || (isExchange && addingBack)}
            query={query}
            onQueryChange={setQuery}
            onSubmitQuery={submitQuery}
            onChoose={choose}
            onPhoto={(file) => void readPhoto(file)}
            readingPhoto={readingPhoto}
            note={note}
            searchRef={searchRef}
          />
        </div>

        <aside
          aria-label={text("The bill", "बिल")}
          className={`min-w-0 rounded-3xl border border-brand-green-line bg-brand-paper md:sticky md:top-4 md:block ${
            cartOpen
              ? // Full screen on a phone, below the clock and battery: an app
                // saved to the Home Screen draws under the status bar.
                "max-md:fixed max-md:inset-0 max-md:z-50 max-md:overflow-y-auto max-md:rounded-none max-md:border-0 max-md:pt-[env(safe-area-inset-top)]"
              : "max-md:hidden"
          }`}
        >
          <EnterWalkForm id={BILL_FORM_ID} onSubmit={handleSubmit} className="grid gap-3 p-4" confirmTitle={customerName || undefined}>
            <input type="hidden" name="sourceSubmissionKey" value={submissionKey} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="channel" value={channel} />
            {/* A bill with nothing paid is a credit bill, whichever button was pressed
                first — "Cash" with no cash would sit under Cash in the day close. */}
            <input
              type="hidden"
              name="paymentMethod"
              value={isReturn ? "Cash" : plan && plan.paid === 0 && plan.credit > 0 ? "Credit" : payment}
            />
            <input type="hidden" name="itemCount" value={cart.length} />
            <input type="hidden" name="invoiceDiscount" value={totals.discount} />
            <input type="hidden" name="paidAmount" value={paid} />
            <input type="hidden" name="ledgerId" value={accountId} />
            {/* A bill paid in more than one way sends its parts; an exchange
                always does, since the returned pairs are one of them. */}
            {plan && (plan.split || isExchange) ? (
              <input type="hidden" name="paymentParts" value={JSON.stringify(plan.parts.map((part) => ({ ...part, purpose: "bill" })))} />
            ) : null}
            {isExchange ? <input type="hidden" name="refundMethod" value="Cash" /> : null}
            {dueAmount > 0 ? (
              <>
                <input type="hidden" name="dueLedgerId" value={accountId} />
                <input type="hidden" name="dueAmount" value={dueAmount} />
                <input type="hidden" name="dueMethod" value={payment} />
                <input type="hidden" name="dueReference" value={reference} />
              </>
            ) : null}
            <input type="hidden" data-summary="money" value={isExchange ? settle.toPay : totals.total + dueAmount} readOnly />
            {cart.map((line, index) => (
              <span key={line.key} hidden>
                <input type="hidden" name={`item${index}Sku`} value={line.sku} />
                <input type="hidden" name={`item${index}Design`} value={line.design} />
                <input type="hidden" name={`item${index}Size`} value={line.size} />
                <input type="hidden" name={`item${index}Color`} value={line.color} />
                <input type="hidden" name={`item${index}Quantity`} value={line.quantity} />
                <input type="hidden" name={`item${index}Rate`} value={line.rate} />
                <input type="hidden" name={`item${index}Discount`} value={0} />
                <input type="hidden" name={`item${index}Direction`} value={line.back ? "in" : "out"} />
              </span>
            ))}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="h-10 rounded-xl border border-brand-green-line px-3 text-sm font-bold text-brand-green-ink md:hidden"
              >
                ← {text("Shoes", "जुत्ता")}
              </button>
              <h2 className="flex-1 text-lg font-black text-brand-green-ink">
                {isReturn ? text("Return bill", "फिर्ता बिल") : isExchange ? text("Exchange", "साटफेर") : text("Bill", "बिल")}
              </h2>
              <BillTimer startedAt={startedAt} />
            </div>

            {held.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {held.map((bill, index) => (
                  <button
                    key={bill.id}
                    type="button"
                    onClick={() => resumeBill(bill.id)}
                    className="rounded-full border border-dashed border-brand-gold bg-brand-cream-soft px-3 py-1 text-xs font-black text-brand-gold-deep"
                  >
                    ⏸ {text(`Held ${index + 1}`, `होल्ड ${index + 1}`)} ·{" "}
                    {text(
                      `${bill.cart.reduce((sum, line) => sum + line.quantity, 0)} pairs — open`,
                      `${bill.cart.reduce((sum, line) => sum + line.quantity, 0)} जोडा — खोल्ने`,
                    )}
                  </button>
                ))}
              </div>
            ) : null}

            {cart.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-brand-green-line px-4 py-8 text-center text-sm text-brand-muted">
                {isReturn
                  ? text("Tap the shoe that came back, then its size.", "फिर्ता आएको जुत्ता, अनि साइज थिच्नुहोस्।")
                  : text("Tap a shoe or scan it. Then its size.", "जुत्ता थिच्नुहोस् वा स्क्यान गर्नुहोस्, अनि साइज।")}
              </p>
            ) : (
              <ul className="divide-y divide-brand-green-line border-y border-brand-green-line">
                {cart.map((line) => {
                  const item = itemFor(line.design);
                  const cost = item?.costPerPair;
                  const cheap = belowCost(line.rate, cost);
                  const bargained = line.rate !== line.listRate;
                  return (
                    <li key={line.key} className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-brand-green-ink">
                          {line.back ? <span className="text-brand-clay">↩ </span> : null}
                          {line.design}
                        </p>
                        <p className="text-xs text-brand-muted">
                          {line.size ? text(`Size ${line.size}`, `साइज ${line.size}`) : null}
                          {line.color ? ` · ${line.color}` : null}
                        </p>
                      </div>
                      <p className="text-right text-sm font-black tabular-nums text-brand-green-ink">
                        {isReturn || line.back ? "− " : ""}
                        {money(line.rate * line.quantity)}
                      </p>
                      <div className="flex items-center gap-2">
                        {editingRate === line.key ? (
                          <input
                            autoFocus
                            inputMode="numeric"
                            defaultValue={line.rate || ""}
                            aria-label={text(`New rate for ${line.design}`, `${line.design} को नयाँ रेट`)}
                            className="h-9 w-28 rounded-lg border-2 border-brand-gold bg-brand-paper px-2 text-base tabular-nums outline-none"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitRate(line.key, event.currentTarget.value);
                                setEditingRate(null);
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                setEditingRate(null);
                              }
                            }}
                            onBlur={(event) => {
                              commitRate(line.key, event.currentTarget.value);
                              setEditingRate(null);
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingRate(line.key)}
                            title={text("Tap to change the rate", "रेट बदल्न थिच्नुहोस्")}
                            className={`text-xs tabular-nums underline decoration-dotted underline-offset-4 ${
                              !(line.rate > 0) ? "font-black text-brand-clay" : bargained ? "font-black text-brand-gold-deep" : "text-brand-muted"
                            }`}
                          >
                            {line.rate > 0 ? money(line.rate) : text("Set rate", "रेट लेख्ने")}
                            {bargained && line.listRate > 0 ? text(` (was ${money(line.listRate)})`, ` (${money(line.listRate)} थियो)`) : ""} ✎
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-end">
                        <div className="inline-flex items-center overflow-hidden rounded-xl border border-brand-green-line">
                          <button
                            type="button"
                            onClick={() => changePairs(line, line.quantity - 1)}
                            aria-label={text("One pair less", "एक जोडा घटाउने")}
                            className="h-9 w-9 bg-brand-paper-deep text-lg font-black text-brand-green-ink"
                          >
                            −
                          </button>
                          <span className="min-w-8 text-center text-sm font-black tabular-nums">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => changePairs(line, line.quantity + 1)}
                            aria-label={text("One pair more", "एक जोडा थप्ने")}
                            className="h-9 w-9 bg-brand-paper-deep text-lg font-black text-brand-green-ink"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {cheap && !isReturn && !line.back ? (
                        <p className="col-span-2 text-xs font-bold text-brand-clay">
                          {text(
                            `Below cost (${money(cost ?? 0)} a pair) — the sale is still allowed.`,
                            `लागत (${money(cost ?? 0)} प्रति जोडा) भन्दा तल — बेच्न भने मिल्छ।`,
                          )}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {undo ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-brand-green-ink px-3 py-2 text-sm text-white">
                <span>{undo.label}</span>
                <button
                  type="button"
                  onClick={() => {
                    setCart(undo.cart);
                    setUndo(null);
                  }}
                  className="rounded-full bg-brand-gold px-3 py-1 text-xs font-black text-brand-green-ink"
                >
                  {text("Bring back", "फिर्ता ल्याउने")}
                </button>
              </div>
            ) : null}

            {cart.length > 0 && !isReturn ? (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={text("Discount on the whole bill", "पूरै बिलमा छुट")}>
                <span className="text-sm text-brand-muted">{text("Discount", "छुट")}</span>
                {(["none", "5", "10"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={discountMode === mode}
                    onClick={() => {
                      setDiscountMode(mode);
                      setDiscountText("");
                    }}
                    className={`h-9 rounded-full border px-3 text-sm font-bold ${
                      discountMode === mode ? "border-brand-green bg-brand-green-tint text-brand-green" : "border-brand-green-line bg-brand-paper-deep"
                    }`}
                  >
                    {mode === "none" ? text("None", "छैन") : `${mode}%`}
                  </button>
                ))}
                <input
                  inputMode="numeric"
                  value={discountText}
                  onChange={(event) => {
                    setDiscountText(digits(event.target.value));
                    setDiscountMode(event.target.value ? "amount" : "none");
                  }}
                  placeholder={text("Rs …", "रु …")}
                  aria-label={text("Discount in rupees", "छुट रकम")}
                  className="h-9 w-24 rounded-full border border-brand-green-line bg-brand-paper px-3 text-sm tabular-nums outline-none focus:border-brand-green"
                />
              </div>
            ) : null}

            {cart.length > 0 ? (
              <div className="grid gap-1 text-sm tabular-nums">
                <div className="flex justify-between text-brand-muted">
                  <span>
                    {text(`${totals.pairs} pairs`, `${totals.pairs} जोडा`)}
                    {channel === "Wholesale" ? text(" · wholesale rate", " · थोक मूल्य") : ""}
                  </span>
                  <span>{money(totals.subtotal)}</span>
                </div>
                {totals.bargained > 0 ? (
                  <div className="flex justify-between text-brand-muted">
                    <span>{text("Off the price by bargaining", "मोलमोलाईमा घटेको")}</span>
                    <span>{money(totals.bargained)}</span>
                  </div>
                ) : null}
                {totals.discount > 0 ? (
                  <div className="flex justify-between text-brand-muted">
                    <span>{text("Discount", "छुट")}</span>
                    <span>− {money(totals.discount)}</span>
                  </div>
                ) : null}
                {totals.tax > 0 ? (
                  <div className="flex justify-between text-brand-muted">
                    <span>{text("Tax", "कर")}</span>
                    <span>{money(totals.tax)}</span>
                  </div>
                ) : null}
                {isExchange ? (
                  <div className="flex justify-between text-brand-clay">
                    <span>{text("The pair that came back", "फिर्ता आएको जुत्ता")}</span>
                    <span>− {money(backValue)}</span>
                  </div>
                ) : null}
                {dueAmount > 0 ? (
                  <div className="flex justify-between text-brand-gold-deep">
                    <span>{text("Old credit taken", "पहिलेको बाँकी")}</span>
                    <span>{money(dueAmount)}</span>
                  </div>
                ) : null}
                <div className="mt-1 flex items-baseline justify-between border-t-2 border-brand-green-ink pt-2">
                  <span className="font-bold text-brand-green-ink">
                    {isReturn
                      ? text("Back to the account", "खातामा फिर्ता")
                      : isExchange && settle.toRefund > 0
                        ? text("Give back", "ग्राहकलाई फिर्ता")
                        : isExchange || dueAmount > 0
                          ? text("To take", "लिनुपर्ने")
                          : text("Total", "जम्मा")}
                  </span>
                  <span
                    className={`text-3xl font-black ${
                      isReturn || (isExchange && settle.toRefund > 0) ? "text-brand-clay" : "text-brand-green-ink"
                    }`}
                  >
                    {money(
                      isReturn
                        ? totals.total
                        : isExchange
                          ? settle.toRefund > 0
                            ? settle.toRefund
                            : settle.toPay
                          : totals.total + dueAmount,
                    )}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <input
                name="phone"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={
                  needsAccount
                    ? text("Customer's phone (needed)", "ग्राहकको फोन (चाहिन्छ)")
                    : text("Customer's phone (optional)", "ग्राहकको फोन (नचाहिए खाली)")
                }
                aria-label={text("Customer's phone", "ग्राहकको फोन")}
                className={inputClass}
              />
              {phoneAccount ? (
                <p className="rounded-xl bg-brand-green-tint px-3 py-2 text-sm text-brand-green">
                  {text("Known customer:", "पुरानो ग्राहक:")} <b>{phoneAccount.customerName || phoneAccount.label}</b>
                  {phoneAccount.balanceDue && phoneAccount.balanceDue > 0
                    ? text(` · already owes ${money(phoneAccount.balanceDue)}`, ` · पहिलेको बाँकी ${money(phoneAccount.balanceDue)}`)
                    : ""}
                </p>
              ) : null}
              <input
                name="customerName"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder={text("Customer's name (optional)", "ग्राहकको नाम (नचाहिए खाली)")}
                aria-label={text("Customer's name", "ग्राहकको नाम")}
                data-summary="text"
                className={inputClass}
              />
            </div>

            {canCollectDue ? (
              <div className="grid gap-2 rounded-2xl border border-brand-gold bg-brand-cream-soft p-3">
                <label className="flex items-center gap-2 text-sm font-black text-brand-gold-deep">
                  <input
                    type="checkbox"
                    checked={collectDue}
                    onChange={(event) => setCollectDue(event.target.checked)}
                    className="h-5 w-5 accent-brand-green"
                  />
                  {text(`Also take the old credit (${money(oldDue)})`, `पहिलेको बाँकी (${money(oldDue)}) पनि लिने`)}
                </label>
                {collectDue ? (
                  <label className="flex items-center justify-between gap-2 text-sm text-brand-muted">
                    {text("How much of it", "कति लिने")}
                    <input
                      inputMode="numeric"
                      value={dueText}
                      onChange={(event) => setDueText(digits(event.target.value))}
                      placeholder={String(oldDue)}
                      aria-label={text("Old credit to take", "लिने पुरानो बाँकी")}
                      className="h-10 w-28 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-right text-base font-black tabular-nums outline-none focus:border-brand-green"
                    />
                  </label>
                ) : null}
              </div>
            ) : null}

            {!isReturn && (amountDue > 0 || !isExchange) ? (
              <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={text("Payment", "भुक्तानी")}>
                {PAYMENTS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={payment === option}
                    onClick={() => {
                      setPayment(option);
                      setRestMethod("");
                    }}
                    className={`h-11 rounded-xl border text-sm font-black ${
                      payment === option
                        ? option === "Credit"
                          ? "border-brand-gold bg-brand-gold text-brand-green-ink"
                          : "border-brand-green bg-brand-green text-white"
                        : "border-brand-green-line bg-brand-paper-deep text-brand-green-ink"
                    }`}
                  >
                    {payLabel[option]}
                  </button>
                ))}
              </div>
            ) : null}

            {isExchange && settle.toRefund > 0 && outLines.length > 0 ? (
              <p className="rounded-2xl bg-brand-clay-tint px-3 py-3 text-lg font-black text-brand-clay">
                {text(`Give back in cash: ${money(settle.toRefund)}`, `ग्राहकलाई नगद फिर्ता: ${money(settle.toRefund)}`)}
              </p>
            ) : null}

            {plan && payment === "Cash" && amountDue + dueAmount > 0 ? (
              <div className="grid gap-2 rounded-2xl bg-brand-paper-deep p-3">
                <label className="flex items-center justify-between gap-2 text-sm text-brand-muted">
                  {text("Cash handed over", "ग्राहकले दिएको नगद")}
                  <input
                    inputMode="numeric"
                    value={received}
                    onChange={(event) => {
                      setReceived(digits(event.target.value));
                      setRestMethod("");
                    }}
                    placeholder={text("exact", "ठ्याक्कै")}
                    className="h-11 w-32 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-right text-lg font-black tabular-nums text-brand-green-ink outline-none focus:border-brand-green"
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setReceived("");
                      setRestMethod("");
                    }}
                    className="h-9 rounded-full border border-brand-green-line bg-brand-paper px-3 text-sm font-bold"
                  >
                    {text(`Exact ${money(amountDue + dueAmount)}`, `ठ्याक्कै ${money(amountDue + dueAmount)}`)}
                  </button>
                  {likelyNotes(amountDue + dueAmount).map((noteValue) => (
                    <button
                      key={noteValue}
                      type="button"
                      onClick={() => {
                        setReceived(String(noteValue));
                        setRestMethod("");
                      }}
                      className="h-9 rounded-full border border-brand-green-line bg-brand-paper px-3 text-sm font-bold tabular-nums"
                    >
                      {money(noteValue)}
                    </button>
                  ))}
                </div>
                {plan.change > 0 ? (
                  <p className="text-lg font-black text-brand-green">
                    {text(`Change to give: ${money(plan.change)}`, `फिर्ता दिने: ${money(plan.change)}`)}
                  </p>
                ) : received !== "" && Number(received) < amountDue + dueAmount ? (
                  dueAmount > 0 ? (
                    <p className="text-sm font-black text-brand-clay">
                      {text(
                        `Not enough cash for the bill and the old credit together — ${money(amountDue + dueAmount)} is needed.`,
                        `बिल र पुरानो बाँकी दुवैका लागि नगद पुगेन — ${money(amountDue + dueAmount)} चाहिन्छ।`,
                      )}
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      <p className="text-base font-black text-brand-clay">
                        {text(
                          `${money(amountDue - Number(received))} still to pay — how?`,
                          `अझै ${money(amountDue - Number(received))} बाँकी — कसरी?`,
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {([...(paymentsReady ? (["QR", "eSewa", "Khalti", "Bank"] as const) : []), "Credit"] as Payment[]).map((option) => (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={restMethod === option}
                            onClick={() => setRestMethod(restMethod === option ? "" : option)}
                            className={`h-10 rounded-xl border px-3 text-sm font-black ${
                              restMethod === option
                                ? "border-brand-gold bg-brand-gold text-brand-green-ink"
                                : "border-brand-gold bg-brand-cream-soft text-brand-gold-deep"
                            }`}
                          >
                            {option === "Credit" ? text("Rest on credit", "बाँकी उधारोमा") : text(`Rest by ${option}`, `बाँकी ${option} बाट`)}
                          </button>
                        ))}
                      </div>
                      {needsRestReference ? (
                        <input
                          value={restReference}
                          onChange={(event) => setRestReference(event.target.value)}
                          placeholder={text(`${restMethod} transaction number`, `${restMethod} को कारोबार नम्बर`)}
                          aria-label={text(`${restMethod} transaction number`, `${restMethod} को कारोबार नम्बर`)}
                          className={inputClass}
                        />
                      ) : null}
                    </div>
                  )
                ) : (
                  <p className="text-sm font-bold text-brand-green">{text("Exact money ✓", "ठ्याक्कै पैसा ✓")}</p>
                )}
              </div>
            ) : null}

            {needsReference ? (
              <input
                name="paymentReference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder={text(`${payment} transaction number`, `${payment} को कारोबार नम्बर`)}
                aria-label={text(`${payment} transaction number`, `${payment} को कारोबार नम्बर`)}
                className={inputClass}
              />
            ) : null}

            {needsAccount && cart.length > 0 ? (
              <div className="grid gap-2 rounded-2xl border border-brand-gold bg-brand-cream-soft p-3">
                <p className="text-sm font-black text-brand-gold-deep">
                  {isReturn
                    ? text("Whose account does the return go to?", "फिर्ता कसको खातामा जान्छ?")
                    : text(`${money(creditAmount)} on credit — whose account?`, `उधारो ${money(creditAmount)} — कसको खातामा?`)}
                </p>
                {account ? (
                  <p className="text-sm text-brand-green-ink">
                    ✓ {account.label}
                    {!ledgerId && phoneAccount ? text(" (found by phone)", " (फोनबाट भेटियो)") : ""}
                  </p>
                ) : null}
                <select
                  value={ledgerId}
                  onChange={(event) => setLedgerId(event.target.value)}
                  aria-label={text("Customer account", "ग्राहकको खाता")}
                  className={inputClass}
                >
                  <option value="">
                    {phoneAccount ? text("Use the account found by phone", "फोनबाट भेटिएको खाता") : text("Pick an account", "खाता छान्नुहोस्")}
                  </option>
                  {ledgerOptions.map((ledger) => (
                    <option key={ledger.id} value={ledger.id}>
                      {ledger.label}
                    </option>
                  ))}
                </select>
                {!account ? (
                  canOpenLedger ? (
                    <button
                      type="button"
                      onClick={openLedger}
                      disabled={isOpeningLedger || !customerName.trim()}
                      className="h-10 rounded-xl bg-brand-gold-deep px-3 text-sm font-black text-white disabled:opacity-60"
                    >
                      {customerName.trim()
                        ? text(`+ Open an account for ${customerName.trim()}`, `+ ${customerName.trim()} को नयाँ खाता खोल्ने`)
                        : text("+ New account — type the name above first", "+ नयाँ खाता — पहिले माथि नाम लेख्नुहोस्")}
                    </button>
                  ) : (
                    <p className="text-xs font-semibold text-brand-gold-deep">
                      {text(
                        "Ask the Owner or a Manager to open the account, in /admin/operations.",
                        "नयाँ खाता खोल्न मालिक वा Manager लाई भन्नुहोस् — /admin/operations मा।",
                      )}
                    </p>
                  )
                ) : null}
                {ledgerNote ? <p className="text-xs font-semibold text-brand-gold-deep">{ledgerNote}</p> : null}
              </div>
            ) : null}

            <details className="rounded-2xl border border-brand-green-line px-3 py-2">
              <summary className="cursor-pointer text-sm text-brand-muted">
                {text("More: seller, address, PAN, tax, note", "थप: बेच्ने, ठेगाना, PAN, कर, नोट")}
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  name="cashier"
                  value={cashier}
                  onChange={(event) => setCashier(event.target.value)}
                  placeholder={text("Sold by", "कसले बेच्यो")}
                  aria-label={text("Sold by", "कसले बेच्यो")}
                  className={inputClass}
                />
                <input name="customerAddress" placeholder={text("Address", "ठेगाना")} aria-label={text("Customer address", "ग्राहकको ठेगाना")} className={inputClass} />
                <input name="customerPan" placeholder={text("PAN (wholesale)", "PAN (थोक)")} aria-label={text("Customer PAN", "ग्राहकको PAN")} className={inputClass} />
                <input
                  name="tax"
                  inputMode="numeric"
                  value={tax}
                  onChange={(event) => setTax(digits(event.target.value))}
                  placeholder={text("Tax in rupees (if any)", "कर रकम (भए मात्र)")}
                  aria-label={text("Tax", "कर")}
                  className={inputClass}
                />
                <div className="sm:col-span-2" data-enter-skip>
                  <textarea
                    name="note"
                    placeholder={text("Note: delivery, exchange, anything", "नोट: डेलिभरी, साटफेर, अरू कुरा")}
                    aria-label={text("Note", "नोट")}
                    className="min-h-20 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2 text-base outline-none focus:border-brand-green"
                  />
                </div>
              </div>
            </details>

            {belowCostLines.length > 0 && !isReturn ? (
              <p className="text-xs font-bold text-brand-clay">
                {text(
                  `${belowCostLines.length} line(s) below cost. Check before saving.`,
                  `${belowCostLines.length} लाइन लागतभन्दा तल छ। राख्नुअघि हेर्नुहोस्।`,
                )}
              </p>
            ) : null}

            <ActionMessage state={state} linkLabel={text("Open receipt", "रसिद खोल्ने")} />

            <div className="sticky bottom-0 -mx-4 grid gap-2 border-t border-brand-green-line bg-brand-paper px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 md:static md:mx-0 md:border-0 md:p-0">
              <button
                type="submit"
                disabled={isSaving || saveLocked || Boolean(blocked)}
                className={`min-h-14 w-full rounded-2xl px-4 text-lg font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isReturn ? "bg-brand-clay" : "bg-brand-green-ink hover:bg-brand-green"
                }`}
              >
                {saveLabel}
                <span className="ml-2 hidden font-mono text-xs opacity-70 md:inline">F9</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={holdBill}
                  disabled={cart.length === 0}
                  className="h-11 rounded-xl border border-brand-green-line text-sm font-bold text-brand-green-ink disabled:opacity-50"
                >
                  ⏸ {text("Hold", "होल्ड")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (cart.length === 0) return;
                    setUndo({ label: text("Bill cleared", "बिल खाली गरियो"), cart });
                    setCart([]);
                    setStartedAt(null);
                  }}
                  disabled={cart.length === 0}
                  className="h-11 rounded-xl border border-brand-green-line text-sm font-bold text-brand-green-ink disabled:opacity-50"
                >
                  ✕ {text("Clear", "खाली गर्ने")}
                </button>
              </div>
            </div>
          </EnterWalkForm>
        </aside>
      </div>

      {!cartOpen ? (
        <div className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 rounded-2xl border border-brand-green-line bg-brand-paper px-4 py-2.5 shadow-[0_12px_40px_rgba(16,35,29,0.18)] md:hidden print:hidden">
          <div className="tabular-nums">
            <p className="text-xs text-brand-muted">{text(`${totals.pairs} pairs`, `${totals.pairs} जोडा`)}</p>
            <p className="text-xl font-black text-brand-green-ink">{money(totals.total)}</p>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="h-12 rounded-xl bg-brand-green px-5 text-base font-black text-white"
          >
            {text("Open bill ▲", "बिल हेर्ने ▲")}
          </button>
        </div>
      ) : null}

      {picking ? (
        <PosSizeSheet
          item={picking}
          cart={cart}
          channel={channel}
          returning={isReturn || (isExchange && addingBack)}
          onClose={() => {
            setPicking(null);
            searchRef.current?.focus();
          }}
          onPick={(size, color) => {
            add(picking, size, color);
            setPicking(null);
          }}
          onPickSet={(sizes, color) => {
            let next = cart;
            for (const size of sizes) {
              if (canAddPair(picking, size, next)) next = addPair(next, picking, channel, size, color);
            }
            setCart(next);
            setStartedAt((value) => value ?? Date.now());
            setNote(text(`Added a set of ${sizes.length} pairs.`, `${sizes.length} जोडाको सेट थपियो।`));
            setPicking(null);
          }}
        />
      ) : null}
    </div>
  );
}
