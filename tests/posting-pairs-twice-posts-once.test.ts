import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Pressing post twice must not put the pairs in twice.
 *
 * Nothing stopped it. The endpoint read an item and a count and wrote a stock
 * movement, so a double tap on a factory phone, a slow connection retried, or a
 * back-and-forward through the browser each added another sixty pairs to the
 * godown. Selling then draws on shoes that are not there.
 *
 * It matters more now than it did. The count used to be typed after a walk to
 * the godown, which made a second press deliberate; with the number pre-filled
 * and one press posting it, an accidental second press is a tap away.
 *
 * The app already answers this everywhere money moves: the caller sends a key
 * it owns and reuses on a retry, and the second arrival returns the first
 * result rather than doing the work again. lib/factory-mutations.ts has carried
 * that for the wage entries since they were written; this brings the stock side
 * to the same rule rather than inventing a second one.
 */
const ROUTE = "app/api/factory/ready/route.ts";
const SCREEN = "app/admin/factory/add-work/ReadyToPost.tsx";
const MIGRATION = "scripts/migrations/20260918_stock_movement_submission_key.sql";

describe("the second press does not post again", () => {
  it("takes a key from the caller", async () => {
    const route = await readFile(ROUTE, "utf8");

    // The caller owns the key and reuses it on a retry; a key made here would
    // be new every time and a retry would look like fresh work.
    expect(route).toMatch(/submission_key|Idempotency-Key/);
  });

  it("returns the first result instead of writing a second movement", async () => {
    const route = await readFile(ROUTE, "utf8");
    const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // A replay is a success, not an error: the pairs the caller asked for are
    // in stock, which is what they wanted to know.
    expect(code).toMatch(/replayed/);

    // Gated on the key itself, not on something a mutation can switch off while
    // leaving the query in place — `if (false)` around this lookup passed a
    // check that only asked whether the SELECT existed.
    expect(code, "the lookup must run when a key is sent").toMatch(
      /if\s*\(\s*submissionKey\s*\)\s*\{[\s\S]{0,300}FROM stock_movements[\s\S]{0,120}submission_key/i,
    );
    // And the first movement must be returned rather than a second written.
    expect(code, "the replay returns the movement already on file").toMatch(
      /if\s*\(\s*seen\[0\]\s*\)[\s\S]{0,260}replayed:\s*true/,
    );
  });

  it("sends a key that is the same on a retry and different on a new post", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // Same row, same pairs, same key — so a retry replays. Change the count and
    // it is a different post, which is the owner correcting themselves.
    expect(screen).toMatch(/submission_key/);
    expect(screen).toMatch(/groupKeyOf\(item\)/);
  });
});

describe("the database is what finally refuses", () => {
  it("adds the column and a unique index", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    // The check in the route narrows the race; only a unique index closes it.
    // Two presses landing in the same instant both read "no movement yet".
    expect(sql).toMatch(/ALTER TABLE stock_movements[\s\S]{0,120}submission_key/i);
    expect(sql).toMatch(/CREATE UNIQUE INDEX/i);
  });

  it("leaves rows without a key alone", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    // Three movements exist already and every older caller sends no key. A
    // unique index over NULLs would be fine, but a partial index says so.
    expect(sql).toMatch(/WHERE submission_key IS NOT NULL/i);
  });

  it("checks its own work", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    expect(sql).toMatch(/RAISE EXCEPTION/);
  });
});
