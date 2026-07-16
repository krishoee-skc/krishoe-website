import OrdersClient from "@/app/admin/OrdersClient";
import { buildOnlineOrderConversionReport, posInvoiceMatchesOnlineOrder } from "@/lib/order-pos";
import { getOperationsData } from "@/lib/operations";
import { getPaymentTransactionsByOrderIds } from "@/lib/payment-transactions";
import { getPosInvoices } from "@/lib/pos";
import { getProducts } from "@/lib/product-store";
import { getOrders } from "@/lib/submissions";
import Link from "next/link";

export const metadata = {
  title: "Orders | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await getOrders();
  const [operations, paymentTransactions, posInvoices, products] = await Promise.all([
    getOperationsData(),
    getPaymentTransactionsByOrderIds(orders.map((order) => order.id)),
    getPosInvoices(),
    getProducts({ includeDrafts: true }),
  ]);
  const posInvoicesByOrderId = Object.fromEntries(
    orders.map((order) => {
      const invoice = posInvoices.find((item) => posInvoiceMatchesOnlineOrder(item, order.id));

      return [
        order.id,
        invoice
          ? {
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
            }
          : null,
      ];
    }),
  );
  const conversionReport = buildOnlineOrderConversionReport({
    orders,
    products,
    finishedStock: operations.finishedStock,
    posInvoices,
  });

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage customer order requests, POS conversion, payment, and stock readiness.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-md border border-[#D8E6DD] px-3 py-2 text-xs font-black uppercase tracking-wide text-brand-green-ink transition hover:border-brand-green-ink"
            href="/api/orders/export?type=orders"
          >
            Orders CSV
          </Link>
          <Link
            className="rounded-md bg-brand-green-ink px-3 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-[#1A3A31]"
            href="/api/orders/export?type=conversion"
          >
            Conversion CSV
          </Link>
        </div>
      </div>
      <OrdersClient
        orders={orders}
        customerLedgers={operations.customerLedgers}
        paymentTransactions={paymentTransactions}
        posInvoicesByOrderId={posInvoicesByOrderId}
        conversionReport={conversionReport}
      />
    </section>
  );
}
