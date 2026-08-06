import { NextRequest, NextResponse } from "next/server";
import { handleWhatsAppWebhook, verifyWhatsAppWebhook } from "@/lib/whatsapp-gateway";

// POST: Receive incoming WhatsApp messages
export async function POST(request: NextRequest) {
  try {
    // Verify webhook token for security
    const url = request.url;
    const body = await request.formData();
    const params = Object.fromEntries(
      Array.from(body.entries()).filter(([_, v]) => typeof v === 'string') as Array<[string, string]>
    ) as Record<string, string>;

    const token = process.env.TWILIO_AUTH_TOKEN || "";

    // Note: In production, verify the webhook signature
    // const isValid = verifyWhatsAppWebhook(token, url, params);
    // if (!isValid) {
    //   return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    // }

    // Handle the incoming message
    const result = await handleWhatsAppWebhook(params);

    // Respond with empty XML (Twilio requirement)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: {
        "Content-Type": "application/xml",
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
  return NextResponse.json({ status: "WhatsApp webhook ready" });
}
