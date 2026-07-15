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
  updateOrderPaymentAction,
  updateOrderStatusAction,
  ORDER_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  type ActionState,
} from "./actions";

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
      className="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
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
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#10231D]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-gray-500">{detail}</p>
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
            className="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
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
            className="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
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
            className="min-w-0 rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <select
            name="ledgerId"
            defaultValue={order.paymentLedgerId ?? latestTransaction?.ledgerId ?? ""}
            disabled={isPending}
            className="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
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
            className="min-w-0 rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
          <input
            name="paymentTransactionId"
            defaultValue={order.paymentTransactionId ?? ""}
            placeholder="Transaction ID"
            disabled={isPending}
            className="min-w-0 rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
          <input
            name="paymentCallbackId"
            defaultValue={order.paymentCallbackId ?? ""}
            placeholder="Callback ID"
            disabled={isPending}
            className="min-w-0 rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>
        <input
          name="paymentNote"
          defaultValue=""
          placeholder="Payment note"
          disabled={isPending}
          className="min-w-0 rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        />
        <div className="flex items-center justify-between gap-3">
          <p className={`text-xs ${state.ok ? "text-gray-500" : "text-red-600"}`}>
            {state.message ||
              (order.paymentVerifiedAt
                ? `Verified ${new Date(order.paymentVerifiedAt).toLocaleString("en-US")}`
                : "Not verified")}
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-[#10231D] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#0B4D3B] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving" : "Save"}
          </button>
        </div>
      </form>

      <div className="grid gap-1 text-xs text-gray-600">
        {transactions.slice(0, 3).map((transaction) => {
          const ledger = customerLedgers.find((item) => item.id === transaction.ledgerId);

          return (
            <div key={transaction.id} className="rounded-md bg-gray-50 px-2 py-1.5">
              <span className="font-bold text-[#10231D]">{transaction.paymentStatus}</span>
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
          className="inline-flex h-9 items-center rounded-full border border-[#0B4D3B] px-3 text-xs font-black text-[#0B4D3B] transition hover:bg-[#0B4D3B] hover:text-white"
        >
          {posInvoice.invoiceNumber}
        </Link>
        <p className="text-xs font-semibold text-gray-500">{conversionRow.pairCount} pairs posted</p>
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
          className="rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
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
          className="min-w-0 rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        />
        <input
          name="cashier"
          defaultValue="Online"
          disabled={isPending}
          placeholder="Cashier"
          className="min-w-0 rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          name="ledgerId"
          defaultValue={order.paymentLedgerId ?? ""}
          disabled={isPending}
          className="rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
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
          className="min-w-0 rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-xs ${state.ok ? "text-gray-500" : "text-red-600"}`}>
          {state.message || conversionRow.detail}
        </p>
        {state.href ? (
          <Link href={state.href} className="text-xs font-black text-[#0B4D3B] underline underline-offset-4">
            Open
          </Link>
        ) : null}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[#0B4D3B] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#10231D] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Creating" : "To POS"}
        </button>
      </div>
    </form>
  );
}

export default function OrdersClient({
  orders,
  customerLedgers,
  paymentTransactions,
  posInvoicesByOrderId,
  conversionReport,
}: {
  orders: OrderSubmission[];
  customerLedgers: CustomerLedger[];
  paymentTransactions: PaymentTransaction[];
  posInvoicesByOrderId: Record<string, OrderPosInvoiceLink | null>;
  conversionReport: OnlineOrderConversionReport;
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
                ? "border-[#0B4D3B] bg-[#0B4D3B] text-white"
                : "border-gray-200 bg-white text-[#10231D] hover:border-[#0B4D3B]"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Order ID</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Date</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Customer</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Items</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Total</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Signal</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Payment</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">POS</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Status</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200">
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

            return (
              <tr key={order.id}>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-700">{order.id}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                  {new Date(order.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <p className="font-medium text-gray-900">{order.name}</p>
                  <p className="text-xs text-gray-500">{order.phone}</p>
                  {order.email ? <p className="text-xs text-gray-500">{order.email}</p> : null}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <p className="max-h-32 min-w-[260px] max-w-[360px] overflow-y-auto whitespace-pre-line rounded-md bg-gray-50 p-3 text-xs leading-6">
                    {order.order}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">{order.total}</td>
                <td className="px-4 py-3 text-gray-700">
                  <div className="grid min-w-[220px] gap-2">
                    <ConversionPill signal={conversionRow.signal} />
                    <p className="text-xs font-semibold leading-5 text-gray-500">{conversionRow.detail}</p>
                    <p className="text-xs text-gray-500">
                      {conversionRow.itemCount} items, {conversionRow.pairCount} pairs
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <p className="mb-2 max-w-[420px] text-xs font-semibold text-gray-500">
                    {order.payment}
                  </p>
                  <OrderPaymentForm
                    order={order}
                    customerLedgers={customerLedgers}
                    transactions={paymentTransactions.filter(
                      (transaction) => transaction.orderId === order.id,
                    )}
                  />
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <OrderToPosForm
                    order={order}
                    customerLedgers={customerLedgers}
                    posInvoice={posInvoicesByOrderId[order.id] ?? null}
                    conversionRow={conversionRow}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <OrderStatusSelector order={order} />
                </td>
              </tr>
            );
          })}
          {visibleOrders.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={9}>
                No orders match this conversion filter.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      </div>
    </div>
  );
}
