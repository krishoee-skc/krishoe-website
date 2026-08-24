import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const NOTIFICATIONS = "lib/notifications.ts";
const ACTIONS = "app/actions.ts";
const MIGRATION = "scripts/migrations/20260823_order_confirmation_type.sql";

/** Source with comments removed. */
function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

/**
 * A customer placed an order and got nothing.
 *
 * The screen said "Order request saved. Reference: KRS-…", and closing the tab
 * took both the reference and the reassurance with it. The owner got an email
 * and a push; the person who had just agreed to pay cash on delivery got a line
 * of text they could not keep. That silence sits exactly where a first-time
 * buyer is deciding whether the shop is real.
 */
describe("what the buyer is told", () => {
  it("is sent to the buyer, not the owner", async () => {
    const notifications = await readFile(NOTIFICATIONS, "utf8");
    const routing = notifications.slice(notifications.indexOf("function getConfiguredChannels"));

    // Most events are the shop telling itself something and go to
    // ADMIN_NOTIFICATION_EMAIL. This one goes to the address on the order.
    expect(routing).toContain('event?.type === "order-confirmation"');
    expect(routing).toContain("OrderConfirmationNotificationPayload");
  });

  it("carries the number they will quote back", async () => {
    const notifications = await readFile(NOTIFICATIONS, "utf8");

    expect(notifications).toContain("अर्डर नम्बर: ${order.orderId}");
    expect(notifications).toContain("तपाईंको अर्डर आयो — ${payload.orderId}");
  });

  it("says who to ring", async () => {
    const notifications = await readFile(NOTIFICATIONS, "utf8");

    // A confirmation the buyer cannot act on is a receipt, not a reassurance.
    expect(notifications).toContain("९८५५०१९३५१");
    expect(notifications).toContain("WhatsApp ९७६६६३०१९३");
    expect(notifications).toContain("order.trackUrl");
  });

  it("is written in the language the buyer reads", async () => {
    const notifications = await readFile(NOTIFICATIONS, "utf8");
    const body = notifications.slice(
      notifications.indexOf('if (event.type === "order-confirmation")'),
      notifications.indexOf('if (event.type === "password-reset")'),
    );

    expect(body).toContain("नमस्कार");
    expect(body).toContain("KRISHOE मा अर्डर गर्नुभएकोमा धन्यवाद");
    expect(body).toContain("कमलनगर, नारायणगढ");
  });

  // The letter went out in Nepali whichever language the shop had been
  // switched to. Somebody's brother abroad, who had read the whole shop in
  // English and paid for a pair to be sent to their mother, got back the one
  // message from the shop they could not read.
  it("answers in English when the shop was read in English", async () => {
    const notifications = await readFile(NOTIFICATIONS, "utf8");
    const body = notifications.slice(
      notifications.indexOf('if (event.type === "order-confirmation")'),
      notifications.indexOf('if (event.type === "password-reset")'),
    );

    expect(body).toContain('order.language === "en"');
    expect(body).toContain("Thank you for ordering from KRISHOE");
    expect(body).toContain("Order number: ${order.orderId}");
    // The subject is the half that shows in the inbox before anything is
    // opened, so it turns as well.
    expect(notifications).toContain('payload.language === "en"');
    expect(notifications).toContain("We have your order — ${payload.orderId}");
  });

  it("stays Nepali unless the checkout says otherwise", async () => {
    const actions = await readFile(ACTIONS, "utf8");

    // An order placed by any other route sends no language at all, and must
    // keep the Nepali letter this shop has always sent.
    expect(code(actions)).toContain('language: textValue(formData, "language") === "en" ? "en" : "ne"');
  });

  it("is told the language by the checkout, which is the only place that knows it", async () => {
    const checkout = await readFile("components/CheckoutClient.tsx", "utf8");

    // The choice lives in the browser's own storage. No server can read it, so
    // the form has to carry it or the shop cannot know.
    expect(code(checkout)).toContain('<input type="hidden" name="language" value={language} />');
  });

  it("is a type the table will accept", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    // A type the CHECK does not list is rejected rather than stored, and the
    // failure is filed rather than raised — which is how staff-security went
    // unsent for weeks.
    expect(sql).toContain("'order-confirmation'");
  });
});

describe("when it is sent", () => {
  it("goes after the order is saved, never in front of it", async () => {
    const actions = await readFile(ACTIONS, "utf8");
    const checkout = actions.slice(actions.indexOf("export async function submitCheckout"));

    const saved = checkout.indexOf("await saveOrder(");
    const confirmed = checkout.indexOf("notifyOrderConfirmation({");

    expect(saved).toBeGreaterThan(-1);
    expect(confirmed).toBeGreaterThan(saved);
  });

  it("cannot turn a saved order into an error", async () => {
    const actions = await readFile(ACTIONS, "utf8");

    // reportingErrors files the failure and returns; a mail that fails must not
    // tell the customer to place the order again.
    expect(actions).toContain("`confirm order ${record.id} to the customer`");
    expect(actions).toContain("reportingErrors");
  });

  it("does not treat ordering by phone as a failure", async () => {
    const actions = code(await readFile(ACTIONS, "utf8"));

    // Email is optional on an order — ordering by phone alone is ordinary here.
    expect(actions).toContain('const customerEmail = record.email?.trim() ?? ""');
    expect(actions).toContain("if (customerEmail) {");
  });
});
