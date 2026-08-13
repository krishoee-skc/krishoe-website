import { NextRequest, NextResponse } from "next/server";
import { handleWhatsAppWebhook, verifyWhatsAppWebhook } from "@/lib/whatsapp-gateway";

// POST: Receive incoming WhatsApp messages
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-twilio-signature") || "";
    const url = process.env.TWILIO_WHATSAPP_WEBHOOK_URL || request.url;
    const body = await request.formData();
    const params = Object.fromEntries(
      Array.from(body.entries()).filter((entry): entry is [string, string] =>
        typeof entry[1] === "string",
      ),
    ) as Record<string, string>;

    if (!process.env.TWILIO_AUTH_TOKEN) {
      return NextResponse.json(
        { error: "WhatsApp webhook is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!verifyWhatsAppWebhook(signature, url, params)) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    await handleWhatsAppWebhook(params);

    // Respond with empty XML (Twilio requirement)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// GET: Health check
export async function GET() {
  return NextResponse.json(
    { status: process.env.TWILIO_AUTH_TOKEN ? "ready" : "not_configured" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
