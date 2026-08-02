import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

class TestFactoryMutationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const authorizeFactoryApi = vi.fn().mockResolvedValue(null);
const createFactoryWork = vi.fn();
const createFactoryLedgerEntry = vi.fn();
const createFactoryAdvance = vi.fn();
const refreshFactoryMonthlySummary = vi.fn();

vi.mock("@/lib/factory-api-access", () => ({ authorizeFactoryApi }));
vi.mock("@/lib/factory-mutations", () => ({
  createFactoryWork,
  createFactoryLedgerEntry,
  createFactoryAdvance,
  refreshFactoryMonthlySummary,
  submissionKeyForFactoryRequest: (request: Request) =>
    request.headers.get("Idempotency-Key") ?? "generated-key",
  FactoryMutationError: TestFactoryMutationError,
}));
vi.mock("@/lib/postgres/client", () => ({ queryPostgres: vi.fn() }));

const { POST: postWork } = await import("@/app/api/factory/work/route");
const { POST: postLedger } = await import("@/app/api/factory/ledger/route");
const { POST: postAdvance } = await import("@/app/api/factory/salary-advance/route");
const { POST: postPayment } = await import("@/app/api/factory/salary-payment/route");
const { POST: postSummary } = await import("@/app/api/factory/monthly-summary/route");

function request(path: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "client-key-1",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authorizeFactoryApi.mockReset().mockResolvedValue(null);
  createFactoryWork.mockReset();
  createFactoryLedgerEntry.mockReset();
  createFactoryAdvance.mockReset();
  refreshFactoryMonthlySummary.mockReset();
});

describe("Factory mutation route contracts", () => {
  it("uses 201 for a new additive save and 200 for an exact replay", async () => {
    createFactoryWork
      .mockResolvedValueOnce({ id: "work-1", replayed: false })
      .mockResolvedValueOnce({ id: "work-1", replayed: true });
    const body = {
      date: "2026-08-01",
      worker_id: "worker-1",
      item_id: "item-1",
      pairs_count: 10,
      status: "completed",
    };

    expect((await postWork(request("/api/factory/work", body))).status).toBe(201);
    expect((await postWork(request("/api/factory/work", body))).status).toBe(200);
    expect(createFactoryWork).toHaveBeenLastCalledWith(
      expect.objectContaining({ submissionKey: "client-key-1", pairsCount: 10 }),
    );
  });

  it("passes stable keys through every money/summary mutation route", async () => {
    createFactoryLedgerEntry.mockResolvedValue({ id: "ledger-1", replayed: false });
    createFactoryAdvance.mockResolvedValue({ id: "advance-1", replayed: false });
    refreshFactoryMonthlySummary.mockResolvedValue({ id: "summary-1", replayed: false });

    const ledgerResponse = await postLedger(
      request("/api/factory/ledger", {
        worker_id: "worker-1",
        date: "2026-08-01",
        entry_type: "payment",
        payment_given: 100,
      }),
    );
    const paymentResponse = await postPayment(
      request("/api/factory/salary-payment", {
        worker_id: "worker-1",
        date: "2026-08-01",
        amount: 100,
        period_month: "2026-07",
      }),
    );
    const advanceResponse = await postAdvance(
      request("/api/factory/salary-advance", {
        worker_id: "worker-1",
        date: "2026-08-01",
        amount: 50,
        period_month: "2026-08",
      }),
    );
    const summaryResponse = await postSummary(
      request("/api/factory/monthly-summary", {
        worker_id: "worker-1",
        month: "2026-08",
      }),
    );

    expect([ledgerResponse.status, paymentResponse.status, advanceResponse.status]).toEqual([
      201,
      201,
      201,
    ]);
    expect(summaryResponse.status).toBe(200);
    expect(createFactoryLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionKey: "client-key-1",
        allowedWorkerTypes: ["piece_rate"],
        productionPaymentType: "Midweek Advance",
      }),
    );
    expect(createFactoryLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionKey: "client-key-1",
        salaryPeriodMonth: "2026-07",
        allowedWorkerTypes: ["monthly_staff"],
      }),
    );
    expect(createFactoryAdvance).toHaveBeenCalledWith(
      expect.objectContaining({ submissionKey: "client-key-1", periodMonth: "2026-08" }),
    );
    expect(refreshFactoryMonthlySummary).toHaveBeenCalledWith(
      expect.objectContaining({ submissionKey: "client-key-1" }),
    );
  });

  it("maps known conflicts but never leaks unexpected database details", async () => {
    createFactoryLedgerEntry.mockRejectedValueOnce(
      new TestFactoryMutationError("This submission key was reused.", 409),
    );
    const conflict = await postLedger(
      request("/api/factory/ledger", {
        worker_id: "worker-1",
        date: "2026-08-01",
        entry_type: "payment",
        payment_given: 100,
      }),
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: "This submission key was reused." });

    createFactoryWork.mockRejectedValueOnce(
      new Error("relation factory_daily_work password=secret does not exist"),
    );
    const failure = await postWork(
      request("/api/factory/work", {
        date: "2026-08-01",
        worker_id: "worker-1",
        item_id: "item-1",
        pairs_count: 10,
        status: "completed",
      }),
    );
    expect(failure.status).toBe(500);
    expect(await failure.json()).toEqual({ error: "Failed to create work entry" });
  });
});
