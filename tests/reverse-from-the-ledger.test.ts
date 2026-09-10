import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Undo a mistaken entry from the screen where the mistake is visible.
 *
 * Two entries went in without a colour or size, inflating one worker's month by
 * Rs. 4,800. Undoing them meant leaving the piece ledger — the screen a
 * worker's month is actually read on — for the wages screen, and finding the
 * same rows again there.
 *
 * The reversal itself already existed and was made two-sided earlier: it takes
 * back the factory row, the worker's ledger row and the production row
 * together. This is only the way to reach it.
 */
const API = "app/api/factory/ledger/route.ts";
const ROUTE = "app/api/factory/ledger/reverse/route.ts";
const SCREEN = "app/admin/factory/ledger/PieceLedger.tsx";

describe("finding the entry to reverse", () => {
  it("carries the production entry id on each work row", async () => {
    const api = await readFile(API, "utf8");

    // The ledger row and the production row were saved under one submission
    // key; that is what links them.
    expect(api).toContain("entry.id AS reversible_entry_id");
    expect(api).toContain("entry.source_submission_key = work.submission_key");
  });

  it("offers it only for work that is still approved", async () => {
    const api = await readFile(API, "utf8");

    // An entry already reversed has nothing left to take back.
    expect(api).toContain(`entry.status = 'Approved'`);
  });
});

describe("the reversal route", () => {
  it("is the owner's decision, not a clerk's", async () => {
    const route = await readFile(ROUTE, "utf8");
    const policy = await readFile("lib/factory-api-policy.ts", "utf8");

    // Through the factory policy map rather than a hand-rolled role check, so
    // it is authorized before the try/catch and cannot be skipped by a throw.
    expect(route).toContain("await authorizeFactoryApi(");
    expect(route.indexOf("await authorizeFactoryApi(")).toBeLessThan(route.indexOf("try {"));
    expect(policy).toContain('"/api/factory/ledger/reverse"');
    expect(policy.slice(policy.indexOf('"/api/factory/ledger/reverse"')))
      .toContain("ownerOnly: true");
  });

  it("insists on a reason worth reading", async () => {
    const route = await readFile(ROUTE, "utf8");

    // The line stays on the entry, and is the whole record of why a wage was
    // taken back. "wrong" tells the next reader nothing.
    expect(route).toContain("reason.length < 5");
  });

  it("goes through the reversal that already undoes both sides", async () => {
    const route = await readFile(ROUTE, "utf8");

    // Not a second, ledger-only path — that is how the two systems drifted
    // apart in the first place.
    expect(route).toContain("reverseProductionWorkEntry");
  });

  it("rebuilds the month the wage is paid from", async () => {
    const route = await readFile(ROUTE, "utf8");

    expect(route).toContain("refreshFactoryMonthlySummary");
    expect(route).toContain("bikramMonthKeyOf");
  });

  it("records who reversed what, and why", async () => {
    const route = await readFile(ROUTE, "utf8");

    expect(route).toContain("recordAdminAuditEvent");
  });
});

describe("what the owner sees", () => {
  it("puts the button on the row itself", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain("entry.reversible_entry_id");
    expect(screen).toContain(`text("Reverse", "फिर्ता गर्ने")`);
  });

  it("does not offer it on a payment or an already reversed row", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // A payment has no production entry, and a reversed row has nothing left
    // to take back.
    expect(screen).toContain(`entry.reversible_entry_id && entry.status !== "reversed"`);
  });

  it("asks for the reason before it will go", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain("reverseReason.trim().length < 5");
  });

  it("opens one row at a time", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // This takes a wage back; a screen of open confirm boxes invites a mis-tap.
    expect(screen).toContain("reversingId === entry.reversible_entry_id");
  });

  it("says the entry stays rather than disappearing", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain("The entry stays, struck through, with this reason on it.");
  });

  it("reloads the month so the row comes back struck through", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // Without this the ledger still shows the wage it just took back.
    expect(screen).toContain("setRefreshTick");
    expect(screen).toContain("[selectedWorkerId, month, refreshTick]");
  });
});

/**
 * Correcting an entry rather than reversing it.
 *
 * Reversing leaves two lines for one piece of work and means entering it twice.
 * For a colour that was missed or a rate typed wrong, the owner asked for the
 * row itself to be corrected — all four tables kept in step, nothing anywhere
 * left saying the old thing.
 */
const EDIT_ROUTE = "app/api/factory/ledger/edit/route.ts";
const MUTATION = "lib/factory-mutations.ts";

describe("correcting an entry in place", () => {
  it("rewrites all three tables that hold it", async () => {
    const source = await readFile(MUTATION, "utf8");
    const edit = source.slice(
      source.indexOf("export async function editFactoryWork"),
      source.indexOf("interface LedgerRow"),
    );

    expect(edit).toContain("UPDATE factory_daily_work");
    expect(edit).toContain("UPDATE factory_worker_ledger");
    expect(edit).toContain("UPDATE production_work_entries");
  });

  it("does it in one transaction, so none can move without the others", async () => {
    const source = await readFile(MUTATION, "utf8");
    const edit = source.slice(
      source.indexOf("export async function editFactoryWork"),
      source.indexOf("interface LedgerRow"),
    );

    expect(edit).toContain("transactionPostgres");
  });

  it("rebuilds the month the wage is paid from", async () => {
    const source = await readFile(MUTATION, "utf8");
    const edit = source.slice(
      source.indexOf("export async function editFactoryWork"),
      source.indexOf("interface LedgerRow"),
    );

    // And both workers' months when the entry moved between them.
    expect(edit).toContain("writeMonthlySummary(db, worker.id, monthKey)");
    expect(edit).toContain("before.worker_id !== worker.id");
  });

  it("refuses a month that has been closed and paid", async () => {
    const source = await readFile(MUTATION, "utf8");
    const edit = source.slice(
      source.indexOf("export async function editFactoryWork"),
      source.indexOf("interface LedgerRow"),
    );

    // Once a month is paid it is history; reversing says so plainly, a silent
    // edit does not.
    expect(edit).toContain("status = 'locked'");
    expect(edit).toContain("That month is closed");
  });

  it("refuses an entry under a Work Order", async () => {
    const source = await readFile(MUTATION, "utf8");
    const edit = source.slice(
      source.indexOf("export async function editFactoryWork"),
      source.indexOf("interface LedgerRow"),
    );

    // That plan counts pairs per stage and size and would need re-checking.
    expect(edit).toContain("belongs to a Work Order");
  });

  it("is the owner's decision, through the policy map", async () => {
    const route = await readFile(EDIT_ROUTE, "utf8");
    const policy = await readFile("lib/factory-api-policy.ts", "utf8");

    expect(route.indexOf("await authorizeFactoryApi(")).toBeLessThan(route.indexOf("try {"));
    expect(policy).toContain('"/api/factory/ledger/edit"');
  });

  it("asks why, and keeps the answer on the entry", async () => {
    const source = await readFile(MUTATION, "utf8");
    const screen = await readFile(SCREEN, "utf8");

    expect(source).toContain("input.reason.trim().length < 5");
    // Appended, not replaced: an entry corrected twice keeps both notes.
    expect(source).toContain("concat_ws(' · ', nullif(notes, ''), $5::text)");
    expect(screen).toContain("editForm.reason.trim().length < 5");
  });

  it("shows what the wage becomes before it is saved", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // A correction that moves money should say so first.
    expect(screen).toContain("Wage becomes Rs.");
  });

  it("offers Correct only on a row that has work behind it", async () => {
    const api = await readFile(API, "utf8");
    const screen = await readFile(SCREEN, "utf8");

    expect(api).toContain("work.id AS source_work_id");
    expect(screen).toContain("entry.source_work_id ? (");
  });
});
