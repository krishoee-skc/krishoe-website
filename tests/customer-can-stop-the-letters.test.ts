import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A customer can stop the shop writing to them, and stopping is safe.
 *
 * Until now there was no unsubscribe anywhere in this app. A shopper who wanted
 * the letters to stop had exactly one lever, the spam button, and pressing it
 * does not only silence their own mail — it teaches the provider to distrust
 * the next hundred letters, including the order confirmations everybody else is
 * waiting for. The unsubscribe link is what protects those.
 *
 * There was also a file that promised this feature and could not deliver it:
 * lib/customer-engagement-gateway.ts wanted six tables, four of which already
 * existed in this shop under other names — a second list of customers, a second
 * list of orders. Building it would have meant two answers to "what did they
 * buy". It is deleted; this is the one thing in it the shop genuinely lacked.
 */

const LIB = "lib/customer-email-choice.ts";
const MIGRATION = "scripts/migrations/20260826_customer_email_choice.sql";
const SENDER = "lib/review-requests.ts";
const ACTION = "app/account/email-choice/actions.ts";

describe("a customer can stop the letters", () => {
  it("keeps one customer list — the duplicate gateway is gone", () => {
    // Its six tables included `customers` and `customer_orders`, beside the
    // shop's own `users` and `orders`. Two places holding who bought what is
    // how a shop stops being able to answer the question at all.
    expect(() => readFileSync("lib/customer-engagement-gateway.ts", "utf8")).toThrow();
    expect(() => readFileSync("app/api/customers/route.ts", "utf8")).toThrow();
    expect(() => readFileSync("app/api/customers/orders/route.ts", "utf8")).toThrow();
  });

  it("hangs the choice off the shop's real customer list", () => {
    const migration = readFileSync(MIGRATION, "utf8");

    expect(migration).toContain("REFERENCES users(id) ON DELETE CASCADE");
    // One row per customer. Two rows would mean two answers.
    expect(migration).toContain("user_id TEXT PRIMARY KEY");
  });

  it("treats a customer nobody asked as not having refused", () => {
    const lib = readFileSync(LIB, "utf8");

    // No row means never asked, and never asked is not the same as "no". A
    // default row saying "they agreed" would be a record of consent nobody
    // gave.
    expect(lib).toContain("NEVER_ASKED");
    expect(lib).toContain("orderUpdates: true");
    expect(lib).toContain("reviewInvites: true");
  });

  it("still writes when the database cannot be asked", () => {
    const lib = readFileSync(LIB, "utf8");
    const may = lib.slice(lib.indexOf("export async function mayEmailCustomer"));

    // Fails open, deliberately, and only for this question: an unwanted review
    // invitation is a shrug, and a silent shop after somebody has paid is a
    // customer who thinks their money vanished.
    expect(may).toMatch(/catch\s*{\s*return true;\s*}/);
  });

  it("lets an emailed link only ever turn letters off", () => {
    const lib = readFileSync(LIB, "utf8");
    const unsub = lib.slice(lib.indexOf("export async function unsubscribeByToken"));

    // The token travels in an inbox and gets forwarded. It may silence review
    // invitations and do nothing else — it cannot switch anything back on, and
    // it cannot touch the order confirmation.
    expect(unsub).toContain("SET review_invites = false");
    expect(unsub).not.toContain("review_invites = true");
    expect(unsub).not.toContain("order_updates");
  });

  it("decides whose preference it is from the session, never the form", () => {
    const action = readFileSync(ACTION, "utf8");

    // A user id posted in a form would let anybody silence anybody — a small
    // harm with a large surprise, since the victim would simply stop hearing
    // from the shop and never learn why.
    expect(action).toContain("getCurrentCustomer()");
    expect(action).not.toMatch(/formData\.get\(\s*["']userId["']\s*\)/);
  });

  it("asks before sending the letter nobody ordered", () => {
    const sender = readFileSync(SENDER, "utf8");

    expect(sender).toContain('mayEmailCustomer(order.customer_user_id ?? undefined, "reviewInvites")');
    // Marked as asked either way, so a refusal is not reconsidered every
    // morning for the rest of the shop's life.
    expect(sender).toContain("await markAsked(order.id);");
    expect(sender).toContain("unsubscribeUrl");
  });

  it("never gates the letter that confirms an order", () => {
    // Somebody who has just paid is owed the record of it. The preference
    // exists so review invitations can stop; an order confirmation is not
    // marketing, and the send path must not consult the choice at all.
    const notifications = readFileSync("lib/notifications.ts", "utf8");
    const confirmation = notifications.slice(
      notifications.indexOf("export async function notifyOrderConfirmation"),
      notifications.indexOf("export async function notifyReviewRequested"),
    );

    expect(confirmation).not.toContain("mayEmailCustomer");
  });

  it("puts the review link in the review letter", () => {
    // textSummary has a branch per event type and had none for this one, so
    // the invitation fell through to the contact-message shape and went out as
    // "Name: undefined / Message: undefined" — without the link, which is the
    // entire point of the letter.
    const notifications = readFileSync("lib/notifications.ts", "utf8");
    const branch = notifications.slice(
      notifications.indexOf('if (event.type === "review-request")'),
      notifications.indexOf('if (event.type === "email-verification")'),
    );

    expect(branch, "review-request has its own branch").toBeTruthy();
    expect(branch).toContain("invite.reviewUrl");
    expect(branch).toContain("invite.productName");
    expect(branch).toContain("invite.unsubscribeUrl");
    // A guest order carries no link, and an empty line where one would go is
    // worse than none at all.
    expect(branch).toContain(".filter(Boolean)");
  });
});
