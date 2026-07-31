import { queryPostgres } from "@/lib/postgres/client";
import { numeric, positiveAmount, positiveInteger, ymdDate, type DbNumeric } from "@/lib/factory-money";
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
}

interface Worker {
  id: string;
  name: string;
  worker_type: string;
  category: string;
  monthly_salary: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const workerId = request.nextUrl.searchParams.get("workerId");
    const month = request.nextUrl.searchParams.get("month");

    if (!workerId) {
      return NextResponse.json({ error: "workerId is required" }, { status: 400 });
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
    let ledgerQuery = `SELECT id, worker_id, date, entry_type, work_pairs, amount_earned,
                              payment_given, running_balance, status, notes
                       FROM factory_worker_ledger
                       WHERE worker_id = $1`;
    const params: LedgerParam[] = [workerId];

    if (month) {
      // Parse YYYY-MM format
      const [year, monthNum] = month.split("-");
      ledgerQuery += ` AND EXTRACT(YEAR FROM date) = $2 AND EXTRACT(MONTH FROM date) = $3`;
      params.push(parseInt(year), parseInt(monthNum));
    }

    ledgerQuery += ` ORDER BY date ASC`;

    const ledger = await queryPostgres<LedgerEntry>(STORE, ledgerQuery, params);

    // Calculate summary
    const totalPairs = (ledger || []).reduce((sum, entry) => sum + (entry?.work_pairs || 0), 0);
    const totalEarned = (ledger || []).reduce((sum, entry) => sum + numeric(entry?.amount_earned), 0);
    const totalPaid = (ledger || []).reduce((sum, entry) => sum + numeric(entry?.payment_given), 0);
    const currentBalance = numeric(ledger?.[ledger.length - 1]?.running_balance);

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

    // Return graceful fallback instead of error
    return NextResponse.json({
      worker: null,
      ledger: [],
      summary: { totalPairs: 0, totalEarned: 0, totalPaid: 0, currentBalance: 0 },
      message: "No ledger data available. Please try refreshing.",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { worker_id, entry_type, notes } = body;
    const date = ymdDate(body.date);
    const workPairs = positiveInteger(body.work_pairs);
    const amountEarned = positiveAmount(body.amount_earned);
    const paymentGiven = positiveAmount(body.payment_given);

    if (!worker_id || !date || !entry_type) {
      return NextResponse.json(
        { error: "worker_id, date, and entry_type are required" },
        { status: 400 }
      );
    }

    // Get current balance
    const ledgerEntries = await queryPostgres<{ running_balance: DbNumeric }>(
      STORE,
      `SELECT running_balance FROM factory_worker_ledger
       WHERE worker_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [worker_id]
    );

    const currentBalance = numeric(ledgerEntries[0]?.running_balance);

    let newBalance = currentBalance;
    if (amountEarned) newBalance += amountEarned;
    if (paymentGiven) newBalance -= paymentGiven;

    const ledgerId = crypto.randomUUID();
    await queryPostgres(
      STORE,
      `INSERT INTO factory_worker_ledger
       (id, worker_id, date, entry_type, work_pairs, amount_earned, payment_given, running_balance, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)`,
      [
        ledgerId,
        worker_id,
        date,
        entry_type,
        workPairs,
        amountEarned,
        paymentGiven,
        newBalance,
        notes || null,
      ]
    );

    return NextResponse.json(
      {
        id: ledgerId,
        worker_id,
        date,
        entry_type,
        work_pairs: workPairs,
        amount_earned: amountEarned,
        payment_given: paymentGiven,
        running_balance: newBalance,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating ledger entry:", error);
    return NextResponse.json({ error: "Failed to create ledger entry" }, { status: 500 });
  }
}
