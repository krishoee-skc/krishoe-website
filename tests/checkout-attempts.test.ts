import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * There is no cart table to recover from — the cart lives in the browser. What
 * the shop can see is the moment a shopper identifies themselves on the
 * checkout page: pairs chosen, address typed, and then nothing. Everything
 * except the last tap already happened, which makes one reminder the cheapest
 * order this shop will ever take.
 */
describe("remembering a checkout", () => {
  it("captures once the email is given, not on every keystroke", async () => {
    const checkout = await readFile("components/CheckoutClient.tsx", "utf8");
    expect(checkout).toContain("onBlur={(event) => rememberAttempt(event.currentTarget.form)}");
  });

  it("never makes the shopper wait for it", async () => {
    const checkout = await readFile("components/CheckoutClient.tsx", "utf8");
    // A shopper waiting on a background note is a shopper waiting for nothing.
    expect(checkout).toContain("void rememberCheckoutAttemptAction(data)");
  });

  it("prices the basket on the server", async () => {
    const action = await readFile("app/checkout/actions.ts", "utf8");
    // The reminder quotes a total, and a total supplied by the browser is a
    // number the shopper chose.
    expect(action).toContain("computeAuthoritativeOrderTotal(items)");
    expect(action).not.toContain('textValue(formData, "total")');
  });

  it("keeps one row per shopper", async () => {
    const migration = await readFile(
      "scripts/migrations/20260816_checkout_attempts.sql",
      "utf8",
    );
    const store = await readFile("lib/checkout-attempts.ts", "utf8");

    // Opening checkout three times in an evening is one basket, not three, and
    // must never send three reminders.
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS checkout_attempts_email_idx");
    expect(store).toContain("ON CONFLICT (lower(email)) DO UPDATE SET");
    // Coming back resets the clock: they are still deciding.
    expect(store).toContain("created_at = now()");
    expect(store).toContain("reminded_at = NULL");
  });
});

describe("the reminder", () => {
  it("waits a few hours and gives up after a week", async () => {
    const store = await readFile("lib/checkout-attempts.ts", "utf8");
    // Nobody is chased while still choosing, and a message about a basket
    // forgotten eight days ago reads as a shop that was watching.
    expect(store).toContain("options.minHours ?? 4");
    expect(store).toContain("options.maxDays ?? 7");
  });

  it("goes out at most once per basket", async () => {
    const route = await readFile("app/api/cron/checkout-reminders/route.ts", "utf8");
    const store = await readFile("lib/checkout-attempts.ts", "utf8");

    expect(store).toContain("WHERE reminded_at IS NULL");
    // Marked only after a successful send — marking a failed delivery means a
    // shopper who is never written to at all.
    const sendBlock = route.slice(route.indexOf("if (delivery.ok)"));
    expect(sendBlock).toContain("markAttemptReminded(attempt.id)");
  });

  it("is guarded like the other crons", async () => {
    const route = await readFile("app/api/cron/checkout-reminders/route.ts", "utf8");
    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain("Unauthorized");
  });

  it("is actually scheduled", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      crons: { path: string }[];
    };
    expect(config.crons.map((cron) => cron.path)).toContain("/api/cron/checkout-reminders");
  });
});

describe("when the order finally arrives", () => {
  it("stops chasing the basket", async () => {
    const actions = await readFile("app/actions.ts", "utf8");
    // Whether or not a reminder was ever sent: nobody should be chased for a
    // basket they already paid for.
    expect(actions).toContain("markCheckoutRecovered(email, record.id)");
  });
});
