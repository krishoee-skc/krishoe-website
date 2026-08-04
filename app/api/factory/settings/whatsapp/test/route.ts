import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { sendWhatsAppMessage } from "@/lib/whatsapp-gateway";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/settings/whatsapp/test", "POST");
  if (denied) return denied;

  try {
    const body = await request.json();
    const { phoneNumber, message } = body;

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { error: "phoneNumber and message are required" },
        { status: 400 }
      );
    }

    const messageId = await sendWhatsAppMessage({
      to: phoneNumber,
      text: message,
    });

    if (!messageId) {
      return NextResponse.json(
        { error: "WhatsApp gateway not configured or failed to send" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test message sent successfully",
      messageId,
    });
  } catch (error) {
    console.error("Error sending test message:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send test message",
      },
      { status: 500 }
    );
  }
}
