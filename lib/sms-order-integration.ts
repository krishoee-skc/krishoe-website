import type { OrderSubmission } from "@/lib/submissions";
import {
  sendOrderConfirmationSMS,
  sendPaymentLinkSMS,
  sendDeliveredSMS,
} from "@/lib/sms-gateway";
import { reportingErrors } from "@/lib/report-error";

// Estimate delivery date based on delivery preference
function estimateDeliveryDate(delivery: string): string {
  const days = delivery.toLowerCase().includes("express") ? 2 : 5;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("default", {
    timeZone: "Asia/Kathmandu",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Get language preference from payment method or default to English
function detectLanguage(): "en" | "np" {
  // If customer set a preference, use it (can be extended later)
  // For now, default to English for international customers
  return "en";
}

// Send SMS when order is confirmed
export async function notifyOrderConfirmedBySMS(order: OrderSubmission) {
  if (!order.phone) {
    console.log("No phone number for SMS notification");
    return;
  }

  const language = detectLanguage();
  const estimatedDelivery = estimateDeliveryDate(order.delivery);

  try {
    await sendOrderConfirmationSMS({
      customerPhone: order.phone,
      customerName: order.name.split(" ")[0], // First name only
      orderId: order.id,
      totalAmount: parseInt(order.total.replace(/[^\d]/g, ""), 10) || 0,
      estimatedDelivery,
      language,
    });
  } catch (error) {
    // Log but don't throw - SMS failure shouldn't break order creation
    console.error("Failed to send order confirmation SMS:", error);
  }
}

// Send SMS when payment link is generated
export async function notifyPaymentLinkBySMS(data: {
  order: OrderSubmission;
  paymentLink: string;
  language?: "en" | "np";
}) {
  if (!data.order.phone) {
    console.log("No phone number for SMS notification");
    return;
  }

  const language = data.language || detectLanguage();

  try {
    await sendPaymentLinkSMS({
      customerPhone: data.order.phone,
      customerName: data.order.name.split(" ")[0],
      orderId: data.order.id,
      amount: parseInt(data.order.total.replace(/[^\d]/g, ""), 10) || 0,
      paymentLink: data.paymentLink,
      method: (data.order.paymentProvider || "manual") as
        | "esewa"
        | "khalti"
        | "bank"
        | "cod",
      language,
    });
  } catch (error) {
    console.error("Failed to send payment link SMS:", error);
  }
}

// Send SMS when order is shipped
export async function notifyShippedBySMS(data: {
  order: OrderSubmission;
  trackingNumber?: string;
  language?: "en" | "np";
}) {
  if (!data.order.phone) {
    console.log("No phone number for SMS notification");
    return;
  }

  const language = data.language || detectLanguage();
  const estimatedDelivery = estimateDeliveryDate(data.order.delivery);

  try {
    const { sendShippedSMS } = await import("@/lib/sms-gateway");
    await sendShippedSMS({
      customerPhone: data.order.phone,
      customerName: data.order.name.split(" ")[0],
      orderId: data.order.id,
      trackingNumber: data.trackingNumber,
      estimatedDelivery,
      language,
    });
  } catch (error) {
    console.error("Failed to send shipped SMS:", error);
  }
}

// Send SMS when order is out for delivery
export async function notifyOutForDeliveryBySMS(data: {
  order: OrderSubmission;
  driverName?: string;
  deliveryWindow?: string;
  language?: "en" | "np";
}) {
  if (!data.order.phone) {
    console.log("No phone number for SMS notification");
    return;
  }

  const language = data.language || detectLanguage();

  try {
    const { sendOutForDeliverySMS } = await import("@/lib/sms-gateway");
    await sendOutForDeliverySMS({
      customerPhone: data.order.phone,
      customerName: data.order.name.split(" ")[0],
      orderId: data.order.id,
      driverName: data.driverName,
      deliveryWindow: data.deliveryWindow || "Today between 9 AM - 6 PM",
      language,
    });
  } catch (error) {
    console.error("Failed to send out-for-delivery SMS:", error);
  }
}

// Send SMS when order is delivered
export async function notifyDeliveredBySMS(data: {
  order: OrderSubmission;
  language?: "en" | "np";
}) {
  if (!data.order.phone) {
    console.log("No phone number for SMS notification");
    return;
  }

  const language = data.language || detectLanguage();

  try {
    await sendDeliveredSMS({
      customerPhone: data.order.phone,
      customerName: data.order.name.split(" ")[0],
      orderId: data.order.id,
      language,
    });
  } catch (error) {
    console.error("Failed to send delivered SMS:", error);
  }
}

// Auto-send SMS on order creation (called from submitCheckout)
export async function autoNotifyOrderCreatedBySMS(order: OrderSubmission) {
  await reportingErrors("SMS notification on order created", () =>
    notifyOrderConfirmedBySMS(order)
  );
}
