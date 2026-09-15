import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The count-in box, which the screen promised and did not have.
 *
 * When pairs are in stock with no place, the Stock screen says so and tells the
 * owner to "count them in below". There was nothing below. setPlaceCount() and
 * setPlaceCountAction() were both written and both correct — no screen called
 * either, so the instruction pointed at a control that did not exist and the
 * owner could not do the one thing the warning asked for.
 *
 * The other form on this screen writes a challan, which cannot do this job: a
 * challan moves pairs from one place to the other, so it only lists shoes that
 * already have a place. Pairs with no place never appear in it. And a challan
 * would be a lie — nothing travelled, somebody counted.
 */
const SCREEN = "app/admin/stock/WherePairsAre.tsx";
const ACTIONS = "app/admin/stock/actions.ts";

describe("the box the warning points at", () => {
  it("exists and calls the counting action", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen, "the screen must import it").toContain("setPlaceCountAction");
    // Not merely imported — actually submitted from the screen.
    expect(screen, "and actually call it").toMatch(/setPlaceCountAction\(\s*null\s*,/);
  });

  it("sends every field the action reads", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // The action reads these four by name. A missing one is silently defaulted
    // — sizeRun to "Mixed", pairs to 0 — which writes a row that matches
    // nothing, the exact failure this box exists to repair.
    for (const field of ["design", "sizeRun", "location", "pairs"]) {
      expect(screen, `${field} must be posted`).toContain(`name="${field}"`);
    }
  });

  it("offers the shoes that have no place", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // The challan list filters to pairs already at a place. This one must not:
    // filtering the same way would hide precisely the rows that need counting.
    const form = screen.slice(screen.indexOf("function handleCount"));
    expect(form.length, "the count handler moved").toBeGreaterThan(0);
    expect(screen, "unplaced rows must be offered").toContain("row.unplaced");
  });
});

describe("what the box must not do", () => {
  it("refuses to place more pairs than are in stock", async () => {
    const screen = await readFile(SCREEN, "utf8");

    const form = screen.slice(
      screen.indexOf("function handleCount"),
      screen.indexOf("function handleReceive"),
    );

    expect(form.length, "the count handler moved").toBeGreaterThan(0);
    // The comparison itself, not merely a mention of the total: a guard stubbed
    // out to `if (false)` still leaves the words "counted.total" in the file.
    // Placing 60 pairs of a shoe that has 48 must be refused here, on the
    // screen, or the row renders -12 under "No place" — a worse lie than blank.
    expect(form, "must compare the count against the row total").toMatch(
      /if\s*\(\s*pairs\s*>\s*counted\.total\s*\)/,
    );
    // And refuse, rather than warn and carry on into the write.
    expect(form, "the refusal must return").toMatch(/counted\.total[\s\S]{0,600}?return;/);
  });

  it("is not a challan", async () => {
    const actions = await readFile(ACTIONS, "utf8");

    // setPlaceCount writes the count directly. If this ever became a transfer,
    // the challan list would grow journeys that never happened.
    const action = actions.slice(
      actions.indexOf("export async function setPlaceCountAction"),
      actions.indexOf("export async function setPlaceCountAction") + 1200,
    );

    expect(action.length, "the action moved").toBeGreaterThan(0);
    expect(action).toContain("setPlaceCount(");
    expect(action, "a stocktake is not a transfer").not.toContain("createStockTransfer");
  });
});
