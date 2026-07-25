import { describe, expect, it } from "vitest";
import { textSummary, type NotificationEvent } from "@/lib/notifications";

describe("professional order notification", () => {
  it("hides internal product ids while preserving useful order details", () => {
    const event: NotificationEvent = {
      id: "NTF-1",
      createdAt: "2026-07-25T00:00:00.000Z",
      type: "order",
      title: "New order request KRS-1",
      payload: {
        id: "KRS-1",
        createdAt: "2026-07-25T00:00:00.000Z",
        name: "Krishna",
        email: "customer@example.com",
        phone: "9800000000",
        address: "Bharatpur",
        delivery: "Nationwide courier coordination",
        payment: "Cash on delivery",
        paymentProvider: "cod",
        paymentStatus: "Pending",
        paymentReference: "",
        paymentTransactionId: "",
        paymentCallbackId: "",
        order:
          "1. Ladies Heel (draft-ladies-heel)\n   Size: 36 / Color: Black / Qty: 1\n   Line total: Rs. 1,799",
        items: [
          {
            productId: "draft-ladies-heel",
            productName: "Ladies Heel",
            size: "36",
            color: "Black",
            quantity: 1,
          },
        ],
        total: "Rs. 1,799",
        status: "New",
        customerUserId: "",
      },
      deliveryStatus: "pending",
      deliveryAttempts: 0,
      lastDeliveryError: "",
      lastDeliveryChannel: "",
    };

    const summary = textSummary(event);
    expect(summary).toContain("1. Ladies Heel");
    expect(summary).toContain("Size: 36 / Color: Black / Qty: 1");
    expect(summary).toContain("Line total: Rs. 1,799");
    expect(summary).not.toContain("draft-ladies-heel");
  });
});
