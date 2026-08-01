import { beforeEach, describe, expect, it, vi } from "vitest";

const dbQuery = vi.fn();
const transactionPostgres = vi.fn(
  async (_store: string, callback: (db: { query: typeof dbQuery }) => Promise<unknown>) =>
    callback({ query: dbQuery }),
);

vi.mock("@/lib/postgres/client", () => ({
  transactionPostgres,
}));

const {
  createFactoryAdvance,
  createFactoryLedgerEntry,
  createFactoryWork,
  FactoryMutationError,
  refreshFactoryMonthlySummary,
  saturdayFor,
  submissionKeyForFactoryRequest,
} = await import("@/lib/factory-mutations");

beforeEach(() => {
  dbQuery.mockReset();
  transactionPostgres.mockClear();
});

describe("Factory mutation idempotency", () => {
  it("prefers the request header, validates it, and requires a client retry key", () => {
    const request = new Request("https://example.test/api/factory/work", {
      headers: { "Idempotency-Key": "factory-work_123" },
    });
    expect(submissionKeyForFactoryRequest(request, "body-key")).toBe("factory-work_123");

    expect(() =>
      submissionKeyForFactoryRequest(
        new Request("https://example.test/api/factory/work"),
        undefined,
      ),
    ).toThrow(/required/);

    expect(() =>
      submissionKeyForFactoryRequest(
        new Request("https://example.test/api/factory/work", {
          headers: { "Idempotency-Key": "bad key with spaces" },
        }),
        undefined,
      ),
    ).toThrow(FactoryMutationError);
  });

  it("posts piece-rate work and its wage ledger in one transaction", async () => {
    dbQuery
      .mockResolvedValueOnce([]) // advisory idempotency lock
      .mockResolvedValueOnce([]) // no previous work with this key
      .mockResolvedValueOnce([{ id: "worker-1", category: "Upper", worker_type: "piece_rate" }])
      .mockResolvedValueOnce([{ id: "item-1" }])
      .mockResolvedValueOnce([{ rate_per_pair: "12.50" }])
      .mockResolvedValueOnce([
        {
          id: "work-1",
          date: "2026-08-01",
          worker_id: "worker-1",
          item_id: "item-1",
          color: "Black",
          size: "36-40",
          pairs_count: 10,
          status: "completed",
          rate_applied: "12.50",
          amount_earned: "125.00",
        },
      ])
      .mockResolvedValueOnce([]) // no ledger-key collision
      .mockResolvedValueOnce([{ running_balance: "50.00" }])
      .mockResolvedValueOnce([]);

    const result = await createFactoryWork({
      submissionKey: "work-key-1",
      date: "2026-08-01",
      workerId: "worker-1",
      itemId: "item-1",
      color: "Black",
      size: "36-40",
      pairsCount: 10,
      status: "completed",
    });

    expect(transactionPostgres).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      id: "work-1",
      amount_earned: 125,
      submission_key: "work-key-1",
      replayed: false,
    });

    const sql = dbQuery.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("effective_date <= $3::date");
    expect(sql).toContain("ROUND($10::numeric * $8::integer, 2)");
    expect(sql).toContain("source_work_id");
    expect(sql).toContain("status <> 'reversed'");
    const ledgerInsert = dbQuery.mock.calls.find(([statement]) =>
      String(statement).includes("INSERT INTO factory_worker_ledger"),
    );
    expect(ledgerInsert?.[1]).toEqual(
      expect.arrayContaining(["work-key-1", expect.any(String), "worker-1", 10, 125, 175]),
    );
  });

  it("returns the stored work on an exact retry without posting another wage", async () => {
    dbQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "stored-work",
          date: "2026-08-01",
          worker_id: "worker-1",
          item_id: "item-1",
          color: null,
          size: null,
          pairs_count: 8,
          status: "completed",
          rate_applied: "10.00",
          amount_earned: "80.00",
        },
      ]);

    const result = await createFactoryWork({
      submissionKey: "retry-key",
      date: "2026-08-01",
      workerId: "worker-1",
      itemId: "item-1",
      color: null,
      size: null,
      pairsCount: 8,
      status: "completed",
    });

    expect(result).toMatchObject({ id: "stored-work", replayed: true, amount_earned: 80 });
    expect(dbQuery).toHaveBeenCalledTimes(2);
  });

  it("rejects reuse of a work key for different data", async () => {
    dbQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "stored-work",
          date: "2026-08-01",
          worker_id: "worker-1",
          item_id: "item-1",
          color: null,
          size: null,
          pairs_count: 8,
          status: "completed",
          rate_applied: "10.00",
          amount_earned: "80.00",
        },
      ]);

    await expect(
      createFactoryWork({
        submissionKey: "retry-key",
        date: "2026-08-01",
        workerId: "worker-1",
        itemId: "item-1",
        color: null,
        size: null,
        pairsCount: 9,
        status: "completed",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("serialises a payment behind the worker lock and derives balance from ledger facts", async () => {
    dbQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "worker-1", category: "Staff", worker_type: "monthly_staff" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ running_balance: "500.00" }])
      .mockResolvedValueOnce([
        {
          id: "payment-1",
          worker_id: "worker-1",
          date: "2026-08-01",
          entry_type: "payment",
          work_pairs: null,
          amount_earned: "0.00",
          payment_given: "100.00",
          running_balance: "400.00",
          status: "settled",
          notes: "Factory salary payment",
          salary_period_month: "2026-07-01",
        },
      ]);

    const result = await createFactoryLedgerEntry({
      submissionKey: "payment-key",
      workerId: "worker-1",
      date: "2026-08-01",
      entryType: "payment",
      workPairs: null,
      amountEarned: 0,
      paymentGiven: 100,
      status: "settled",
      notes: "Factory salary payment",
      salaryPeriodMonth: "2026-07",
      allowedWorkerTypes: ["monthly_staff"],
    });

    expect(result).toMatchObject({ payment_given: 100, running_balance: 400 });
    expect(String(dbQuery.mock.calls[1][0])).toContain("FOR UPDATE");
    expect(String(dbQuery.mock.calls[3][0])).toContain("SUM(COALESCE(amount_earned, 0)");
  });

  it("replays the exact payment once and rejects a different amount with the same key", async () => {
    const storedPayment = {
      id: "payment-1",
      worker_id: "worker-1",
      date: "2026-08-01",
      entry_type: "payment",
      work_pairs: null,
      amount_earned: "0.00",
      payment_given: "100.00",
      running_balance: "400.00",
      status: "settled",
      notes: "Factory salary payment",
      salary_period_month: "2026-07-01",
    };
    dbQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "worker-1", category: "Staff", worker_type: "monthly_staff" }])
      .mockResolvedValueOnce([storedPayment]);

    const replay = await createFactoryLedgerEntry({
      submissionKey: "payment-key",
      workerId: "worker-1",
      date: "2026-08-01",
      entryType: "payment",
      workPairs: null,
      amountEarned: 0,
      paymentGiven: 100,
      status: "settled",
      notes: "Factory salary payment",
      salaryPeriodMonth: "2026-07",
      allowedWorkerTypes: ["monthly_staff"],
    });
    expect(replay).toMatchObject({ id: "payment-1", replayed: true });
    expect(dbQuery).toHaveBeenCalledTimes(3);

    dbQuery.mockReset();
    dbQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "worker-1", category: "Staff", worker_type: "monthly_staff" }])
      .mockResolvedValueOnce([storedPayment]);
    await expect(
      createFactoryLedgerEntry({
        submissionKey: "payment-key",
        workerId: "worker-1",
        date: "2026-08-01",
        entryType: "payment",
        workPairs: null,
        amountEarned: 0,
        paymentGiven: 125,
        status: "settled",
        notes: "Factory salary payment",
        salaryPeriodMonth: "2026-07",
        allowedWorkerTypes: ["monthly_staff"],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("does not post wages for unfinished or rework status entries", async () => {
    await expect(
      createFactoryWork({
        submissionKey: "unfinished-key",
        date: "2026-08-01",
        workerId: "worker-1",
        itemId: "item-1",
        color: null,
        size: null,
        pairsCount: 10,
        status: "in_progress",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(transactionPostgres).not.toHaveBeenCalled();
  });

  it("rejects salaried staff from the item-stage piece-wage work flow", async () => {
    dbQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "staff-1", category: "Staff", worker_type: "monthly_staff" },
      ]);

    await expect(
      createFactoryWork({
        submissionKey: "staff-work-key",
        date: "2026-08-01",
        workerId: "staff-1",
        itemId: "item-1",
        color: null,
        size: null,
        pairsCount: 5,
        status: "completed",
      }),
    ).rejects.toMatchObject({ status: 409 });

    expect(dbQuery).toHaveBeenCalledTimes(3);
  });

  it("deduplicates a salary advance and rejects mismatched reuse", async () => {
    dbQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "advance-1",
          worker_id: "worker-1",
          week_of_date: "2026-07-26",
          advance_amount: "750.00",
          date_given: "2026-08-01",
          notes: null,
          salary_period_month: "2026-08-01",
        },
      ]);

    const replay = await createFactoryAdvance({
      submissionKey: "advance-key",
      workerId: "worker-1",
      amount: 750,
      date: "2026-08-01",
      notes: null,
      periodMonth: "2026-08",
    });
    expect(replay).toMatchObject({ id: "advance-1", replayed: true });

    dbQuery.mockReset();
    dbQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "advance-1",
          worker_id: "worker-1",
          week_of_date: "2026-07-26",
          advance_amount: "750.00",
          date_given: "2026-08-01",
          notes: null,
          salary_period_month: "2026-08-01",
        },
      ]);
    await expect(
      createFactoryAdvance({
        submissionKey: "advance-key",
        workerId: "worker-1",
        amount: 900,
        date: "2026-08-01",
        notes: null,
        periodMonth: "2026-08",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("keeps a locked monthly summary unchanged and returns its stored totals", async () => {
    dbQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "worker-1", category: "Upper", worker_type: "piece_rate" }])
      .mockResolvedValueOnce([{ total_pairs: "20", total_earned: "300.00" }])
      .mockResolvedValueOnce([{ total_paid: "100.00" }])
      .mockResolvedValueOnce([{ closing_balance: "200.00" }])
      .mockResolvedValueOnce([]) // ON CONFLICT ... WHERE status <> locked returned nothing
      .mockResolvedValueOnce([
        {
          id: "summary-locked",
          month: "2026-08-01",
          worker_id: "worker-1",
          total_pairs: "18",
          total_earned: "275.00",
          total_paid: "90.00",
          final_balance: "185.00",
          status: "locked",
        },
      ]);

    const result = await refreshFactoryMonthlySummary({
      submissionKey: "summary-request-key",
      month: "2026-08",
      workerId: "worker-1",
    });

    expect(result).toMatchObject({ status: "locked", total_pairs: 18, replayed: true });
    expect(transactionPostgres).toHaveBeenCalledTimes(1);
    expect(String(dbQuery.mock.calls[5][0])).toContain("ON CONFLICT (month, worker_id) DO UPDATE");
    expect(String(dbQuery.mock.calls[5][0])).toContain("status <> 'locked'");
  });

  it("refreshes a monthly summary from approved ledger facts and excludes reversals", async () => {
    dbQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "worker-1", category: "Upper", worker_type: "piece_rate" }])
      .mockResolvedValueOnce([{ total_pairs: "20", total_earned: "300.00" }])
      .mockResolvedValueOnce([{ total_paid: "100.00" }])
      .mockResolvedValueOnce([{ closing_balance: "250.00" }])
      .mockResolvedValueOnce([
        {
          id: "summary-1",
          month: "2026-08-01",
          worker_id: "worker-1",
          total_pairs: "20",
          total_earned: "300.00",
          total_paid: "100.00",
          final_balance: "250.00",
          status: "draft",
        },
      ]);

    const result = await refreshFactoryMonthlySummary({
      submissionKey: "summary-request-key",
      month: "2026-08",
      workerId: "worker-1",
    });

    expect(result).toMatchObject({
      total_pairs: 20,
      total_earned: 300,
      total_paid: 100,
      final_balance: 250,
    });
    expect(String(dbQuery.mock.calls[3][0])).toContain("status <> 'reversed'");
    expect(String(dbQuery.mock.calls[4][0])).toContain("closing_balance");
    expect(String(dbQuery.mock.calls[2][0])).toContain("status = 'completed'");
  });

  it("groups cash weeks from Saturday through Friday", () => {
    expect(saturdayFor("2026-08-01")).toBe("2026-08-01");
    expect(saturdayFor("2026-08-07")).toBe("2026-08-01");
    expect(saturdayFor("2026-08-08")).toBe("2026-08-08");
  });
});
