import { queryPostgres } from "@/lib/postgres/client";
import twilio from "twilio";

const STORE = "krishoe";

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

let twilioClient: ReturnType<typeof twilio> | null = null;

if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
}

export interface WhatsAppMessage {
  to: string;
  template?: string;
  variables?: Record<string, string>;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "document" | "audio" | "video";
}

export interface WhatsAppMessageRecord {
  id: string;
  from_number: string;
  to_number: string;
  message_text: string;
  message_type: string;
  direction: string;
  status: string;
  created_at: string;
}

// Send WhatsApp message
export async function sendWhatsAppMessage(params: WhatsAppMessage): Promise<string> {
  if (!twilioClient || !twilioWhatsAppNumber) {
    console.error("WhatsApp gateway not configured");
    return "";
  }

  try {
    let messageBody = params.text || "";

    // If using template, render with variables
    if (params.template && params.variables) {
      messageBody = renderTemplate(params.template, params.variables);
    }

    let message;

    if (params.mediaUrl) {
      // Send media message
      message = await twilioClient.messages.create({
        from: `whatsapp:${twilioWhatsAppNumber}`,
        to: `whatsapp:${params.to}`,
        mediaUrl: params.mediaUrl ? [params.mediaUrl] : undefined,
        body: messageBody || "Attachment",
      });
    } else {
      // Send text message
      message = await twilioClient.messages.create({
        from: `whatsapp:${twilioWhatsAppNumber}`,
        to: `whatsapp:${params.to}`,
        body: messageBody,
      });
    }

    // Save to database
    await saveWhatsAppMessage({
      id: message.sid,
      from_number: twilioWhatsAppNumber,
      to_number: params.to,
      message_text: messageBody,
      message_type: params.mediaUrl ? params.mediaType || "document" : "text",
      direction: "outbound",
      status: "sent",
    });

    return message.sid;
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
    throw new Error(`WhatsApp send failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// Save message to database
export async function saveWhatsAppMessage(message: Omit<WhatsAppMessageRecord, "created_at">) {
  try {
    await queryPostgres(
      STORE,
      `INSERT INTO whatsapp_messages (id, from_number, to_number, message_text, message_type, direction, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [message.id, message.from_number, message.to_number, message.message_text, message.message_type, message.direction, message.status]
    );
  } catch (error) {
    console.error("Failed to save WhatsApp message:", error);
  }
}

// Get message history for a number
export async function getWhatsAppHistory(phoneNumber: string, limit: number = 50): Promise<WhatsAppMessageRecord[]> {
  try {
    const messages = await queryPostgres<WhatsAppMessageRecord>(
      STORE,
      `SELECT * FROM whatsapp_messages
       WHERE from_number = $1 OR to_number = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [phoneNumber, limit]
    );
    return messages;
  } catch (error) {
    console.error("Failed to fetch WhatsApp history:", error);
    return [];
  }
}

// Send template message
export async function sendTemplateMessage(
  phoneNumber: string,
  templateName: string,
  variables: Record<string, string>
): Promise<string> {
  return sendWhatsAppMessage({
    to: phoneNumber,
    template: templateName,
    variables,
  });
}

// Render template with variables
function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(`{${key}}`, value || "");
  }
  return result;
}

// Handle incoming webhook
export async function handleWhatsAppWebhook(data: Record<string, string>) {
  try {
    const fromNumber = data.From?.replace("whatsapp:", "") || "";
    const messageBody = data.Body || "";
    const messageSid = data.MessageSid || "";

    // Save incoming message
    await saveWhatsAppMessage({
      id: messageSid,
      from_number: fromNumber,
      to_number: twilioWhatsAppNumber || "",
      message_text: messageBody,
      message_type: "text",
      direction: "inbound",
      status: "received",
    });

    // Process message (can add custom logic here)
    console.log(`Received WhatsApp message from ${fromNumber}: ${messageBody}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to handle WhatsApp webhook:", error);
    throw error;
  }
}

// Verify webhook token (Twilio security)
export function verifyWhatsAppWebhook(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!authToken || !signature) return false;

  return twilio.validateRequest(authToken, signature, url, params);
}

// Send admin notification
export async function sendAdminNotification(message: string): Promise<string> {
  const adminNumber = process.env.WHATSAPP_ADMIN_NUMBER;
  if (!adminNumber) {
    console.error("Admin WhatsApp number not configured");
    return "";
  }

  return sendWhatsAppMessage({
    to: adminNumber,
    text: message,
  });
}

// Send work entry notification
export async function notifyWorkEntry(data: {
  workerName: string;
  productName: string;
  pairsCount: number;
  amount: number;
}): Promise<string> {
  const message = `नयाँ काम entry:
👤 Worker: ${data.workerName}
📦 Product: ${data.productName}
📊 Pairs: ${data.pairsCount}
💰 Amount: Rs. ${data.amount.toLocaleString()}`;

  return sendAdminNotification(message);
}

// Send daily summary
export async function sendDailySummary(data: {
  totalPairs: number;
  totalAmount: number;
  workersCount: number;
  completedTasks: number;
  inProgress: number;
}): Promise<string> {
  const message = `📊 आज को Summary:
📈 Total Pairs: ${data.totalPairs}
💵 Total Amount: Rs. ${data.totalAmount.toLocaleString()}
👥 Workers: ${data.workersCount}
✅ Completed: ${data.completedTasks}
⏳ In Progress: ${data.inProgress}`;

  return sendAdminNotification(message);
}

// Send payment reminder
export async function sendPaymentReminder(data: {
  workerName: string;
  amount: number;
  dueDate: string;
}): Promise<string> {
  const message = `💰 Payment Reminder:
👤 Worker: ${data.workerName}
💵 Amount: Rs. ${data.amount.toLocaleString()}
📅 Due: ${data.dueDate}`;

  return sendAdminNotification(message);
}

// Send order confirmation (future - for customer orders)
export async function sendOrderConfirmation(data: {
  customerName: string;
  orderId: string;
  totalAmount: number;
  deliveryDate: string;
}): Promise<string> {
  const message = `✅ Order Confirmed!
नमस्ते ${data.customerName}!
Order ID: #${data.orderId}
Amount: Rs. ${data.totalAmount.toLocaleString()}
Delivery: ${data.deliveryDate}`;

  return sendAdminNotification(message);
}
