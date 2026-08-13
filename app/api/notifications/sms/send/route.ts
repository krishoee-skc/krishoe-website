import { NextRequest, NextResponse } from "next/server";
import {
  sendOrderConfirmationSMS,
  sendPaymentLinkSMS,
  sendShippedSMS,
  sendOutForDeliverySMS,
  sendDeliveredSMS,
  sendWorkerPaymentAlertSMS,
  sendWorkerPaymentConfirmedSMS,
} from "@/lib/sms-gateway";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function POST(request: NextRequest) {
  try {
    // Check admin permission
    const adminUser = await requireAdminPermission("notifications:write");
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, data } = body;

    let result;

    switch (type) {
      case "order_confirmed":
        result = await sendOrderConfirmationSMS(data);
        break;

      case "payment_link":
        result = await sendPaymentLinkSMS(data);
        break;

      case "shipped":
        result = await sendShippedSMS(data);
        break;

      case "out_for_delivery":
        result = await sendOutForDeliverySMS(data);
        break;

      case "delivered":
        result = await sendDeliveredSMS(data);
        break;

      case "worker_payment_alert":
        result = await sendWorkerPaymentAlertSMS(data);
        break;

      case "worker_payment_confirmed":
        result = await sendWorkerPaymentConfirmedSMS(data);
        break;

      default:
        return NextResponse.json(
          { error: "Unknown notification type" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      messageId: result,
      type,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("SMS send error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send SMS",
      },
      { status: 500 }
    );
  }
}
