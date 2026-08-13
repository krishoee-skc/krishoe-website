import { queryPostgres } from "@/lib/postgres/client";
import twilio from "twilio";

const STORE = "krishoe";

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioSMSNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER;

let twilioClient: ReturnType<typeof twilio> | null = null;

if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
}

export interface SMSMessage {
  to: string;
  text: string;
  type: "customer" | "worker" | "admin";
  eventType?: string;
  orderId?: string;
  workerId?: string;
}

export interface SMSRecord {
  id: string;
  phone_number: string;
  message_text: string;
  message_type: string;
  event_type: string;
  status: string;
  order_id?: string;
  worker_id?: string;
  created_at: string;
}

// Send SMS message
export async function sendSMS(params: SMSMessage): Promise<string> {
  if (!twilioClient || !twilioSMSNumber) {
    console.error("SMS gateway not configured");
    return "";
  }

  try {
    const message = await twilioClient.messages.create({
      from: twilioSMSNumber,
      to: params.to,
      body: params.text,
    });

    // Save to database
    await saveSMSRecord({
      id: message.sid,
      phone_number: params.to,
      message_text: params.text,
      message_type: params.type,
      event_type: params.eventType || "generic",
      status: "sent",
      order_id: params.orderId,
      worker_id: params.workerId,
    });

    return message.sid;
  } catch (error) {
    console.error("Failed to send SMS:", error);
    // Still save as failed for audit trail
    try {
      await saveSMSRecord({
        id: `failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        phone_number: params.to,
        message_text: params.text,
        message_type: params.type,
        event_type: params.eventType || "generic",
        status: "failed",
        order_id: params.orderId,
        worker_id: params.workerId,
      });
    } catch (e) {
      console.error("Failed to save SMS record:", e);
    }
    throw new Error(`SMS send failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// Save SMS record to database
export async function saveSMSRecord(record: Omit<SMSRecord, "created_at">) {
  try {
    await queryPostgres(
      STORE,
      `INSERT INTO sms_messages (id, phone_number, message_text, message_type, event_type, status, order_id, worker_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        record.id,
        record.phone_number,
        record.message_text,
        record.message_type,
        record.event_type,
        record.status,
        record.order_id || null,
        record.worker_id || null,
      ]
    );
  } catch (error) {
    console.error("Failed to save SMS record:", error);
  }
}

// Get SMS history
export async function getSMSHistory(
  phoneNumber?: string,
  orderId?: string,
  workerId?: string,
  limit: number = 100
): Promise<SMSRecord[]> {
  try {
    const normalizedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 100;
    const safeLimit = Math.min(Math.max(normalizedLimit, 1), 500);
    let query = "SELECT * FROM sms_messages WHERE 1=1";
    const params: Array<string | number> = [];

    if (phoneNumber) {
      params.push(phoneNumber);
      query += ` AND phone_number = $${params.length}`;
    }

    if (orderId) {
      params.push(orderId);
      query += ` AND order_id = $${params.length}`;
    }

    if (workerId) {
      params.push(workerId);
      query += ` AND worker_id = $${params.length}`;
    }

    params.push(safeLimit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const messages = await queryPostgres<SMSRecord>(STORE, query, params);
    return messages;
  } catch (error) {
    console.error("Failed to fetch SMS history:", error);
    return [];
  }
}

// Get SMS statistics
export async function getSMSStats(days: number = 7) {
  try {
    const normalizedDays = Number.isFinite(days) ? Math.trunc(days) : 7;
    const safeDays = Math.min(Math.max(normalizedDays, 1), 366);
    const [summary, byType, byEvent] = await Promise.all([
      queryPostgres<{
        total_sent: number | string;
        total_failed: number | string;
        success_rate: number | string;
      }>(
        STORE,
        `SELECT
          COUNT(*) FILTER (WHERE status = 'sent') AS total_sent,
          COUNT(*) FILTER (WHERE status = 'failed') AS total_failed,
          COALESCE(
            ROUND(100 * COUNT(*) FILTER (WHERE status = 'sent')::numeric / NULLIF(COUNT(*), 0), 2),
            0
          ) AS success_rate
         FROM sms_messages
         WHERE created_at > NOW() - ($1 * INTERVAL '1 day')`,
        [safeDays],
      ),
      queryPostgres<{ type: string; count: number | string }>(
        STORE,
        `SELECT message_type AS type, COUNT(*) AS count
         FROM sms_messages
         WHERE created_at > NOW() - ($1 * INTERVAL '1 day')
         GROUP BY message_type ORDER BY count DESC`,
        [safeDays],
      ),
      queryPostgres<{ event: string; count: number | string }>(
        STORE,
        `SELECT event_type AS event, COUNT(*) AS count
         FROM sms_messages
         WHERE created_at > NOW() - ($1 * INTERVAL '1 day')
         GROUP BY event_type ORDER BY count DESC`,
        [safeDays],
      ),
    ]);
    return {
      total_sent: Number(summary[0]?.total_sent) || 0,
      total_failed: Number(summary[0]?.total_failed) || 0,
      success_rate: Number(summary[0]?.success_rate) || 0,
      by_type: byType.map((item) => ({ type: item.type, count: Number(item.count) || 0 })),
      by_event: byEvent.map((item) => ({ event: item.event, count: Number(item.count) || 0 })),
    };
  } catch (error) {
    console.error("Failed to fetch SMS stats:", error);
    return { total_sent: 0, total_failed: 0, success_rate: 0, by_type: [], by_event: [] };
  }
}

// ========== NOTIFICATION TEMPLATES ==========

export async function sendOrderConfirmationSMS(data: {
  customerPhone: string;
  customerName: string;
  orderId: string;
  totalAmount: number;
  estimatedDelivery: string;
  language?: "en" | "np";
}): Promise<string> {
  const text =
    data.language === "np"
      ? `नमस्ते ${data.customerName}! 🎉
आपकोको अर्डर #${data.orderId} सफलतापूर्वक लिइयो।
रकम: Rs. ${data.totalAmount.toLocaleString()}
डेलिभरी: ${data.estimatedDelivery}
धन्यवाद! - KRISHOE`
      : `Hi ${data.customerName}! ✅
Your order #${data.orderId} is confirmed.
Amount: Rs. ${data.totalAmount.toLocaleString()}
Delivery: ${data.estimatedDelivery}
Thank you! - KRISHOE`;

  return sendSMS({
    to: data.customerPhone,
    text,
    type: "customer",
    eventType: "order_confirmed",
    orderId: data.orderId,
  });
}

export async function sendPaymentLinkSMS(data: {
  customerPhone: string;
  customerName: string;
  orderId: string;
  amount: number;
  paymentLink: string;
  method: "esewa" | "khalti" | "bank" | "cod";
  language?: "en" | "np";
}): Promise<string> {
  const methodLabel = {
    esewa: "eSewa",
    khalti: "Khalti",
    bank: "Bank Transfer",
    cod: "Cash on Delivery",
  }[data.method];

  const text =
    data.language === "np"
      ? `नमस्ते ${data.customerName}!
आपकोको अर्डर #${data.orderId} को भुक्तानी गर्नुस्।
रकम: Rs. ${data.amount.toLocaleString()}
तरिका: ${methodLabel}
Link: ${data.paymentLink.substring(0, 40)}...
- KRISHOE`
      : `Hi ${data.customerName}!
Payment required for order #${data.orderId}
Amount: Rs. ${data.amount.toLocaleString()}
Method: ${methodLabel}
Pay here: ${data.paymentLink.substring(0, 40)}...
- KRISHOE`;

  return sendSMS({
    to: data.customerPhone,
    text,
    type: "customer",
    eventType: "payment_link_sent",
    orderId: data.orderId,
  });
}

export async function sendShippedSMS(data: {
  customerPhone: string;
  customerName: string;
  orderId: string;
  trackingNumber?: string;
  estimatedDelivery: string;
  language?: "en" | "np";
}): Promise<string> {
  const text =
    data.language === "np"
      ? `नमस्ते ${data.customerName}! 📦
आपकोको अर्डर #${data.orderId} पठाइयो।
ट्र्याकिङ्ग: ${data.trackingNumber || "Available on website"}
आउने मिति: ${data.estimatedDelivery}
- KRISHOE`
      : `Hi ${data.customerName}! 📦
Your order #${data.orderId} has shipped.
Tracking: ${data.trackingNumber || "Available on website"}
Arrives: ${data.estimatedDelivery}
- KRISHOE`;

  return sendSMS({
    to: data.customerPhone,
    text,
    type: "customer",
    eventType: "shipped",
    orderId: data.orderId,
  });
}

export async function sendOutForDeliverySMS(data: {
  customerPhone: string;
  customerName: string;
  orderId: string;
  driverName?: string;
  deliveryWindow: string;
  language?: "en" | "np";
}): Promise<string> {
  const text =
    data.language === "np"
      ? `नमस्ते ${data.customerName}! 🚚
आपकोको अर्डर #${data.orderId} आज डेलिभरी को लागि निकली।
समय: ${data.deliveryWindow}
${data.driverName ? `चालक: ${data.driverName}` : ""}
- KRISHOE`
      : `Hi ${data.customerName}! 🚚
Your order #${data.orderId} is out for delivery today.
Time: ${data.deliveryWindow}
${data.driverName ? `Driver: ${data.driverName}` : ""}
- KRISHOE`;

  return sendSMS({
    to: data.customerPhone,
    text,
    type: "customer",
    eventType: "out_for_delivery",
    orderId: data.orderId,
  });
}

export async function sendDeliveredSMS(data: {
  customerPhone: string;
  customerName: string;
  orderId: string;
  language?: "en" | "np";
}): Promise<string> {
  const text =
    data.language === "np"
      ? `नमस्ते ${data.customerName}! ✅
आपकोको अर्डर #${data.orderId} डेलिभर भयो।
धन्यवाद! आपको प्रतिक्रिया साझा गर्नुस्।
- KRISHOE`
      : `Hi ${data.customerName}! ✅
Your order #${data.orderId} has been delivered.
Thank you! Please share your feedback.
- KRISHOE`;

  return sendSMS({
    to: data.customerPhone,
    text,
    type: "customer",
    eventType: "delivered",
    orderId: data.orderId,
  });
}

export async function sendWorkerPaymentAlertSMS(data: {
  workerPhone: string;
  workerName: string;
  amount: number;
  dueDate: string;
  language?: "en" | "np";
}): Promise<string> {
  const text =
    data.language === "np"
      ? `नमस्ते ${data.workerName}! 💰
आपकोको भुक्तानी तयारी छ।
रकम: Rs. ${data.amount.toLocaleString()}
मिति: ${data.dueDate}
काठमाडौं को अफिसमा आउनुस्।
- KRISHOE`
      : `Hi ${data.workerName}! 💰
Your payment is ready.
Amount: Rs. ${data.amount.toLocaleString()}
Date: ${data.dueDate}
Visit office in Kathmandu.
- KRISHOE`;

  return sendSMS({
    to: data.workerPhone,
    text,
    type: "worker",
    eventType: "payment_ready",
    workerId: data.workerName,
  });
}

export async function sendWorkerPaymentConfirmedSMS(data: {
  workerPhone: string;
  workerName: string;
  amount: number;
  date: string;
  language?: "en" | "np";
}): Promise<string> {
  const text =
    data.language === "np"
      ? `नमस्ते ${data.workerName}! ✅
आपकोको भुक्तानी दिइयो।
रकम: Rs. ${data.amount.toLocaleString()}
मिति: ${data.date}
धन्यवाद!
- KRISHOE`
      : `Hi ${data.workerName}! ✅
Your payment has been processed.
Amount: Rs. ${data.amount.toLocaleString()}
Date: ${data.date}
Thank you!
- KRISHOE`;

  return sendSMS({
    to: data.workerPhone,
    text,
    type: "worker",
    eventType: "payment_confirmed",
    workerId: data.workerName,
  });
}

export async function sendAdminAlertSMS(data: {
  adminPhone: string;
  title: string;
  message: string;
  severity: "low" | "medium" | "high";
}): Promise<string> {
  const emoji = {
    low: "ℹ️",
    medium: "⚠️",
    high: "🚨",
  }[data.severity];

  const text = `${emoji} KRISHOE ALERT
${data.title}
${data.message}`;

  return sendSMS({
    to: data.adminPhone,
    text,
    type: "admin",
    eventType: "admin_alert",
  });
}

export async function sendLowStockAlertSMS(data: {
  adminPhone: string;
  productName: string;
  currentStock: number;
  threshold: number;
}): Promise<string> {
  return sendAdminAlertSMS({
    adminPhone: data.adminPhone,
    title: "Low Stock Alert",
    message: `${data.productName}: ${data.currentStock} units (threshold: ${data.threshold})`,
    severity: "medium",
  });
}

export async function sendManualPaymentAlertSMS(data: {
  adminPhone: string;
  orderId: string;
  customerName: string;
  amount: number;
  method: "cod" | "bank";
}): Promise<string> {
  return sendAdminAlertSMS({
    adminPhone: data.adminPhone,
    title: "Manual Payment Needed",
    message: `Order #${data.orderId} (${data.customerName}): Rs. ${data.amount} - ${data.method.toUpperCase()}`,
    severity: "high",
  });
}
