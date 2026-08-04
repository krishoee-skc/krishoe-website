import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { createCustomerOrder, getCustomerOrders, notifyOrderConfirmation } from "@/lib/customer-engagement-gateway";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/customers/orders", "POST");
  if (denied) return denied;

  try {
    const body = await request.json();
    const {
      customer_id,
      order_number,
      total_amount,
      items_count,
      order_date,
      expected_delivery,
      shipping_address,
      customer_name,
      customer_phone
    } = body;

    if (!customer_id || !order_number || !total_amount || !items_count || !order_date) {
      return NextResponse.json(
        { error: "customer_id, order_number, total_amount, items_count, and order_date are required" },
        { status: 400 }
      );
    }

    const order = await createCustomerOrder({
      customer_id,
      order_number,
      total_amount: parseFloat(total_amount),
      items_count: parseInt(items_count),
      order_date,
      expected_delivery: expected_delivery || undefined,
      shipping_address: shipping_address || undefined,
    });

    // Send WhatsApp confirmation if phone provided
    if (customer_phone && customer_name && expected_delivery) {
      try {
        await notifyOrderConfirmation({
          customerName: customer_name,
          phone: customer_phone,
          orderNumber: order_number,
          totalAmount: parseFloat(total_amount),
          expectedDelivery: expected_delivery,
        });
      } catch (notificationError) {
        console.error("Failed to send order confirmation:", notificationError);
        // Don't fail the order creation if notification fails
      }
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create order" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/customers/orders", "GET");
  if (denied) return denied;

  try {
    const customerId = request.nextUrl.searchParams.get("customer_id");

    if (!customerId) {
      return NextResponse.json(
        { error: "customer_id is required" },
        { status: 400 }
      );
    }

    const orders = await getCustomerOrders(customerId);

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
