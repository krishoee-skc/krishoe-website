import { authorizeFactoryApi } from "@/lib/factory-api-access";
import {
  createFactoryLedgerEntry,
  FactoryMutationError,
  submissionKeyForFactoryRequest,
} from "@/lib/factory-mutations";
import { bikramMonthRange } from "@/lib/bikram-sambat";
import { queryPostgres } from "@/lib/postgres/client";
import {
  numeric,
  positiveAmount,
  positiveInteger,
  ymdDate,
  type DbNumeric,
} from "@/lib/factory-money";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";
type LedgerParam = string | number;

interface LedgerEntry {
  id: string;
  worker_id: string;
  date: string;
  entry_type: string;
  work_pairs: number | null;
  amount_earned: DbNumeric;
  payment_given: DbNumeric;
  running_balance: DbNumeric;
  status: string;
  notes: string | null;
  created_at: string;
}

interface Worker {
  id: string;
  name: string;
  worker_type: string;
  category: string;
  monthly_salary: number | null;
}

export async function GET(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/ledger", "GET");
  if (denied) return denied;

  try {
    const workerId = request.nextUrl.searchParams.get("workerId");
    // A Bikram Sambat month key — "2083-05" for Bhadra. The parameter is
    // named for what it holds, because the two calendars share the YYYY-MM
    // shape and an A.D. month read as a BS one reports a worker's pay for 1969.
    const requestedMonth = request.nextUrl.searchParams.get("bsMonth");
    const range = requestedMonth ? bikramMonthRange(requestedMonth) : null;

    if (!workerId) {
      return NextResponse.json({ error: "workerId is required" }, { status: 400 });
    }
    if (requestedMonth && !range) {
      return NextResponse.json(
        { error: "bsMonth must be a Bikram Sambat month such as 2083-05" },
        { status: 400 },
      );
    }

    // Get worker info first
    const workerQuery = `SELECT id, name, worker_type, category, monthly_salary
                         FROM factory_workers
                         WHERE id = $1`;
    const workers = await queryPostgres<Worker>(STORE, workerQuery, [workerId]);

    if (!workers || workers.length === 0) {
      return NextResponse.json({
        worker: { id: workerId, name: "Unknown", worker_type: "", category: "", monthly_salary: null },
        ledger: [],
        summary: { totalPairs: 0, totalEarned: 0, totalPaid: 0, currentBalance: 0 },
      });
    }

    const worker = workers[0];

    // Get ledger entries
    let ledgerQuery = `WITH balanced AS (
                         SELECT id, worker_id, date, entry_type, work_pairs, amount_earned,
                                payment_given, status, notes, created_at,
                                SUM(
                                  CASE WHEN status = 'reversed' THEN 0
                                  ELSE COALESCE(amount_earned, 0) - COALESCE(payment_given, 0)
                                  END
                                ) OVER (
                                  PARTITION BY worker_id
                                  ORDER BY created_at ASC, id ASC
                                  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                                ) AS running_balance
                         FROM factory_worker_ledger
                         WHERE worker_id = $1
                       )
                       SELECT id, worker_id, date, entry_type, work_pairs, amount_earned,
                              payment_given, running_balance, status, notes, created_at
                       FROM balanced
                       WHERE true`;
    const params: LedgerParam[] = [workerId];

    if (range) {
      // Both ends passed, never start + INTERVAL '1 month'. Bhadra runs 17
      // August to 17 September and Asoj 17 September to 18 October — BS months
      // are 29 to 32 days, so the arithmetic that looks right for one month
      // drops a day of somebody's wages out of the next.
      ledgerQuery += ` AND date >= $2::date AND date < $3::date`;
      params.push(range.startKey, range.endKey);
    }

    ledgerQuery += ` ORDER BY created_at ASC, id ASC`;

    const ledger = await queryPostgres<LedgerEntry>(STORE, ledgerQuery, params);
    const balanceRows = await queryPostgres<{ current_balance: DbNumeric }>(
      STORE,
      `SELECT COALESCE(
                SUM(CASE WHEN status = 'reversed' THEN 0
                    ELSE COALESCE(amount_earned, 0) - COALESCE(payment_given, 0)
                    END),
                0
              ) AS current_balance
       FROM factory_worker_ledger
       WHERE worker_id = $1`,
      [workerId],
    );

    // Calculate summary
    const activeLedger = (ledger || []).filter((entry) => entry.status !== "reversed");
    const totalPairs = activeLedger.reduce((sum, entry) => sum + (entry?.work_pairs || 0), 0);
    const totalEarned = activeLedger.reduce((sum, entry) => sum + numeric(entry?.amount_earned), 0);
    const totalPaid = activeLedger.reduce((sum, entry) => sum + numeric(entry?.payment_given), 0);
    const currentBalance = numeric(balanceRows[0]?.current_balance);

    return NextResponse.json({
      worker,
      ledger: ledger || [],
      summary: {
        totalPairs: totalPairs || 0,
        totalEarned: totalEarned || 0,
        totalPaid: totalPaid || 0,
        currentBalance: currentBalance || 0,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error fetching ledger:", errorMsg);

    return NextResponse.json(
      { error: "Worker ledger is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/ledger", "POST");
  if (denied) return denied;

  try {
    const body = await request.json();
    const workerId = typeof body.worker_id === "string" ? body.worker_id.trim() : "";
    const entryType = typeof body.entry_type === "string" ? body.entry_type.trim() : "";
    const notes = body.notes;
    const date = ymdDate(body.date);
    const workPairs = positiveInteger(body.work_pairs);
    const amountEarned = positiveAmount(body.amount_earned) ?? 0;
    const paymentGiven = positiveAmount(body.payment_given) ?? 0;
    const paymentKind = typeof body.payment_kind === "string" ? body.payment_kind.trim() : "";
    const submissionKey = submissionKeyForFactoryRequest(request, body.submission_key);

    if (!workerId || !date || !entryType) {
      return NextResponse.json(
        { error: "worker_id, date, and entry_type are required" },
        { status: 400 }
      );
    }

    const result = await createFactoryLedgerEntry({
      submissionKey,
      workerId,
      date,
      entryType,
      workPairs,
      amountEarned,
      paymentGiven,
      status: entryType === "payment" ? "settled" : "pending",
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      salaryPeriodMonth: null,
      allowedWorkerTypes: ["piece_rate"],
      productionPaymentType:
        paymentKind === "Saturday kharcha / advance"
          ? "Saturday Kharcha"
          : paymentKind === "Final wage settlement"
            ? "Final Settlement"
            : "Midweek Advance",
    });

    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    console.error("Error creating ledger entry:", error);
    return NextResponse.json(
      {
        error:
          error instanceof FactoryMutationError
            ? error.message
            : "Failed to create ledger entry",
      },
      { status: error instanceof FactoryMutationError ? error.status : 500 },
    );
  }
}
