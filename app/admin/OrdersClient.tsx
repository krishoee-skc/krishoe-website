"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type {
  OnlineOrderConversionReport,
  OnlineOrderConversionRow,
  OnlineOrderConversionSignal,
} from "@/lib/order-pos";
import { money } from "@/lib/format-money";
import type { CustomerLedger } from "@/lib/operations";
import type { PaymentTransaction } from "@/lib/payment-transactions";
import type { OrderSubmission } from "@/lib/submissions";
import { parseOrderTotalRupees } from "@/lib/payment-amount";
import {
  cancelOrderWithReasonAction,
  clearOrderDispatchAction,
  createPosInvoiceFromOrderAction,
  markCustomerPhoneVerifiedFromOrderAction,
  markOrderDispatchedAction,
  updateOrderPaymentAction,
  updateOrderStatusAction,
  type ActionState,
} from "./actions";
import {
  orderStatuses as ORDER_STATUSES,
  paymentProviders as PAYMENT_PROVIDERS,
  paymentStatuses as PAYMENT_STATUSES,
} from "@/lib/order-constants";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import EnterWalkForm from "@/components/admin/EnterWalkForm";
import { useLanguage } from "@/components/LanguageProvider";
import type { OrderDispatch } from "@/lib/order-dispatch";

type OrderPosInvoiceLink = {
  id: string;
  invoiceNumber: string;
};

const POS_PAYMENT_METHODS = ["Cash", "Cheque", "Credit", "QR", "eSewa", "Khalti", "Bank"] as const;
function OrderStatusSelector({ order }: { order: OrderSubmission }) {
  const [state, setState] = useState<ActionState>({ ok: true, message: "" });
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const formData = new FormData();
    formData.append("id", order.id);
    formData.append("status", e.target.value);
    startTransition(async () => {
      setState(await updateOrderStatusAction(state, formData));
    });
  };

  return (
    <select
      aria-label={`Status for order ${order.id}`}
      defaultValue={order.status}
      onChange={handleStatusChange}
      disabled={isPending}
      className="rounded-md border-brand-green-line text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
    >
      {ORDER_STATUSES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}

function amountFromOrderTotal(total: string) {
  return parseOrderTotalRupees(total);
}


function conversionTone(signal: OnlineOrderConversionSignal) {
  if (signal === "Converted") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (signal === "Not converted") return "border-sky-200 bg-sky-50 text-sky-800";
  if (signal === "Needs ledger") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function ConversionPill({ signal }: { signal: OnlineOrderConversionSignal }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${conversionTone(signal)}`}>
      {signal}
    </span>
  );
}

function defaultPosPaymentMethod(order: OrderSubmission): (typeof POS_PAYMENT_METHODS)[number] {
  if (order.paymentProvider === "esewa") return "eSewa";
  if (order.paymentProvider === "khalti") return "Khalti";
  if (order.paymentProvider === "bank") return "Bank";
  return "Cash";
}

function OrderPaymentForm({
  order,
  customerLedgers,
  transactions,
}: {
  order: OrderSubmission;
  customerLedgers: CustomerLedger[];
  transactions: PaymentTransaction[];
}) {
  const [state, setState] = useState<ActionState>({ ok: true, message: "" });
  const [isPending, startTransition] = useTransition();
  const latestTransaction = transactions[0];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setState(await updateOrderPaymentAction(state, formData));
    });
  };

  return (
    <div className="grid min-w-[560px] gap-3">
      <EnterWalkForm onSubmit={handleSubmit} className="grid gap-2">
        <input type="hidden" name="id" value={order.id} />
        <div className="grid grid-cols-3 gap-2">
          <select aria-label="Payment status"
            name="paymentStatus" data-summary="text"
            defaultValue={order.paymentStatus}
            disabled={isPending}
            className="rounded-md border-brand-green-line text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select aria-label="Payment provider"
            name="paymentProvider"
            defaultValue={order.paymentProvider}
            disabled={isPending}
            className="rounded-md border-brand-green-line text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            {PAYMENT_PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {provider.toUpperCase()}
              </option>
            ))}
          </select>
          <input aria-label="Amount"
            name="paymentAmount" data-summary="money"
            type="number"
            min="0"
            defaultValue={latestTransaction?.amount ?? amountFromOrderTotal(order.total)}
            disabled={isPending}
            placeholder="Amount"
            className="min-w-0 rounded-md border-brand-green-line text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <select aria-label="Account"
            name="ledgerId"
            defaultValue={order.paymentLedgerId ?? latestTransaction?.ledgerId ?? ""}
            disabled={isPending}
            className="rounded-md border-brand-green-line text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            <option value="">No ledger</option>
            {customerLedgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>
                {ledger.customerName}
              </option>
            ))}
          </select>
          <input aria-label="Reference"
            name="paymentReference"
            defaultValue={order.paymentReference ?? ""}
            placeholder="Reference"
            disabled={isPending}
            className="min-w-0 rounded-md border-brand-green-line text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
          <input aria-label="Transaction ID"
            name="paymentTransactionId"
            defaultValue={order.paymentTransactionId ?? ""}
            placeholder="Transaction ID"
            disabled={isPending}
            className="min-w-0 rounded-md border-brand-green-line text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
          <input aria-label="Callback ID"
            name="paymentCallbackId"
            defaultValue={order.paymentCallbackId ?? ""}
            placeholder="Callback ID"
            disabled={isPending}
            className="min-w-0 rounded-md border-brand-green-line text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>
        <input aria-label="Payment note"
          name="paymentNote"
          defaultValue=""
          placeholder="Payment note"
          disabled={isPending}
          className="min-w-0 rounded-md border-brand-green-line text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        />
        <div className="flex items-center justify-between gap-3">
          <p className={`text-xs ${state.ok ? "text-brand-muted" : "text-red-600"}`}>
            {state.message ||
              (order.paymentVerifiedAt
                ? "Verified"
                : "Not verified")}
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-brand-green-ink px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-green disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving" : "Save"}
          </button>
        </div>
      </EnterWalkForm>

      <div className="grid gap-1 text-xs text-brand-muted">
        {transactions.slice(0, 3).map((transaction) => {
          const ledger = customerLedgers.find((item) => item.id === transaction.ledgerId);

          return (
            <div key={transaction.id} className="rounded-md bg-brand-paper-deep px-2 py-1.5">
              <span className="font-bold text-brand-green-ink">{transaction.paymentStatus}</span>
              <span> - {transaction.paymentProvider.toUpperCase()}</span>
              <span> - {money(transaction.amount)}</span>
              {ledger ? <span> - {ledger.customerName}</span> : null}
              {transaction.paymentTransactionId ? (
                <span> - {transaction.paymentTransactionId}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomerTrustForm({ order }: { order: OrderSubmission }) {
  const [state, setState] = useState<ActionState>({ ok: true, message: "" });
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setState(await markCustomerPhoneVerifiedFromOrderAction(state, formData));
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 grid gap-1">
      <input type="hidden" name="id" value={order.id} />
      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded-full border border-brand-green px-2.5 py-1 text-[11px] font-black text-brand-green transition hover:bg-brand-mist disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Verifying" : "Verify phone"}
      </button>
      {state.message ? (
        <p className={`max-w-[220px] text-[11px] font-semibold ${state.ok ? "text-brand-muted" : "text-red-600"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function OrderToPosForm({
  order,
  customerLedgers,
  posInvoice,
  conversionRow,
}: {
  order: OrderSubmission;
  customerLedgers: CustomerLedger[];
  posInvoice: OrderPosInvoiceLink | null;
  conversionRow: OnlineOrderConversionRow;
}) {
  const [state, setState] = useState<ActionState>({ ok: true, message: "" });
  const [isPending, startTransition] = useTransition();

  if (posInvoice) {
    return (
      <div className="grid gap-2">
        <Link
          href={`/admin/pos/${posInvoice.id}`}
          className="inline-flex h-9 items-center rounded-full border border-brand-green px-3 text-xs font-black text-brand-green transition hover:bg-brand-green hover:text-white"
        >
          {posInvoice.invoiceNumber}
        </Link>
        <p className="text-xs font-semibold text-brand-muted">{conversionRow.pairCount} pairs posted</p>
      </div>
    );
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setState(await createPosInvoiceFromOrderAction(state, formData));
    });
  };

  return (
    <EnterWalkForm onSubmit={handleSubmit} className="grid min-w-[360px] gap-2">
      <input type="hidden" name="id" value={order.id} />
      <div className="grid grid-cols-3 gap-2">
        <select aria-label="Payment method"
          name="posPaymentMethod"
          defaultValue={defaultPosPaymentMethod(order)}
          disabled={isPending}
          className="rounded-md border-brand-green-line text-xs shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        >
          {POS_PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
        <input aria-label="Paid"
          name="paidAmount"
          type="number"
          min="0"
          defaultValue={order.paymentStatus === "Paid" ? amountFromOrderTotal(order.total) : 0}
          disabled={isPending}
          placeholder="Paid"
          className="min-w-0 rounded-md border-brand-green-line text-xs shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        />
        <input aria-label="Cashier"
          name="cashier"
          defaultValue="Online"
          disabled={isPending}
          placeholder="Cashier"
          className="min-w-0 rounded-md border-brand-green-line text-xs shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Account"
          name="ledgerId"
          defaultValue={order.paymentLedgerId ?? ""}
          disabled={isPending}
          className="rounded-md border-brand-green-line text-xs shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        >
          <option value="">No ledger</option>
          {customerLedgers.map((ledger) => (
            <option key={ledger.id} value={ledger.id}>
              {ledger.customerName}
            </option>
          ))}
        </select>
        <input aria-label="Payment ref"
          name="paymentReference"
          defaultValue={order.paymentReference ?? ""}
          disabled={isPending}
          placeholder="Payment ref"
          className="min-w-0 rounded-md border-brand-green-line text-xs shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-xs ${state.ok ? "text-brand-muted" : "text-red-600"}`}>
          {state.message || conversionRow.detail}
        </p>
        {state.href ? (
          <Link href={state.href} className="text-xs font-black text-brand-green underline underline-offset-4">
            Open
          </Link>
        ) : null}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-brand-green px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-green-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Creating" : "To POS"}
        </button>
      </div>
    </EnterWalkForm>
  );
}

type ParsedOrderItem = {
  design: string;
  sizeRun: string;
  color: string;
  quantity: number;
  rate: number;
  lineTotal: number;
};

/**
 * Where an order stands, as the five steps the owner works through.
 *
 * Read from what is already stored: the status, whether it was sent
 * (lib/order-dispatch.ts) and whether it has a bill. "Reached, money in" and
 * "bill made" are one press — the bill is made when the money comes — so an
 * order is never left sitting on step 4.
 */
type Stage = 0 | 1 | 2 | 4 | "cancelled";
const STEPS = [
  { en: "New", ne: "नयाँ", icon: "🆕" },
  { en: "Called", ne: "फोन गरियो", icon: "📞" },
  { en: "Sent", ne: "पठाइयो", icon: "🚚" },
  { en: "Reached, money in", ne: "पुग्यो र पैसा आयो", icon: "💰" },
  { en: "Bill made", ne: "बिल बन्यो", icon: "🧾" },
] as const;

function stageOf(order: OrderSubmission, dispatch: OrderDispatch | undefined, hasBill: boolean): Stage {
  if (hasBill || order.status === "Closed") return 4;
  if (order.status === "Cancelled") return "cancelled";
  if (dispatch?.dispatchedAt) return 2;
  if (order.status === "Contacted") return 1;
  return 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CANCEL_REASONS = [
  { en: "Did not answer the phone", ne: "फोन उठाएन" },
  { en: "Size did not fit", ne: "साइज मिलेन" },
  { en: "Customer cancelled", ne: "ग्राहक आफैँले रद्द गरे" },
  { en: "Not a real order", ne: "नक्कली अर्डर" },
] as const;
const DISPATCH_BY = ["Own person", "Upaya Courier", "Pathao", "Nepal Can Move"] as const;

/** Digits only, with Nepal's code on a ten-digit mobile — what wa.me wants. */
function whatsappNumber(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length === 10 ? `977${digits}` : digits;
}

/** What to send the customer at each step, in the language the desk is read in. */
function whatsappText(
  text: (en: string, ne: string) => string,
  stage: Stage,
  name: string,
  /** What the customer still hands over; empty when it was paid online. */
  toPay: string,
  by: string,
) {
  if (stage === 0) {
    return text(
      `Hello ${name}, thank you for your KRISHOE order. We are calling to confirm your address and size.`,
      `नमस्ते ${name} जी, KRISHOE मा अर्डर गर्नुभएकोमा धन्यवाद। तपाईंको ठेगाना र साइज पक्का गर्न फोन गर्दैछौँ।`,
    );
  }
  if (stage === 1) {
    return text(
      `${name}, your order is confirmed. We will pack and send it soon.`,
      `${name} जी, तपाईंको अर्डर पक्का भयो। चाँडै प्याक गरेर पठाउँछौँ।`,
    );
  }
  if (stage === 2) {
    return text(
      `${name}, your order is on its way${by ? ` (${by})` : ""}.${toPay ? ` To pay: ${toPay}.` : " It is already paid."}`,
      `${name} जी, तपाईंको अर्डर पठाइयो${by ? ` (${by})` : ""}।${toPay ? ` लिनुपर्ने रकम: ${toPay}।` : " पैसा तिरिसक्नुभएको छ।"}`,
    );
  }
  if (stage === 4) {
    return text(
      `${name}, thank you for choosing KRISHOE! Tell us how the shoes feel. 🙏`,
      `${name} जी, KRISHOE रोज्नुभएकोमा धन्यवाद! जुत्ता कस्तो लाग्यो, भन्नुहोला। 🙏`,
    );
  }
  return text(`${name}, we wanted to talk about your order.`, `${name} जी, तपाईंको अर्डरबारे कुरा गर्नु थियो।`);
}

export default function OrdersClient({
  orders,
  customerLedgers,
  paymentTransactions,
  posInvoicesByOrderId,
  conversionReport,
  parsedItemsByOrderId,
  dispatchById,
  dispatchReady,
}: {
  orders: OrderSubmission[];
  customerLedgers: CustomerLedger[];
  paymentTransactions: PaymentTransaction[];
  posInvoicesByOrderId: Record<string, OrderPosInvoiceLink | null>;
  conversionReport: OnlineOrderConversionReport;
  parsedItemsByOrderId: Record<string, ParsedOrderItem[]>;
  dispatchById: Record<string, OrderDispatch>;
  dispatchReady: boolean;
}) {
  const { text } = useLanguage();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "todo" | "sent" | "done" | "cancelled">("all");
  const conversionByOrderId = new Map(conversionReport.rows.map((row) => [row.orderId, row]));
  // Rendered once per page load; "late" is a day-old New order, so a clock
  // read at render is exact enough and keeps the list stable while typed in.
  const [now] = useState(() => Date.now());

  const rows = orders.map((order) => {
    const posInvoice = posInvoicesByOrderId[order.id] ?? null;
    const dispatch = dispatchById[order.id];
    const stage = stageOf(order, dispatch, Boolean(posInvoice));
    const created = new Date(order.createdAt).getTime();
    const late = stage === 0 && Number.isFinite(created) && now - created > DAY_MS;
    return { order, posInvoice, dispatch, stage, late, rupees: amountFromOrderTotal(order.total) };
  });

  const needle = search.trim().toLowerCase();
  const visible = rows.filter(({ order, stage }) => {
    if (needle && ![order.name, order.phone, order.id, order.email ?? ""].some((value) => value.toLowerCase().includes(needle))) {
      return false;
    }
    if (filter === "todo") return stage === 0 || stage === 1;
    if (filter === "sent") return stage === 2;
    if (filter === "done") return stage === 4;
    if (filter === "cancelled") return stage === "cancelled";
    return true;
  });

  // The order that needs a hand first is open when the page opens.
  const firstOpen = rows.find((row) => row.late) ?? rows.find((row) => row.stage === 0 || row.stage === 1 || row.stage === 2) ?? rows[0];
  const [selectedId, setSelectedId] = useState(firstOpen?.order.id ?? "");
  const selected = rows.find((row) => row.order.id === selectedId) ?? visible[0];

  const lateCount = rows.filter((row) => row.late).length;
  const toCall = rows.filter((row) => row.stage === 0).length;
  const onTheWay = rows.filter((row) => row.stage === 2).length;
  const unpaid = rows
    .filter((row) => row.stage !== 4 && row.stage !== "cancelled" && row.order.paymentStatus !== "Paid")
    .reduce((total, row) => total + row.rupees, 0);

  const count = (value: typeof filter) =>
    value === "all" ? rows.length : rows.filter((row) =>
      value === "todo" ? row.stage === 0 || row.stage === 1
        : value === "sent" ? row.stage === 2
          : value === "done" ? row.stage === 4
            : row.stage === "cancelled").length;

  return (
    <div className="mt-6 space-y-4">
      {/* Today's work, before any list. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`rounded-xl border p-3 ${lateCount ? "border-red-200 bg-red-50" : "border-brand-green-line bg-brand-paper"}`}>
          <p className="text-xs font-bold text-brand-muted">⏰ {text("New for over a day", "२४ घण्टाभन्दा पुराना नयाँ")}</p>
          <p className={`text-2xl font-black ${lateCount ? "text-red-800" : "text-brand-green-ink"}`}>{lateCount}</p>
        </div>
        <div className="rounded-xl border border-brand-green-line bg-brand-paper p-3">
          <p className="text-xs font-bold text-brand-muted">📞 {text("Still to call", "फोन गर्न बाँकी")}</p>
          <p className="text-2xl font-black text-brand-green-ink">{toCall}</p>
        </div>
        <div className="rounded-xl border border-brand-green-line bg-brand-paper p-3">
          <p className="text-xs font-bold text-brand-muted">🚚 {text("On the way", "बाटोमा")}</p>
          <p className="text-2xl font-black text-brand-green-ink">{onTheWay}</p>
        </div>
        <div className="rounded-xl border border-brand-green-line bg-brand-paper p-3">
          <p className="text-xs font-bold text-brand-muted">💰 {text("Money still to come", "पैसा आउन बाँकी")}</p>
          <p className="text-2xl font-black text-brand-green-ink">{money(unpaid)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={text("Find an order", "अर्डर खोज्ने")}
          placeholder={text("🔍 Phone, name or order number…", "🔍 फोन, नाम वा अर्डर नम्बर…")}
          className="h-11 min-w-0 flex-1 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-sm sm:min-w-64"
        />
        {([
          ["all", text("All", "सबै")],
          ["todo", text("To do", "गर्न बाँकी")],
          ["sent", text("On the way", "बाटोमा")],
          ["done", text("Done", "सकियो")],
          ["cancelled", text("Cancelled", "रद्द")],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`h-9 rounded-full border px-3 text-xs font-black transition ${
              filter === value
                ? "border-brand-green-ink bg-brand-green-ink text-white"
                : "border-brand-green-line bg-brand-paper text-brand-green-ink hover:border-brand-green"
            }`}
          >
            {label} {count(value)}
          </button>
        ))}
      </div>

      {!dispatchReady ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          🚚 {text(
            "To mark orders sent, the Owner prepares the database once: Settings → \"Prepare the database for sending orders\". Everything else works now.",
            "अर्डर \"पठाइयो\" भन्न Owner ले एकपटक database तयार गर्नुपर्छ: Settings → \"अर्डर पठाउने कामको लागि database तयार गर्ने\"। अरू सबै अहिले नै चल्छ।",
          )}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
        {/* The list: who, how much, where it stands. */}
        <ul className="grid list-none content-start gap-2 pl-0">
          {visible.map(({ order, stage, late, rupees }) => {
            const active = selected?.order.id === order.id;
            const step = stage === "cancelled" ? null : STEPS[stage];
            return (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(order.id)}
                  aria-current={active ? "true" : undefined}
                  className={`grid w-full gap-0.5 rounded-xl border px-3 py-2 text-left transition ${
                    active ? "border-brand-green bg-brand-green-wash" : "border-brand-green-line bg-brand-paper hover:border-brand-green"
                  }`}
                >
                  <span className="flex justify-between gap-2 font-black text-brand-green-ink">
                    <span className="truncate">{order.name}</span>
                    <span className="shrink-0 tabular-nums">{money(rupees)}</span>
                  </span>
                  <span className="flex justify-between gap-2 text-xs text-brand-muted">
                    <span className="truncate">{order.phone}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 font-black ${
                        late ? "bg-red-100 text-red-800"
                          : stage === 4 ? "bg-emerald-50 text-emerald-800"
                            : stage === "cancelled" ? "bg-brand-mist text-brand-muted"
                              : "bg-amber-50 text-amber-900"
                      }`}
                    >
                      {late ? `⏰ ${text("Late", "ढिलो")}` : step ? `${step.icon} ${text(step.en, step.ne)}` : `✖ ${text("Cancelled", "रद्द")}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {visible.length === 0 ? (
            <li className="rounded-xl border border-brand-green-line bg-brand-paper px-4 py-6 text-center text-sm text-brand-muted">
              {text("No order here.", "यहाँ कुनै अर्डर छैन।")}
            </li>
          ) : null}
        </ul>

        {selected ? (
          <OrderDetail
            key={selected.order.id}
            row={selected}
            items={parsedItemsByOrderId[selected.order.id] ?? []}
            conversionRow={conversionByOrderId.get(selected.order.id)}
            customerLedgers={customerLedgers}
            transactions={paymentTransactions.filter((transaction) => transaction.orderId === selected.order.id)}
            dispatchReady={dispatchReady}
          />
        ) : null}
      </div>
    </div>
  );
}

function OrderDetail({
  row,
  items,
  conversionRow,
  customerLedgers,
  transactions,
  dispatchReady,
}: {
  row: {
    order: OrderSubmission;
    posInvoice: OrderPosInvoiceLink | null;
    dispatch: OrderDispatch | undefined;
    stage: Stage;
    late: boolean;
    rupees: number;
  };
  items: ParsedOrderItem[];
  conversionRow: OnlineOrderConversionRow | undefined;
  customerLedgers: CustomerLedger[];
  transactions: PaymentTransaction[];
  dispatchReady: boolean;
}) {
  const { text } = useLanguage();
  const { order, posInvoice, dispatch, stage, rupees } = row;
  const [state, setState] = useState<ActionState>({ ok: true, message: "" });
  const [isPending, startTransition] = useTransition();
  const [dispatchBy, setDispatchBy] = useState<string>(DISPATCH_BY[0]);
  const [dispatchCharge, setDispatchCharge] = useState("");
  const [dispatchTracking, setDispatchTracking] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [printing, setPrinting] = useState(false);

  const missingDesigns = (conversionRow?.missingStockItems ?? []).map((line) => line.split(":")[0].trim().toLowerCase());
  const stockShort = conversionRow?.signal === "Needs stock";
  const paidOnline = order.paymentStatus === "Paid";

  const run = (action: typeof updateOrderStatusAction, fields: Record<string, string>) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.append(key, value);
    startTransition(async () => {
      setState(await action(state, formData));
    });
  };

  const makeBill = () =>
    run(createPosInvoiceFromOrderAction, {
      id: order.id,
      posPaymentMethod: defaultPosPaymentMethod(order),
      // The money has come: the whole total, unless it was paid online already
      // (then the online payment is the paid amount, recorded the same way).
      paidAmount: String(rupees),
      cashier: "Online",
      ledgerId: order.paymentLedgerId ?? "",
      paymentReference: order.paymentReference ?? "",
    });

  const phoneDigits = whatsappNumber(order.phone);
  const message = whatsappText(text, stage, order.name, paidOnline ? "" : money(rupees), dispatch?.dispatchBy ?? "");

  return (
    <article className="grid content-start gap-4 rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-black text-brand-green-ink">{order.name}</p>
          <p className="text-xs text-brand-muted">
            <span className="font-mono">{order.id}</span> · <DateDisplayAdmin date={order.createdAt} />
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
            <a href={`tel:${order.phone.replace(/[^\d+]/g, "")}`} className="rounded-lg border border-brand-green px-2.5 py-1 text-brand-green">
              📞 {order.phone}
            </a>
            <a
              href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-brand-green px-2.5 py-1 text-brand-green"
            >
              💬 WhatsApp
            </a>
            {order.address ? <span className="rounded-lg bg-brand-mist px-2.5 py-1 text-brand-muted-deep">📍 {order.address}</span> : null}
          </div>
          <CustomerTrustForm order={order} />
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-black text-brand-green-ink">{money(rupees)}</p>
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-black ${paidOnline || stage === 4 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
            {paidOnline || stage === 4
              ? text("Money in ✓", "पैसा आयो ✓")
              : order.paymentProvider === "cod"
                ? text("Cash on delivery · to come", "नगद घरमा (COD) · आउन बाँकी")
                : text("Not paid yet", "पैसा आउन बाँकी")}
          </span>
        </div>
      </div>

      {/* The five steps. */}
      {stage === "cancelled" ? (
        <p className="rounded-xl bg-brand-mist px-4 py-3 text-sm font-bold text-brand-muted-deep">
          ✖ {text("Cancelled", "रद्द गरियो")}
          {dispatch?.cancelReason ? ` — ${dispatch.cancelReason}` : ""}
        </p>
      ) : (
        <ol className="grid list-none grid-cols-5 gap-1 pl-0 text-center text-[11px] font-bold">
          {STEPS.map((step, index) => {
            const done = index < stage || stage === 4;
            const now = index === stage;
            return (
              <li key={step.en} className={done ? "text-emerald-700" : now ? "text-brand-green-ink" : "text-brand-muted"}>
                <span
                  className={`mx-auto mb-1 block h-2 rounded-full ${done ? "bg-emerald-600" : now ? "bg-brand-gold" : "bg-brand-green-line"}`}
                  aria-hidden="true"
                />
                {step.icon} {text(step.en, step.ne)}
              </li>
            );
          })}
        </ol>
      )}

      {/* What is in it, and whether each is on the shelf. */}
      {items.length === 0 ? (
        <p className="whitespace-pre-line rounded-md bg-brand-paper-deep p-3 text-xs leading-6 text-brand-muted">{order.order}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-green-line text-[10px] font-black uppercase tracking-wider text-brand-muted">
                <th className="px-1 py-1 text-left">{text("Shoe", "जुत्ता")}</th>
                <th className="px-1 py-1 text-center">{text("Size", "साइज")}</th>
                <th className="px-1 py-1 text-left">{text("Colour", "रङ")}</th>
                <th className="px-1 py-1 text-center">{text("Pairs", "जोडी")}</th>
                <th className="px-1 py-1 text-right">Rs.</th>
                <th className="px-1 py-1 text-right">{text("Stock", "स्टक")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const short = missingDesigns.includes(item.design.trim().toLowerCase());
                return (
                  <tr key={`${item.design}-${index}`} className="border-b border-dashed border-brand-green-line/60 last:border-0">
                    <td className="px-1 py-2 font-semibold text-brand-green-ink">{item.design}</td>
                    <td className="px-1 py-2 text-center font-mono text-xs font-bold">{item.sizeRun}</td>
                    <td className="px-1 py-2 text-xs text-brand-muted">{item.color || "—"}</td>
                    <td className="px-1 py-2 text-center font-mono text-xs">{item.quantity}</td>
                    <td className="px-1 py-2 text-right font-mono text-xs font-bold">{item.lineTotal.toLocaleString()}</td>
                    <td className={`px-1 py-2 text-right text-xs font-black ${short ? "text-red-700" : "text-emerald-700"}`}>
                      {short ? text("✗ short", "✗ छैन") : text("✓ here", "✓ छ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {state.message ? (
        <p role="status" className={`rounded-lg px-3 py-2 text-sm font-bold ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {state.message}
          {state.href ? (
            <>
              {" "}
              <Link href={state.href} className="underline">{text("Open", "खोल्ने")}</Link>
            </>
          ) : null}
        </p>
      ) : null}

      {/* The one next step. */}
      {stage === 4 ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
          ✅ {text("Bill made", "बिल बन्यो")}
          {posInvoice ? (
            <>
              {": "}
              <Link href={`/admin/pos/${posInvoice.id}`} className="underline">{posInvoice.invoiceNumber}</Link>
            </>
          ) : null}
        </p>
      ) : stage === "cancelled" ? null : (
        <div className="grid gap-3">
          {stockShort ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
              ✗ {text("Not enough on the shelf:", "स्टकमा पुगेन:")} {(conversionRow?.missingStockItems ?? []).join("; ")}
              <br />
              {text(
                "Call the customer about another size or colour, or wait until it is made. The bill cannot be made until the pairs are here.",
                "ग्राहकलाई फोन गरेर अर्को साइज/रङ सोध्नुहोस्, वा बनेपछि पठाउनुहोस्। जोडी नआएसम्म बिल बन्दैन।",
              )}
            </p>
          ) : null}

          {stage === 0 ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              📞 {text("Call the customer to confirm the address and size.", "ग्राहकलाई फोन गरेर ठेगाना र साइज पक्का गर्नुहोस्।")}
            </p>
          ) : null}

          {stage === 1 ? (
            <div className="grid gap-3 rounded-xl border border-dashed border-brand-green-line p-3">
              <p className="text-sm font-black text-brand-green-ink">🚚 {text("Sending it", "पठाउने विवरण")}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="grid gap-1 text-xs font-bold text-brand-muted">
                  {text("Who takes it", "कसले लग्यो")}
                  <select value={dispatchBy} onChange={(event) => setDispatchBy(event.target.value)} className="h-11 rounded-lg border border-brand-green-line bg-brand-paper px-2 text-sm text-brand-green-ink">
                    {DISPATCH_BY.map((by) => (
                      <option key={by} value={by}>{by === "Own person" ? text("Our own person", "आफ्नै मान्छे") : by}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-bold text-brand-muted">
                  {text("Delivery charge (Rs.)", "डेलिभरी शुल्क (रु.)")}
                  <input value={dispatchCharge} onChange={(event) => setDispatchCharge(event.target.value)} inputMode="numeric" placeholder="150" className="h-11 rounded-lg border border-brand-green-line bg-brand-paper px-2 text-sm text-brand-green-ink" />
                </label>
                <label className="grid gap-1 text-xs font-bold text-brand-muted">
                  {text("Courier number (optional)", "कुरियरको नम्बर (चाहे)")}
                  <input value={dispatchTracking} onChange={(event) => setDispatchTracking(event.target.value)} className="h-11 rounded-lg border border-brand-green-line bg-brand-paper px-2 text-sm text-brand-green-ink" />
                </label>
              </div>
              <button type="button" onClick={() => setPrinting(true)} className="w-fit rounded-lg border border-brand-green-line px-3 py-1.5 text-xs font-black text-brand-green-ink">
                🖨️ {text("Packing slip", "प्याकिङ स्लिप")}
              </button>
            </div>
          ) : null}

          {printing ? (
            <div className="print-slip max-w-sm rounded-lg border-2 border-brand-green-ink bg-white p-4 text-sm text-black">
              <p className="font-black">KRISHOE</p>
              <p>{text("To", "प्रापक")}: <b>{order.name}</b> · {order.phone}</p>
              <p>{text("Address", "ठेगाना")}: {order.address}</p>
              <ul className="my-2 list-none pl-0">
                {items.map((item, index) => (
                  <li key={index}>{item.design} · {item.sizeRun} · {item.color} × {item.quantity}</li>
                ))}
              </ul>
              <p className="font-black">
                {paidOnline ? text("Paid online", "online तिरिसकेको") : `${text("Collect", "लिनुपर्ने")}: ${money(rupees)}`}
              </p>
              <div className="mt-3 flex gap-2 print:hidden">
                <button type="button" onClick={() => window.print()} className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-black text-white">🖨️ {text("Print", "छाप्ने")}</button>
                <button type="button" onClick={() => setPrinting(false)} className="rounded-lg border border-brand-green-line px-3 py-1.5 text-xs font-black">{text("Close", "बन्द")}</button>
              </div>
            </div>
          ) : null}

          {stage === 2 && dispatch ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              🚚 {text("On the way", "बाटोमा छ")} — {dispatch.dispatchBy}
              {dispatch.dispatchChargePaisa ? ` · ${text("delivery", "डेलिभरी")} ${money(dispatch.dispatchChargePaisa / 100)}` : ""}
              {dispatch.dispatchTracking ? ` · ${dispatch.dispatchTracking}` : ""}
              <br />
              {text("When the money comes, press the button: the bill is made and the stock goes down.", "पैसा आएपछि बटन थिच्नुहोस्: बिल बन्छ र स्टक घट्छ।")}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {stage === 0 ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(updateOrderStatusAction, { id: order.id, status: "Contacted" })}
                className="min-h-12 rounded-xl bg-brand-green px-5 text-base font-black text-white disabled:opacity-60"
              >
                📞 {text("Called — confirmed", "फोन गरियो — पक्का भयो")}
              </button>
            ) : null}
            {stage === 1 ? (
              <button
                type="button"
                disabled={isPending || !dispatchReady}
                title={!dispatchReady ? text("Prepare the database first (Settings)", "पहिले Settings मा database तयार गर्नुहोस्") : undefined}
                onClick={() =>
                  run(markOrderDispatchedAction, {
                    id: order.id,
                    dispatchBy,
                    dispatchCharge,
                    dispatchTracking,
                  })
                }
                className="min-h-12 rounded-xl bg-brand-green px-5 text-base font-black text-white disabled:opacity-60"
              >
                🚚 {text("Sent", "पठाइयो")}
              </button>
            ) : null}
            {(stage === 1 || stage === 2) && !stockShort ? (
              <button
                type="button"
                disabled={isPending}
                onClick={makeBill}
                className={`min-h-12 rounded-xl px-5 text-base font-black transition disabled:opacity-60 ${
                  stage === 2 ? "bg-brand-green text-white" : "border border-brand-green text-brand-green"
                }`}
              >
                {paidOnline
                  ? `🧾 ${text(`Make the bill — ${money(rupees)}`, `बिल बनाउने — ${money(rupees)}`)}`
                  : `💰 ${text(`Money in — ${money(rupees)}, make the bill`, `पैसा आयो — ${money(rupees)} बिल बनाउने`)}`}
              </button>
            ) : null}
            {stage === 2 ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(clearOrderDispatchAction, { id: order.id })}
                className="min-h-10 rounded-lg px-3 text-xs font-bold text-brand-muted underline"
              >
                {text("Not sent after all", "पठाइएको होइन (फिर्ता)")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setCancelling((open) => !open)}
              className="min-h-10 rounded-lg border border-brand-green-line px-3 text-xs font-black text-brand-muted-deep"
            >
              ✖ {text("Cancel", "रद्द")}
            </button>
          </div>

          {cancelling ? (
            <div className="grid gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-black text-red-900">{text("Why is it cancelled?", "किन रद्द?")}</p>
              <div className="flex flex-wrap gap-2">
                {CANCEL_REASONS.map((option) => {
                  const value = text(option.en, option.ne);
                  return (
                    <button
                      key={option.en}
                      type="button"
                      onClick={() => setReason(value)}
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${reason === value ? "border-red-700 bg-red-700 text-white" : "border-red-200 bg-white text-red-900"}`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={!reason || isPending}
                onClick={() => run(cancelOrderWithReasonAction, { id: order.id, reason })}
                className="w-fit rounded-lg bg-red-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                {text("Cancel this order", "यो अर्डर रद्द गर्ने")}
              </button>
            </div>
          ) : null}
        </div>
      )}

      <p className="rounded-xl bg-brand-green-wash px-3 py-2 text-xs text-brand-green-ink">
        💬 <b>{text("Message for the customer", "ग्राहकलाई सन्देश")}:</b> {message}
      </p>

      {/* Everything the desk had before — status by hand, payment details,
          the bill with a chosen method or a credit account — kept, folded. */}
      <details className="rounded-xl border border-brand-green-line p-3">
        <summary className="cursor-pointer text-sm font-black text-brand-muted-deep">
          {text("Detailed: online payment, credit account, status by hand", "विस्तृत: online भुक्तानी, उधारो खाता, अवस्था आफैँ")}
        </summary>
        <div className="mt-3 grid gap-3 overflow-x-auto">
          <OrderStatusSelector order={order} />
          <p className="text-xs font-semibold text-brand-muted">{order.payment}</p>
          <OrderPaymentForm order={order} customerLedgers={customerLedgers} transactions={transactions} />
          {conversionRow ? (
            <div className="border-t border-brand-green-line pt-3">
              <ConversionPill signal={conversionRow.signal} />
              <div className="mt-2">
                <OrderToPosForm order={order} customerLedgers={customerLedgers} posInvoice={posInvoice} conversionRow={conversionRow} />
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </article>
  );
}
