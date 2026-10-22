import OrdersClient from "@/app/admin/OrdersClient";
import T from "@/components/T";
import { buildOnlineOrderConversionReport, onlineOrderItemsForPos, posInvoiceMatchesOnlineOrder } from "@/lib/order-pos";
import { getOperationsDataForReports } from "@/lib/operations";
import { getPaymentTransactionsByOrderIds } from "@/lib/payment-transactions";
import { getPosInvoices } from "@/lib/pos";
import { getProducts } from "@/lib/product-store";
import { getOrders } from "@/lib/submissions";
import { getOrderDispatchByIds, orderDispatchAvailable } from "@/lib/order-dispatch";
import { reportError } from "@/lib/report-error";
import ExportButton from "@/components/admin/ExportButton";
import AddWhatsAppOrder from "@/app/admin/orders/AddWhatsAppOrder";
import { paymentOptions, shippingOptions } from "@/lib/commerce";
import { getDeliveryPricing } from "@/lib/delivery-settings";
import { withSizeStock } from "@/lib/stock-by-size";
import { reservedByProduct } from "@/lib/order-stock";
import { reservedBySize, sizeHoldKey } from "@/lib/checkout-item-check";

export const metadata = {
  title: "Orders | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await getOrders();
  const [operations, paymentTransactions, posInvoices, products, dispatchReady, dispatchById, deliveryPricing] = await Promise.all([
    getOperationsDataForReports(),
    getPaymentTransactionsByOrderIds(orders.map((order) => order.id)),
    getPosInvoices(),
    getProducts({ includeDrafts: true }),
    orderDispatchAvailable(),
    // Who took an order and why one was cancelled. A failure here leaves the
    // desk as it was, without those lines, rather than failing the page.
    getOrderDispatchByIds(orders.map((order) => order.id)).catch((error) => {
      reportError("read order dispatch", error);
      return {};
    }),
    getDeliveryPricing(),
  ]);
  // What the WhatsApp order form can sell: the shoes on sale, with the pairs
  // per size where the stock is kept that way (the same rule the shop uses),
  // less what open orders hold — the number the save itself will judge by.
  const held = reservedByProduct(orders);
  const heldSizes = reservedBySize(orders);
  const shoesOnSale = withSizeStock(
    products.filter((product) => product.status === "Active"),
    operations.finishedStock,
  ).map((product) => ({
    id: product.id,
    name: product.name,
    priceValue: product.priceValue,
    sizes: product.sizes,
    colors: product.colors,
    stock: Math.max(0, product.stock - (held.get(product.id) ?? 0)),
    sizeStock: product.sizeStock
      ? Object.fromEntries(
          Object.entries(product.sizeStock).map(([size, pairs]) => [
            size,
            Math.max(0, pairs - (heldSizes.get(sizeHoldKey(product.id, size)) ?? 0)),
          ]),
        )
      : undefined,
  }));
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
  // Parse each order's items into clean rows (name, size, colour, qty, price)
  // once on the server, where the catalog is already loaded — so the admin table
  // can lay them out side by side instead of showing the raw pasted text block.
  const parsedItemsByOrderId = Object.fromEntries(
    orders.map((order) => [
      order.id,
      onlineOrderItemsForPos(order, products).map((item) => ({
        design: item.design,
        sizeRun: item.sizeRun,
        color: item.color,
        quantity: item.quantity,
        rate: item.rate,
        lineTotal: item.rate * item.quantity,
      })),
    ]),
  );

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="order-1 mr-auto">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold-deep">
            <T en="Online orders" ne="अनलाइन अर्डर" />
          </p>
          <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink">
            <T en="Orders" ne="अर्डर" />
          </h1>
          <p className="mt-1 text-sm text-brand-muted">
            <T
              en="Call, send, take the money and make the bill — one step at a time."
              ne="फोन गर्ने, पठाउने, पैसा लिने र बिल बनाउने — एक-एक चरण।"
            />
          </p>
        </div>
        <AddWhatsAppOrder
          shoes={shoesOnSale}
          deliveryOptions={shippingOptions}
          paymentOptions={paymentOptions}
          zones={(deliveryPricing.zones ?? []).map((zone) => ({ id: zone.id, name: zone.name }))}
        />
        <div className="order-3 flex flex-wrap gap-2">
          {/* Buttons, not links: a <Link> is prefetched as soon as it is on
              screen, so every visit to this page ran both exports and wrote
              them to the activity log — nine "exported" rows in a minute nobody
              pressed (owner, 2026-09-30). Now they run on a press only. */}
          <ExportButton
            className="rounded-md border border-[#D8E6DD] px-3 py-2 text-xs font-black uppercase tracking-wide text-brand-green-ink transition hover:border-brand-green-ink"
            href="/api/orders/export?type=orders"
          >
            Orders CSV
          </ExportButton>
          <ExportButton
            className="rounded-md bg-brand-green-ink px-3 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-[#1A3A31]"
            href="/api/orders/export?type=conversion"
          >
            Conversion CSV
          </ExportButton>
        </div>
      </div>
      <OrdersClient
        orders={orders}
        customerLedgers={operations.customerLedgers}
        paymentTransactions={paymentTransactions}
        posInvoicesByOrderId={posInvoicesByOrderId}
        conversionReport={conversionReport}
        parsedItemsByOrderId={parsedItemsByOrderId}
        dispatchById={dispatchById}
        dispatchReady={dispatchReady}
      />
    </section>
  );
}
