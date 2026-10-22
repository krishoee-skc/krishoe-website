import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { orderCameFromWhatsApp, whatsappOrderKey, WHATSAPP_ORDER_KEY_PREFIX } from "@/lib/whatsapp-order";

const read = (path: string) => readFileSync(path, "utf8");

// Owner, 2026-10-21: "mero whatsapp ma eauta order aako thiyo yaha dekhiyena".
describe("a WhatsApp order typed in on the order desk", () => {
  it("is marked by its checkout key, which the checkout still accepts", () => {
    const key = whatsappOrderKey("3b241101-e2bb-4255-8caf-4136c566a962");
    expect(key).toBe(`${WHATSAPP_ORDER_KEY_PREFIX}3b241101-e2bb-4255-8caf-4136c566a962`);
    // lib/checkout-order.ts refuses any key outside this shape.
    expect(key).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(orderCameFromWhatsApp({ checkoutSubmissionKey: key })).toBe(true);
  });

  it("leaves website orders and old orders unmarked", () => {
    expect(orderCameFromWhatsApp({ checkoutSubmissionKey: "3b241101-e2bb-4255-8caf-4136c566a962" })).toBe(false);
    expect(orderCameFromWhatsApp({})).toBe(false);
  });

  it("refuses a form key that is missing or not its own", () => {
    expect(whatsappOrderKey("")).toBe("");
    expect(whatsappOrderKey("short")).toBe("");
    expect(whatsappOrderKey("x".repeat(65))).toBe("");
    expect(whatsappOrderKey("bad key with spaces 123")).toBe("");
  });

  it("is saved through the website's own checkout, by someone who may change orders", () => {
    const actions = read("app/admin/actions.ts");
    const body = actions.slice(actions.indexOf("export async function addWhatsAppOrderAction"));
    expect(body).toContain('requireAdminPermission("orders:write")');
    expect(body).toContain("placeCheckoutOrder({");
    expect(body).toContain("checkoutSubmissionKey: key");
    expect(body).toContain("validateCustomerProfileInput(");
    expect(body).toContain('submittedCode: ""');
  });

  it("has its button on the Orders page and its mark in the list", () => {
    expect(read("app/admin/orders/page.tsx")).toContain("<AddWhatsAppOrder");
    expect(read("app/admin/orders/AddWhatsAppOrder.tsx")).toContain("Add a WhatsApp order");
    expect(read("app/admin/OrdersClient.tsx")).toContain("orderCameFromWhatsApp(order) ? <WhatsAppChip />");
  });
});
