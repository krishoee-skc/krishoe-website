import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Fixing a wrong entry from the screen where it is read.
 *
 * Two rows of the same shoe went in 4.4 seconds apart — one save pressed twice —
 * and two others had no colour or size. Both kinds had to be fixed from another
 * screen, so they are fixed here now: correct the details, or remove the entry.
 *
 * Reversing was the first answer, and it lasted a day. It left the row struck
 * through with its reason, which is what a bank does, and a double entry then
 * needed three lines before the ledger read correctly. The owner reads fifty
 * rows a morning on a workshop phone and asked for the row to go. What was
 * deleted is kept in the admin audit instead.
 */
const API = "app/api/factory/ledger/route.ts";
const EDIT_ROUTE = "app/api/factory/ledger/edit/route.ts";
const DELETE_ROUTE = "app/api/factory/ledger/delete/route.ts";
const SCREEN = "app/admin/factory/ledger/PieceLedger.tsx";
const MUTATION = "lib/factory-mutations.ts";
const POLICY = "lib/factory-api-policy.ts";

/** The delete mutation's body, cut at both ends so a slice cannot run away. */
async function deleteMutation() {
  const source = await readFile(MUTATION, "utf8");
  const start = source.indexOf("export async function deleteFactoryWork");
  const end = source.indexOf("interface LedgerRow");
  expect(start, "deleteFactoryWork is missing").toBeGreaterThan(-1);
  expect(end, "the slice has no end").toBeGreaterThan(start);
  return source.slice(start, end);
}

async function editMutation() {
  const source = await readFile(MUTATION, "utf8");
  const start = source.indexOf("export async function editFactoryWork");
  const end = source.indexOf("export async function deleteFactoryWork");
  expect(start, "editFactoryWork is missing").toBeGreaterThan(-1);
  expect(end, "the slice has no end").toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("finding the entry to fix", () => {
  it("carries the work row's id on each line", async () => {
    const api = await readFile(API, "utf8");

    // What both correcting and deleting rewrite.
    expect(api).toContain("work.id AS source_work_id");
    expect(api).toContain("work.item_id");
  });
});

describe("deleting an entry", () => {
  it("removes it from all three tables that hold it", async () => {
    const source = await deleteMutation();

    expect(source).toContain("DELETE FROM production_work_entries");
    expect(source).toContain("DELETE FROM factory_worker_ledger");
    expect(source).toContain("DELETE FROM factory_daily_work");
  });

  it("deletes the ledger row before the work row", async () => {
    const source = await deleteMutation();

    // factory_worker_ledger holds a RESTRICT foreign key onto
    // factory_daily_work: the other order is refused by the database, which was
    // confirmed by trying it against the live schema.
    expect(source.indexOf("DELETE FROM factory_worker_ledger")).toBeLessThan(
      source.indexOf("DELETE FROM factory_daily_work"),
    );
  });

  it("does it in one transaction, so a row cannot go without the others", async () => {
    const source = await deleteMutation();

    expect(source).toContain("transactionPostgres");
  });

  it("rebuilds the month the wage is paid from", async () => {
    const source = await deleteMutation();

    expect(source).toContain("writeMonthlySummary");
  });

  it("refuses a month that has been closed and paid", async () => {
    const source = await deleteMutation();

    // Deleting from it would change a figure the worker was already paid
    // against.
    expect(source).toContain("status = 'locked'");
    expect(source).toContain("That month is closed and paid");
  });

  it("refuses an entry under a Work Order", async () => {
    const source = await deleteMutation();

    // That plan counts pairs per stage; removing an entry would leave it
    // counting work that no longer exists.
    expect(source).toContain("belongs to a Work Order");
  });

  it("asks why before it will go", async () => {
    const source = await deleteMutation();
    const screen = await readFile(SCREEN, "utf8");

    expect(source).toContain("input.reason.trim().length < 5");
    expect(screen).toContain("deleteReason.trim().length < 5");
  });

  it("writes what was removed to the audit", async () => {
    const route = await readFile(DELETE_ROUTE, "utf8");

    // Once the rows are gone this is the only record that the work was entered:
    // the worker, the shoe, the pairs, the wage and the reason.
    expect(route).toContain("recordAdminAuditEvent");
    expect(route).toContain("factory_work_delete");
    expect(route).toContain("gone.workerName");
    expect(route).toContain("gone.amountEarned");
    expect(route).toContain("gone.reason");
  });

  it("says plainly that it does not come back", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain("This entry goes for good");
  });
});

describe("correcting an entry in place", () => {
  it("rewrites all three tables that hold it", async () => {
    const source = await editMutation();

    expect(source).toContain("UPDATE factory_daily_work");
    expect(source).toContain("UPDATE factory_worker_ledger");
    expect(source).toContain("UPDATE production_work_entries");
  });

  it("does it in one transaction and rebuilds the month", async () => {
    const source = await editMutation();

    expect(source).toContain("transactionPostgres");
    expect(source).toContain("writeMonthlySummary(db, worker.id, monthKey)");
    // Both workers' months when the entry moved between them.
    expect(source).toContain("before.worker_id !== worker.id");
  });

  it("refuses a closed month and a Work Order entry", async () => {
    const source = await editMutation();

    expect(source).toContain("That month is closed");
    expect(source).toContain("belongs to a Work Order");
  });

  it("shows what the wage becomes before it is saved", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // A correction that moves money should say so first.
    expect(screen).toContain("Wage becomes Rs.");
  });

  it("keeps every reason, rather than replacing the last one", async () => {
    const source = await editMutation();

    // An entry corrected twice keeps both notes.
    expect(source).toContain("concat_ws(' · ', nullif(notes, ''), $5::text)");
  });
});

describe("who may do either", () => {
  it("holds both to the owner, through the policy map", async () => {
    const edit = await readFile(EDIT_ROUTE, "utf8");
    const remove = await readFile(DELETE_ROUTE, "utf8");
    const policy = await readFile(POLICY, "utf8");

    // Authorized before the try, so a throw cannot skip the check.
    expect(edit.indexOf("await authorizeFactoryApi(")).toBeLessThan(edit.indexOf("try {"));
    expect(remove.indexOf("await authorizeFactoryApi(")).toBeLessThan(remove.indexOf("try {"));

    for (const path of ['"/api/factory/ledger/edit"', '"/api/factory/ledger/delete"']) {
      expect(policy).toContain(path);
      expect(policy.slice(policy.indexOf(path), policy.indexOf(path) + 200))
        .toContain("ownerOnly: true");
    }
  });
});

describe("what the owner sees on a row", () => {
  it("offers Correct and Delete, and no longer Reverse", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain(`text("Correct", "सच्याउने")`);
    expect(screen).toContain(`text("Delete", "मेट्ने")`);
    expect(screen).not.toContain(`text("Reverse", "फिर्ता गर्ने")`);
  });

  it("offers neither on a payment row", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // A payment has no work row behind it; it is undone on the worker page.
    expect(screen).toContain("entry.source_work_id ? (");
  });

  it("opens one box at a time", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // Both rewrite a wage; a screen of open confirm boxes invites a mis-tap.
    expect(screen).toContain("deletingId === entry.source_work_id");
    expect(screen).toContain("editingId === entry.source_work_id");
  });

  it("reloads the month after either", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain("setRefreshTick");
    expect(screen).toContain("[selectedWorkerId, month, refreshTick]");
  });
});

describe("the wages screen keeps its own reversal", () => {
  it("is untouched, because it reaches cases delete refuses", async () => {
    const actions = await readFile(
      "app/admin/operations/production-accounts/actions.ts",
      "utf8",
    );

    // A lot that has posted stock, or a month that has closed, cannot be
    // deleted — reversing is the only way to undo those, and it stays there.
    expect(actions).toContain("reverseProductionWorkEntry");
  });
});

/**
 * An error that says what actually went wrong.
 *
 * The red box was written for one case — the ledger failing to load — and then
 * reused for every error, so a reason left too short read:
 *
 *   Write a clear reason — it stays on the entry.
 *   Database may be temporarily unavailable. Try refreshing the page.
 *
 * The owner was told to refresh a page that was working, over a message that
 * already said what to do. It also made a real outage look like a typo.
 */
describe("the error box", () => {
  it("only suggests refreshing when the ledger would not load", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain("loadFailed");
    expect(screen).toContain("setLoadFailed(true)");
    // The old line said this on every error, including ones the owner caused.
    expect(screen).not.toContain("Database may be temporarily unavailable");
  });

  it("clears that flag before an action the owner took", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // A short reason is not a database problem, and must not inherit the
    // advice left over from a failed load.
    const del = screen.slice(screen.indexOf("const handleDelete"), screen.indexOf("const handleRecordPayment"));
    expect(del).toContain("setLoadFailed(false)");
  });
});
