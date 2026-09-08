import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A wage paid once, recorded twice.
 *
 * It happened on 2026-09-08: Rs. 9,720 handed to one worker and saved twice,
 * twenty-three seconds apart. The ledger then showed Rs. 19,440 paid against
 * Rs. 9,720 earned, and a balance of minus Rs. 9,720 — a shop that looks like
 * it overpaid a worker by a week's wages.
 *
 * The idempotency key did not catch it and could not: it guards a retry of one
 * submission, and rotates after a success, so pressing Save a second time is a
 * new key and a genuinely new payment as far as the server can see. The check
 * has to be about the payment itself.
 */
const MUTATIONS = "lib/factory-mutations.ts";

describe("paying the same worker twice by accident", () => {
  it("is refused when the same amount was paid minutes ago", async () => {
    const source = await readFile(MUTATIONS, "utf8");
    const guard = source.slice(source.indexOf('input.entryType === "payment" && input.paymentGiven > 0'));

    expect(guard, "no guard against a repeated payment").toBeTruthy();
    expect(guard).toContain("worker_id = $1");
    expect(guard).toContain("date = $2::date");
    expect(guard).toContain("payment_given = $3");
    expect(guard).toContain("interval '10 minutes'");
  });

  it("does not count a payment that was already reversed", async () => {
    const source = await readFile(MUTATIONS, "utf8");
    const start = source.indexOf('input.entryType === "payment" && input.paymentGiven > 0');
    const guard = source.slice(start, source.indexOf("LIMIT 1", start));

    // A payment corrected by reversing it must not block the corrected one from
    // being entered again.
    expect(guard).toContain("status <> 'reversed'");
  });

  it("explains itself rather than just refusing", async () => {
    const source = await readFile(MUTATIONS, "utf8");

    // The person is standing there with the cash. "Already paid" without
    // saying when is a message that gets ignored.
    expect(source).toContain("was already paid this amount");
    expect(source).toContain("minute");
  });

  it("leaves earned-wage entries alone", async () => {
    const source = await readFile(MUTATIONS, "utf8");
    const start = source.indexOf('input.entryType === "payment" && input.paymentGiven > 0');
    const guard = source.slice(start, source.indexOf("LIMIT 1", start));

    // Four rows of sixty pairs at the same rate on the same day is a normal
    // morning, not a mistake. Only payments are checked.
    expect(guard).toContain("entry_type = 'payment'");
  });
});

describe("the balance a reversed entry leaves behind", () => {
  it("is left out of every sum that decides what is owed", async () => {
    const source = await readFile(MUTATIONS, "utf8");

    // Reversing is how a wrong entry is corrected — the row stays for the
    // record and stops counting. Every place that adds up wages has to agree,
    // or the ledger and the payroll disagree about the same worker.
    const sums = source.match(/SUM\(COALESCE\(amount_earned/g) ?? [];
    expect(sums.length).toBeGreaterThan(1);

    for (const index of [...source.matchAll(/SUM\(COALESCE\(amount_earned/g)].map((m) => m.index ?? 0)) {
      const query = source.slice(index, index + 420);
      expect(query, "a wage sum that counts reversed rows").toContain("'reversed'");
    }
  });
});
