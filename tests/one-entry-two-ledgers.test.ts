import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * One entry, both ledgers, or nothing at all.
 *
 * The work-entry form is the only place the shop types a day's work. It writes
 * to factory_daily_work and the worker ledger, and the wages screen and the
 * Saturday payment centre read production_work_entries — so the same work has
 * to reach all three.
 *
 * It used to be conditional: `if (production_item_id && name && stage)`, and a
 * failing condition meant the production insert simply did not happen. No
 * error, no warning, a saved entry the wages screen never saw. Two of the
 * owner's four entries went that way, so the payment centre showed Rs. 4,920
 * of the Rs. 9,720 earned and offered a Saturday settlement built on half a
 * month's work.
 *
 * These hold the rule that replaced it.
 */

const dbQuery = vi.fn();
const transactionPostgres = vi.fn(
  async (_store: string, callback: (db: { query: typeof dbQuery }) => Promise<unknown>) =>
    callback({ query: dbQuery }),
);

vi.mock("@/lib/postgres/client", () => ({ transactionPostgres }));

const { createFactoryWork, FactoryMutationError } = await import("@/lib/factory-mutations");

const entry = {
  submissionKey: "work-key-both",
  date: "2026-09-06",
  workerId: "worker-1",
  itemId: "item-1",
  color: "Black",
  size: "40",
  pairsCount: 60,
  status: "completed" as const,
};

/** The queries a save runs, up to the work row itself. */
function scriptUpToWorkRow(item: Record<string, unknown>) {
  dbQuery
    .mockResolvedValueOnce([]) // advisory idempotency lock
    .mockResolvedValueOnce([]) // no previous work with this key
    .mockResolvedValueOnce([{ id: "worker-1", category: "Upper", worker_type: "piece_rate" }])
    .mockResolvedValueOnce([item])
    .mockResolvedValueOnce([{ rate_per_pair: "40.00" }])
    .mockResolvedValueOnce([
      {
        id: "work-1",
        date: "2026-09-06",
        worker_id: "worker-1",
        item_id: "item-1",
        color: "Black",
        size: "40",
        pairs_count: 60,
        status: "completed",
        rate_applied: "40.00",
        amount_earned: "2400.00",
      },
    ]);
}

beforeEach(() => {
  dbQuery.mockReset().mockResolvedValue([]);
  transactionPostgres.mockClear();
});

describe("one entry reaches both ledgers", () => {
  it("writes the work, the worker ledger and the wages screen in one transaction", async () => {
    scriptUpToWorkRow({
      id: "item-1",
      production_item_id: "prod-1",
      production_item_name: "bagopen",
    });

    const result = await createFactoryWork(entry);

    // One transaction: a failure anywhere rolls back all three writes, so the
    // two screens can never disagree about a piece of work.
    expect(transactionPostgres).toHaveBeenCalledTimes(1);
    expect(result.production_synced).toBe(true);

    const statements = dbQuery.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes("INSERT INTO factory_daily_work"))).toBe(true);
    expect(statements.some((sql) => sql.includes("INSERT INTO production_work_entries"))).toBe(true);
    expect(statements.some((sql) => sql.includes("INSERT INTO factory_worker_ledger"))).toBe(true);
  });

  it("carries the same wage and pairs into both ledgers", async () => {
    scriptUpToWorkRow({
      id: "item-1",
      production_item_id: "prod-1",
      production_item_name: "bagopen",
    });

    await createFactoryWork(entry);

    const production = dbQuery.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO production_work_entries"),
    );
    // 60 pairs at Rs. 40 is Rs. 2,400 on both sides. A screen that agrees on
    // the pairs but not the money is the mismatch this whole change is about.
    expect(production?.[1]).toEqual(expect.arrayContaining([60, 2400]));
  });

  it("refuses the save when the item cannot reach the wages screen", async () => {
    // An item with no production link has nowhere to land, so the save is
    // refused before a single row is written — rather than saving the work and
    // quietly dropping it out of the wage the worker gets paid.
    scriptUpToWorkRow({ id: "item-1", production_item_id: null, production_item_name: null });

    await expect(createFactoryWork(entry)).rejects.toBeInstanceOf(FactoryMutationError);

    const statements = dbQuery.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes("INSERT INTO factory_daily_work"))).toBe(false);
  });

  it("says which screen fixes it", async () => {
    scriptUpToWorkRow({ id: "item-1", production_item_id: null, production_item_name: null });

    // "Link this item" alone leaves the owner hunting. The message names the
    // screen and what to set there.
    await expect(createFactoryWork(entry)).rejects.toThrow(/Production Item Master/);
    dbQuery.mockReset().mockResolvedValue([]);
    scriptUpToWorkRow({ id: "item-1", production_item_id: null, production_item_name: null });
    await expect(createFactoryWork(entry)).rejects.toThrow(/Factory → Items/);
  });
});

/**
 * Which pairs the wage was for.
 *
 * Colour and size were optional, and two of one day's five entries went in
 * without either — three rows of the same item at the same rate, which neither
 * the owner nor the worker could tell apart afterwards. The owner asked for
 * them to be required.
 */
describe("colour and size", () => {
  it("are required, so the ledger can name the pairs", async () => {
    scriptUpToWorkRow({
      id: "item-1",
      production_item_id: "prod-1",
      production_item_name: "bagopen",
    });

    await expect(
      createFactoryWork({ ...entry, color: null, size: null }),
    ).rejects.toThrow(/Colour and size/);
  });

  it("are checked before anything is written", async () => {
    scriptUpToWorkRow({
      id: "item-1",
      production_item_id: "prod-1",
      production_item_name: "bagopen",
    });

    await expect(createFactoryWork({ ...entry, color: null, size: null })).rejects.toThrow();

    const statements = dbQuery.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes("INSERT INTO factory_daily_work"))).toBe(false);
  });

  it("are refused when blank rather than absent", async () => {
    // An empty string is what a form sends when the field was skipped.
    scriptUpToWorkRow({
      id: "item-1",
      production_item_id: "prod-1",
      production_item_name: "bagopen",
    });

    await expect(
      createFactoryWork({ ...entry, color: "   ", size: "" }),
    ).rejects.toThrow(/Colour and size/);
  });
});
