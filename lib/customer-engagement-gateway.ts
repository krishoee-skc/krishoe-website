import { queryPostgres } from "@/lib/postgres/client";
import { sendWhatsAppMessage, sendAdminNotification } from "@/lib/whatsapp-gateway";

const STORE = "krishoe";

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp_number?: string;
  notification_preference: string;
  created_at: string;
}

export interface CustomerOrder {
  id: string;
  customer_id: string;
  order_number: string;
  status: string;
  total_amount: number;
  expected_delivery?: string;
  created_at: string;
}

export interface CustomerFeedback {
  id: string;
  customer_id: string;
  feedback_type: string;
  rating?: number;
  message: string;
  title?: string;
  status: string;
}

export interface CustomerDashboardData {
  customer: Customer | null;
  orders: CustomerOrder[];
  feedback: CustomerFeedback[];
  loyalty: { points_balance: number; tier: string };
  totalOrders: number;
  totalFeedback: number;
}

// Create or update customer
export async function createCustomer(data: {
  name: string;
  email?: string;
  phone?: string;
  whatsapp_number?: string;
  city?: string;
  country?: string;
}): Promise<Customer> {
  try {
    const customerId = crypto.randomUUID();

    await queryPostgres(
      STORE,
      `INSERT INTO customers (id, name, email, phone, whatsapp_number, city, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        customerId,
        data.name,
        data.email || null,
        data.phone || null,
        data.whatsapp_number || null,
        data.city || null,
        data.country || "Nepal",
      ]
    );

    // Create notification preferences
    const prefId = crypto.randomUUID();
    await queryPostgres(
      STORE,
      `INSERT INTO notification_preferences (id, customer_id)
       VALUES ($1, $2)`,
      [prefId, customerId]
    );

    return { id: customerId, name: data.name, notification_preference: "all", created_at: new Date().toISOString() };
  } catch (error) {
    console.error("Failed to create customer:", error);
    throw error;
  }
}

// Get customer by ID
export async function getCustomer(customerId: string): Promise<Customer | null> {
  try {
    const results = await queryPostgres<Customer>(
      STORE,
      `SELECT id, name, email, phone, whatsapp_number, notification_preference, created_at
       FROM customers WHERE id = $1`,
      [customerId]
    );
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error("Failed to fetch customer:", error);
    return null;
  }
}

// Create customer order
export async function createCustomerOrder(data: {
  customer_id: string;
  order_number: string;
  total_amount: number;
  items_count: number;
  order_date: string;
  expected_delivery?: string;
  shipping_address?: string;
}): Promise<CustomerOrder> {
  try {
    const orderId = crypto.randomUUID();

    await queryPostgres(
      STORE,
      `INSERT INTO customer_orders (id, customer_id, order_number, status, total_amount, items_count, order_date, expected_delivery, shipping_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        orderId,
        data.customer_id,
        data.order_number,
        "confirmed",
        data.total_amount,
        data.items_count,
        data.order_date,
        data.expected_delivery || null,
        data.shipping_address || null,
      ]
    );

    return {
      id: orderId,
      customer_id: data.customer_id,
      order_number: data.order_number,
      status: "confirmed",
      total_amount: data.total_amount,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to create order:", error);
    throw error;
  }
}

// Send order confirmation to customer
export async function notifyOrderConfirmation(data: {
  customerName: string;
  phone: string;
  orderNumber: string;
  totalAmount: number;
  expectedDelivery: string;
}): Promise<string> {
  try {
    const message = `✅ Order Confirmed!
नमस्ते ${data.customerName}!
📦 Order #${data.orderNumber}
💵 Amount: Rs. ${data.totalAmount.toLocaleString()}
📅 Expected Delivery: ${data.expectedDelivery}

धन्यवाद आपको आदेशको लागि! 🙏`;

    const messageId = await sendWhatsAppMessage({
      to: data.phone,
      text: message,
    });

    // Save notification to database
    await saveCustomerNotification({
      customer_id: "", // Will be fetched from phone
      notification_type: "order_confirmed",
      channel: "whatsapp",
      recipient: data.phone,
      message_text: message,
      metadata: {
        orderNumber: data.orderNumber,
        amount: data.totalAmount,
      },
    });

    return messageId;
  } catch (error) {
    console.error("Failed to send order confirmation:", error);
    throw error;
  }
}

// Notify order shipped
export async function notifyOrderShipped(data: {
  customerName: string;
  phone: string;
  orderNumber: string;
  trackingNumber?: string;
  estimatedDate: string;
}): Promise<string> {
  try {
    let message = `🚚 Order Shipped!
नमस्ते ${data.customerName}!
📦 Order #${data.orderNumber}`;

    if (data.trackingNumber) {
      message += `\n📍 Tracking: ${data.trackingNumber}`;
    }

    message += `\n📅 Estimated Delivery: ${data.estimatedDate}
\nआपको आदेश यात्रामा छ! 🎉`;

    const messageId = await sendWhatsAppMessage({
      to: data.phone,
      text: message,
    });

    await saveCustomerNotification({
      customer_id: "",
      notification_type: "shipped",
      channel: "whatsapp",
      recipient: data.phone,
      message_text: message,
      metadata: {
        orderNumber: data.orderNumber,
        trackingNumber: data.trackingNumber,
      },
    });

    return messageId;
  } catch (error) {
    console.error("Failed to send shipped notification:", error);
    throw error;
  }
}

// Notify order delivered
export async function notifyOrderDelivered(data: {
  customerName: string;
  phone: string;
  orderNumber: string;
}): Promise<string> {
  try {
    const message = `✨ Order Delivered!
नमस्ते ${data.customerName}!
📦 Order #${data.orderNumber}
✅ सफलतापूर्वक पहुँचाइयो!

कृपया आपको अनुभव साझा गर्नुहोस्! ⭐`;

    const messageId = await sendWhatsAppMessage({
      to: data.phone,
      text: message,
    });

    await saveCustomerNotification({
      customer_id: "",
      notification_type: "delivered",
      channel: "whatsapp",
      recipient: data.phone,
      message_text: message,
      metadata: {
        orderNumber: data.orderNumber,
      },
    });

    return messageId;
  } catch (error) {
    console.error("Failed to send delivery notification:", error);
    throw error;
  }
}

// Request customer feedback
export async function requestCustomerFeedback(data: {
  customerName: string;
  phone: string;
  orderNumber: string;
  feedbackLink: string;
}): Promise<string> {
  try {
    const message = `⭐ Your Feedback Matters!
नमस्ते ${data.customerName}!

Order #${data.orderNumber} को लागि कृपया review दिनुहोस्।
यो हामीलाई सुधार गर्न मद्दत गर्छ! 💪

Link: ${data.feedbackLink}`;

    const messageId = await sendWhatsAppMessage({
      to: data.phone,
      text: message,
    });

    await saveCustomerNotification({
      customer_id: "",
      notification_type: "feedback_request",
      channel: "whatsapp",
      recipient: data.phone,
      message_text: message,
      metadata: {
        orderNumber: data.orderNumber,
        feedbackLink: data.feedbackLink,
      },
    });

    return messageId;
  } catch (error) {
    console.error("Failed to send feedback request:", error);
    throw error;
  }
}

// Submit customer feedback
export async function submitCustomerFeedback(data: {
  customer_id: string;
  order_id?: string;
  feedback_type: string;
  rating?: number;
  title?: string;
  message: string;
  product_mentioned?: string;
}): Promise<CustomerFeedback> {
  try {
    const feedbackId = crypto.randomUUID();

    await queryPostgres(
      STORE,
      `INSERT INTO customer_feedback (id, customer_id, order_id, feedback_type, rating, title, message, product_mentioned, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        feedbackId,
        data.customer_id,
        data.order_id || null,
        data.feedback_type,
        data.rating || null,
        data.title || null,
        data.message,
        data.product_mentioned || null,
        "new",
      ]
    );

    // Notify admin of new feedback
    await notifyAdminNewFeedback({
      customerName: "Customer",
      feedbackType: data.feedback_type,
      rating: data.rating,
      message: data.message.substring(0, 100),
    });

    return {
      id: feedbackId,
      customer_id: data.customer_id,
      feedback_type: data.feedback_type,
      rating: data.rating,
      message: data.message,
      status: "new",
    };
  } catch (error) {
    console.error("Failed to submit feedback:", error);
    throw error;
  }
}

// Save customer notification to database
export async function saveCustomerNotification(data: {
  customer_id: string;
  notification_type: string;
  channel: string;
  recipient: string;
  message_text: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const notificationId = crypto.randomUUID();

    await queryPostgres(
      STORE,
      `INSERT INTO customer_notifications (id, customer_id, notification_type, channel, recipient, message_text, metadata, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        notificationId,
        data.customer_id,
        data.notification_type,
        data.channel,
        data.recipient,
        data.message_text,
        JSON.stringify(data.metadata || {}),
        "sent",
      ]
    );
  } catch (error) {
    console.error("Failed to save customer notification:", error);
  }
}

// Get customer feedback
export async function getCustomerFeedback(customerId: string): Promise<CustomerFeedback[]> {
  try {
    const results = await queryPostgres<CustomerFeedback>(
      STORE,
      `SELECT id, customer_id, feedback_type, rating, message, title, status
       FROM customer_feedback
       WHERE customer_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [customerId]
    );
    return results;
  } catch (error) {
    console.error("Failed to fetch customer feedback:", error);
    return [];
  }
}

// Get customer orders
export async function getCustomerOrders(customerId: string): Promise<CustomerOrder[]> {
  try {
    const results = await queryPostgres<CustomerOrder>(
      STORE,
      `SELECT id, customer_id, order_number, status, total_amount, expected_delivery, created_at
       FROM customer_orders
       WHERE customer_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [customerId]
    );
    return results;
  } catch (error) {
    console.error("Failed to fetch customer orders:", error);
    return [];
  }
}

// Notify admin of new feedback
async function notifyAdminNewFeedback(data: {
  customerName: string;
  feedbackType: string;
  rating?: number;
  message: string;
}): Promise<void> {
  try {
    const stars = data.rating ? "⭐".repeat(data.rating) : "";
    const message = `📋 नयाँ Customer Feedback:
👤 Type: ${data.feedbackType}
${data.rating ? `📊 Rating: ${stars}` : ""}
💬 Message: ${data.message}`;

    await sendAdminNotification(message);
  } catch (error) {
    console.error("Failed to notify admin of feedback:", error);
  }
}

// Update notification preferences
export async function updateNotificationPreferences(
  customerId: string,
  preferences: Record<string, boolean>
): Promise<void> {
  try {
    const allowedPreferenceColumns = new Set([
      "email_enabled",
      "sms_enabled",
      "whatsapp_enabled",
      "order_updates",
      "promotions",
    ]);
    const safePreferences = Object.entries(preferences).filter(([key]) =>
      allowedPreferenceColumns.has(key),
    );

    if (safePreferences.length === 0) return;

    const updates = safePreferences
      .map(([key], idx) => `${key} = $${idx + 1}`)
      .join(", ");

    const values = safePreferences.map(([, value]) => value);

    await queryPostgres(
      STORE,
      `UPDATE notification_preferences SET ${updates} WHERE customer_id = $${values.length + 1}`,
      [...values, customerId]
    );
  } catch (error) {
    console.error("Failed to update notification preferences:", error);
  }
}

// Calculate customer loyalty points
export async function addLoyaltyPoints(customerId: string, points: number): Promise<void> {
  try {
    await queryPostgres(
      STORE,
      `UPDATE customer_loyalty
       SET points_balance = points_balance + $1, points_lifetime = points_lifetime + $1
       WHERE customer_id = $2`,
      [points, customerId]
    );
  } catch (error) {
    console.error("Failed to add loyalty points:", error);
  }
}

// Get customer dashboard data
export async function getCustomerDashboard(customerId: string): Promise<CustomerDashboardData | null> {
  try {
    const customer = await getCustomer(customerId);
    const orders = await getCustomerOrders(customerId);
    const feedback = await getCustomerFeedback(customerId);

    const loyalty = await queryPostgres<{ points_balance: number; tier: string }>(
      STORE,
      `SELECT points_balance, tier FROM customer_loyalty WHERE customer_id = $1`,
      [customerId]
    );

    return {
      customer,
      orders,
      feedback,
      loyalty: loyalty.length > 0 ? loyalty[0] : { points_balance: 0, tier: "bronze" },
      totalOrders: orders.length,
      totalFeedback: feedback.length,
    };
  } catch (error) {
    console.error("Failed to fetch customer dashboard:", error);
    return null;
  }
}
