import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ASK_AFTER_DAYS,
  createReviewToken,
  readReviewToken,
  reviewInviteUrl,
} from "@/lib/review-invite";

const MIGRATION = "scripts/migrations/20260823_review_invites.sql";
const TYPES = "scripts/migrations/20260823_notification_types.sql";
const REQUESTS = "lib/review-requests.ts";
const FORM = "app/review/[token]/ReviewInviteForm.tsx";
const PAGE = "app/review/[token]/page.tsx";
const ACTIONS = "app/review/[token]/actions.ts";
const CRON = "app/api/cron/daily-sales/route.ts";

/** Source with comments removed. */
function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

beforeAll(() => {
  // The token is signed with the admin session secret; without one, every
  // token is null and every assertion below would pass for the wrong reason.
  process.env.ADMIN_SESSION_SECRET ||= "test-secret-long-enough-to-sign-with";
});

/**
 * The shop has seven products with real photographs and no reviews at all. The
 * review form already built opens only to a signed-in customer who can be
 * matched to a closed order — correct, and also why it has produced nothing:
 * almost nobody makes an account to praise a slipper.
 *
 * So the proof of purchase travels in the link. Which means the link is the
 * security boundary, and it has to hold.
 */
describe("the signed review link", () => {
  it("opens for the order and pair it was made for", () => {
    const token = createReviewToken({ orderId: "KRS-1", productId: "P-9" });
    const invite = readReviewToken(token ?? "");

    expect(invite?.orderId).toBe("KRS-1");
    expect(invite?.productId).toBe("P-9");
  });

  it("refuses a signature that has been altered", () => {
    const token = createReviewToken({ orderId: "KRS-1", productId: "P-9" }) ?? "";

    expect(readReviewToken(token.slice(0, -4) + "aaaa")).toBeNull();
  });

  it("refuses a different pair swapped into the same link", () => {
    const token = createReviewToken({ orderId: "KRS-1", productId: "P-9" }) ?? "";
    const parts = token.split(".");
    const swapped = [
      parts[0],
      Buffer.from("P-OTHER").toString("base64url"),
      parts[2],
      parts[3],
    ].join(".");

    // Otherwise one emailed link would review the whole catalogue.
    expect(readReviewToken(swapped)).toBeNull();
  });

  it("expires", () => {
    const stale = createReviewToken({
      orderId: "KRS-1",
      productId: "P-9",
      expiresAt: Date.now() - 1000,
    });

    expect(readReviewToken(stale ?? "")).toBeNull();
  });

  it("refuses rubbish without throwing at the customer", () => {
    expect(readReviewToken("")).toBeNull();
    expect(readReviewToken("garbage")).toBeNull();
    expect(readReviewToken("a.b.c.d")).toBeNull();
  });

  it("builds a URL without doubling the slash", () => {
    expect(reviewInviteUrl("https://shop.example/", "TOKEN")).toBe(
      "https://shop.example/review/TOKEN",
    );
  });

  it("signs with a secret the shop already requires", async () => {
    const lib = await readFile("lib/review-invite.ts", "utf8");

    // A second secret is a second thing to set on the host and forget.
    expect(lib).toContain("ADMIN_SESSION_SECRET");
    expect(lib).toContain("timingSafeEqual");
  });
});

describe("who gets asked, and when", () => {
  it("waits until the pair could have been worn", async () => {
    const requests = await readFile(REQUESTS, "utf8");

    // Asking the day it ships gets a review of the delivery.
    expect(ASK_AFTER_DAYS).toBe(7);
    expect(requests).toContain("created_at < NOW() - ($1 * INTERVAL '1 day')");
    expect(requests).toContain("status = 'Closed'");
  });

  it("asks once, even for a customer who cannot be reached", async () => {
    const requests = await readFile(REQUESTS, "utf8");
    const sql = await readFile(MIGRATION, "utf8");

    // A shop that mails the same person every morning has done more damage
    // than a missing review ever would.
    expect(requests).toContain("review_invite_sent_at IS NULL");
    expect(requests).toContain("SET review_invite_sent_at = now()");
    expect(sql).toContain("review_invite_sent_at timestamptz");
  });

  it("asks about one pair, not every pair on the order", async () => {
    const requests = await readFile(REQUESTS, "utf8");

    // Two forms in one email is how a customer fills in neither.
    expect(requests).toContain("function pickProduct");
    expect(requests).toContain("items.find(");
  });

  it("lets one failure not stop the run", async () => {
    const requests = await readFile(REQUESTS, "utf8");

    expect(requests).toContain("} catch (error) {");
    expect(requests).toContain("result.skipped += 1");
  });

  it("cannot write the same review twice", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS customer_voice_one_review_per_order_idx");
    expect(sql).toContain("WHERE kind = 'review' AND order_id <> ''");
  });
});

/**
 * The email is addressed to the customer, not the owner, which is why it needs
 * its own type — and the table listing acceptable types refused it, along with
 * staff-security, which the code had been sending unsuccessfully for some time.
 */
describe("the notification the shop sends", () => {
  it("is a type the table will accept", async () => {
    const sql = await readFile(TYPES, "utf8");

    expect(sql).toContain("'review-request'");
    // Sent by lib/notifications.ts and rejected by this constraint until now.
    expect(sql).toContain("'staff-security'");
  });

  it("goes to the customer's address, not the owner's", async () => {
    const notifications = await readFile("lib/notifications.ts", "utf8");
    const routing = notifications.slice(notifications.indexOf("function getConfiguredChannels"));

    expect(routing).toContain('event?.type === "review-request"');
    expect(routing).toContain("ReviewRequestNotificationPayload");
  });

  it("rides the daily cron rather than claiming a schedule of its own", async () => {
    const cron = await readFile(CRON, "utf8");
    const vercel = JSON.parse(await readFile("vercel.json", "utf8"));

    expect(cron).toContain("sendReviewRequests(orderItemsFor)");
    expect(vercel.crons).toHaveLength(3);
  });
});

describe("what the customer has to do", () => {
  it("needs no account", async () => {
    const page = await readFile(PAGE, "utf8");
    const actions = code(await readFile(ACTIONS, "utf8"));

    // The whole point: the signature is the proof of purchase.
    expect(actions).not.toContain("getCurrentCustomer");
    expect(page).not.toContain("getCurrentCustomer");
    expect(actions).toContain("readReviewToken(token)");
  });

  it("takes what it trusts from the token, never from the form", async () => {
    const actions = await readFile(ACTIONS, "utf8");

    // A posted orderId would be a field anybody could type.
    expect(actions).toContain("invite.orderId");
    expect(actions).toContain("invite.productId");
    expect(actions).not.toContain('formData.get("orderId")');
    expect(actions).not.toContain('formData.get("productId")');
  });

  it("checks the pair was actually on that order", async () => {
    const actions = await readFile(ACTIONS, "utf8");

    // A token proves the shop sent the link, not what the link may say.
    expect(actions).toContain("order.items.some(");
  });

  it("says the same thing for every kind of bad link", async () => {
    const actions = await readFile(ACTIONS, "utf8");
    const message = "यो लिङ्क चल्दैन वा म्याद सकिएको छ।";

    // A failed token should not tell whoever sent it which part failed.
    expect(actions.split(message).length - 1).toBeGreaterThanOrEqual(3);
  });

  it("keeps the name optional", async () => {
    const form = await readFile(FORM, "utf8");

    // The order already has a name, and the shop would rather have an unsigned
    // review than none.
    expect(form).toContain("नलेखे पनि हुन्छ");
  });

  it("stays out of search results", async () => {
    const page = await readFile(PAGE, "utf8");

    // A review link is per-customer; a crawler following one would be asking
    // the shop to render a stranger's order.
    expect(page).toContain("robots: { index: false, follow: false }");
  });
});

describe("what happens to the review", () => {
  it("waits for the owner before it reaches the storefront", async () => {
    const actions = await readFile(ACTIONS, "utf8");
    const form = await readFile(FORM, "utf8");

    // saveCustomerVoice defaults published to false; the customer is told so.
    expect(actions).toContain('kind: "review"');
    expect(actions).not.toContain("published: true");
    expect(form).toContain("KRISHOE ले हेरेर मात्र पसलमा देखाइन्छ");
  });

  it("says thank you rather than an error on a second tap", async () => {
    const actions = await readFile(ACTIONS, "utf8");

    // The unique index catches it; "already received" is true and calm.
    expect(actions).toContain('=== "23505"');
    expect(actions).toContain("पहिल्यै आइसकेको छ");
  });
});
