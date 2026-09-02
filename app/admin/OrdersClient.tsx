"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type {
  OnlineOrderConversionReport,
  OnlineOrderConversionRow,
  OnlineOrderConversionSignal,
} from "@/lib/order-pos";
import type { CustomerLedger } from "@/lib/operations";
import type { PaymentTransaction } from "@/lib/payment-transactions";
import type { OrderSubmission } from "@/lib/submissions";
import { parseOrderTotalRupees } from "@/lib/payment-amount";
import {
  createPosInvoiceFromOrderAction,
  markCustomerPhoneVerifiedFromOrderAction,
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

type OrderPosInvoiceLink = {
  id: string;
  invoiceNumber: string;
};

const POS_PAYMENT_METHODS = ["Cash", "Cheque", "Credit", "QR", "eSewa", "Khalti", "Bank"] as const;
const CONVERSION_FILTERS: Array<OnlineOrderConversionSignal | "All"> = [
  "All",
  "Converted",
  "Not converted",
  "Needs stock",
  "Needs ledger",
  "Needs parsing",
];

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

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
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

function ConversionStatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-muted">{label}</p>
      <p className="mt-2 text-2xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-1 text-xs font-semibold text-brand-muted">{detail}</p>
    </div>
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
      <form onSubmit={handleSubmit} className="grid gap-2">
        <input type="hidden" name="id" value={order.id} />
        <div className="grid grid-cols-3 gap-2">
          <select
            name="paymentStatus"
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
          <select
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
          <input
            name="paymentAmount"
            type="number"
            min="0"
            defaultValue={latestTransaction?.amount ?? amountFromOrderTotal(order.total)}
            disabled={isPending}
            placeholder="Amount"
            className="min-w-0 rounded-md border-brand-green-line text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <select
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
          <input
            name="paymentReference"
            defaultValue={order.paymentReference ?? ""}
            placeholder="Reference"
            disabled={isPending}
            className="min-w-0 rounded-md border-brand-green-line text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
          <input
            name="paymentTransactionId"
            defaultValue={order.paymentTransactionId ?? ""}
            placeholder="Transaction ID"
            disabled={isPending}
            className="min-w-0 rounded-md border-brand-green-line text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
          <input
            name="paymentCallbackId"
            defaultValue={order.paymentCallbackId ?? ""}
            placeholder="Callback ID"
            disabled={isPending}
            className="min-w-0 rounded-md border-brand-green-line text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>
        <input
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
      </form>

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
    <form onSubmit={handleSubmit} className="grid min-w-[360px] gap-2">
      <input type="hidden" name="id" value={order.id} />
      <div className="grid grid-cols-3 gap-2">
        <select
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
        <input
          name="paidAmount"
          type="number"
          min="0"
          defaultValue={order.paymentStatus === "Paid" ? amountFromOrderTotal(order.total) : 0}
          disabled={isPending}
          placeholder="Paid"
          className="min-w-0 rounded-md border-brand-green-line text-xs shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        />
        <input
          name="cashier"
          defaultValue="Online"
          disabled={isPending}
          placeholder="Cashier"
          className="min-w-0 rounded-md border-brand-green-line text-xs shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
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
        <input
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
    </form>
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

export default function OrdersClient({
  orders,
  customerLedgers,
  paymentTransactions,
  posInvoicesByOrderId,
  conversionReport,
  parsedItemsByOrderId,
}: {
  orders: OrderSubmission[];
  customerLedgers: CustomerLedger[];
  paymentTransactions: PaymentTransaction[];
  posInvoicesByOrderId: Record<string, OrderPosInvoiceLink | null>;
  conversionReport: OnlineOrderConversionReport;
  parsedItemsByOrderId: Record<string, ParsedOrderItem[]>;
}) {
  const [conversionFilter, setConversionFilter] = useState<OnlineOrderConversionSignal | "All">("All");
  const conversionByOrderId = new Map(conversionReport.rows.map((row) => [row.orderId, row]));
  const visibleOrders =
    conversionFilter === "All"
      ? orders
      : orders.filter((order) => conversionByOrderId.get(order.id)?.signal === conversionFilter);

  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <ConversionStatCard label="Orders" value={conversionReport.summary.totalOrders} detail="online requests" />
        <ConversionStatCard label="Converted" value={conversionReport.summary.convertedCount} detail="POS invoice linked" />
        <ConversionStatCard label="Ready" value={conversionReport.summary.readyCount} detail="can convert now" />
        <ConversionStatCard label="Needs stock" value={conversionReport.summary.needsStockCount} detail="online stock gap" />
        <ConversionStatCard label="Needs ledger" value={conversionReport.summary.needsLedgerCount} detail="credit/unpaid gap" />
        <ConversionStatCard label="Needs parse" value={conversionReport.summary.needsParsingCount} detail="manual review" />
      </div>

      <div className="flex flex-wrap gap-2">
        {CONVERSION_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setConversionFilter(filter)}
            className={`h-9 rounded-full border px-3 text-xs font-black transition ${
              conversionFilter === filter
                ? "border-brand-green bg-brand-green text-white"
                : "border-brand-green-line bg-brand-paper text-brand-green-ink hover:border-brand-green"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {visibleOrders.map((order) => {
          const conversionRow =
            conversionByOrderId.get(order.id) ??
            {
              orderId: order.id,
              customerName: order.name,
              createdAt: order.createdAt,
              total: order.total,
              itemCount: 0,
              pairCount: 0,
              parsed: false,
              converted: false,
              posInvoiceId: "",
              posInvoiceNumber: "",
              missingLedger: false,
              missingStockItems: [],
              signal: "Needs parsing" as const,
              detail: "Order signal missing.",
            };
          const items = parsedItemsByOrderId[order.id] ?? [];
          const posInvoice = posInvoicesByOrderId[order.id] ?? null;

          return (
            <article
              key={order.id}
              className="overflow-hidden rounded-2xl border border-brand-green-line bg-brand-paper shadow-sm"
            >
              {/* Header strip — the short facts, side by side on one line, so
                  "who ordered, how much, what state" reads at a glance. */}
              <header className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-brand-green-line bg-brand-paper-deep px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-brand-muted">Order · Customer</p>
                  <p className="truncate font-mono text-xs font-semibold text-brand-green-ink">{order.id}</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-brand-green-ink">{order.name}</p>
                  <p className="text-xs text-brand-muted">
                    {order.phone}
                    {order.email ? ` · ${order.email}` : ""}
                  </p>
                  <CustomerTrustForm order={order} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-brand-muted">Date</p>
                  <p className="text-sm font-bold text-brand-green-ink">
                    <DateDisplayAdmin date={order.createdAt} />
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-brand-muted">Total</p>
                  <p className="font-display text-2xl font-black text-brand-green-ink">{order.total}</p>
                </div>
                <div className="shrink-0">
                  <OrderStatusSelector order={order} />
                </div>
              </header>

              {/* Body — three side-by-side zones. On a phone they stack; on a
                  wide screen they sit next to each other, so nothing crams a
                  long sentence into a narrow column. */}
              <div className="grid gap-px bg-brand-green-line lg:grid-cols-[1.4fr_1fr_1fr]">
                {/* Items — a neat table, name left, price right. */}
                <div className="bg-brand-paper p-4 sm:p-5">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-brand-gold-deep">
                    Items · {conversionRow.itemCount || items.length} · {conversionRow.pairCount} pairs
                  </p>
                  {items.length === 0 ? (
                    <p className="whitespace-pre-line rounded-md bg-brand-paper-deep p-3 text-xs leading-6 text-brand-muted">
                      {order.order}
                    </p>
                  ) : (
                    // An aligned table: name, size, colour, qty and price each in
                    // their own column, so every row lines up and the size — the
                    // thing checked most — sits in one scannable column. Wrapped
                    // in overflow-x-auto so a very long colour never pushes the
                    // price off a narrow phone; size/qty/price stay put, only the
                    // colour cell gives.
                    <div className="-mx-1 overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-brand-green-line text-[9px] font-black uppercase tracking-[0.08em] text-brand-muted">
                            <th className="px-1 py-1 text-left font-black">Item</th>
                            <th className="px-1 py-1 text-center font-black">Size</th>
                            <th className="px-1 py-1 text-left font-black">Color</th>
                            <th className="px-1 py-1 text-center font-black">Qty</th>
                            <th className="px-1 py-1 text-right font-black">Rs.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => (
                            <tr
                              key={`${item.design}-${index}`}
                              className="border-b border-dashed border-brand-green-line/60 last:border-0"
                            >
                              <td className="px-1 py-2 font-semibold text-brand-green-ink">{item.design}</td>
                              <td className="px-1 py-2 text-center">
                                <span className="inline-block min-w-[26px] rounded-md bg-brand-green-ink px-1.5 py-0.5 text-center font-mono text-xs font-bold text-white">
                                  {item.sizeRun}
                                </span>
                              </td>
                              <td className="px-1 py-2 text-xs text-brand-muted">{item.color || "—"}</td>
                              <td className="px-1 py-2 text-center font-mono text-xs text-brand-muted">{item.quantity}</td>
                              <td className="whitespace-nowrap px-1 py-2 text-right font-mono text-xs font-bold text-brand-green-ink">
                                {item.lineTotal.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Stock signal — the pill, then each gap on its own line. */}
                <div className="bg-brand-paper p-4 sm:p-5">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-brand-gold-deep">Stock signal</p>
                  <ConversionPill signal={conversionRow.signal} />
                  {conversionRow.missingStockItems.length > 0 ? (
                    <div className="mt-3 space-y-1">
                      {conversionRow.missingStockItems.map((gap, index) => (
                        <p key={index} className="border-b border-dashed border-brand-green-line/60 pb-1 text-xs leading-5 text-brand-muted last:border-0">
                          {gap}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs leading-5 text-brand-muted">{conversionRow.detail}</p>
                  )}
                </div>

                {/* Payment + POS together — status, then the forms unchanged. */}
                <div className="bg-brand-paper p-4 sm:p-5">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-brand-gold-deep">Payment · POS</p>
                  <p className="mb-2 text-xs font-semibold text-brand-muted">{order.payment}</p>
                  <OrderPaymentForm
                    order={order}
                    customerLedgers={customerLedgers}
                    transactions={paymentTransactions.filter(
                      (transaction) => transaction.orderId === order.id,
                    )}
                  />
                  <div className="mt-3 border-t border-brand-green-line pt-3">
                    <OrderToPosForm
                      order={order}
                      customerLedgers={customerLedgers}
                      posInvoice={posInvoice}
                      conversionRow={conversionRow}
                    />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {visibleOrders.length === 0 ? (
          <p className="rounded-2xl border border-brand-green-line bg-brand-paper px-4 py-8 text-center text-sm text-brand-muted">
            No orders match this conversion filter.
          </p>
        ) : null}
      </div>
    </div>
  );
}
