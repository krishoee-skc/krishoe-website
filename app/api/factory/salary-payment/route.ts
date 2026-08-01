import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { queryPostgres } from "@/lib/postgres/client";
import { numeric, positiveAmount, ymdDate, type DbNumeric } from "@/lib/factory-money";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

export async function POST(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/salary-payment", "POST");
  if (denied) return denied;

  try {
    const body = await request.json();
    const { worker_id } = body;
    const amount = positiveAmount(body.amount);
    const date = ymdDate(body.date);

    if (!worker_id || !amount || !date) {
      return NextResponse.json(
        { error: "worker_id, a positive amount, and a YYYY-MM-DD date are required" },
        { status: 400 }
      );
    }

    const ledgerId = crypto.randomUUID();

    // Get current running balance
    const ledgerEntries = await queryPostgres<{ running_balance: DbNumeric }>(
      STORE,
      `SELECT running_balance FROM factory_worker_ledger
       WHERE worker_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [worker_id]
    );

    const currentBalance = numeric(ledgerEntries?.[0]?.running_balance);
    const newBalance = currentBalance - amount;

    // Record payment in ledger
    await queryPostgres(
      STORE,
      `INSERT INTO factory_worker_ledger
       (id, worker_id, date, entry_type, payment_given, running_balance, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [ledgerId, worker_id, date, "payment", amount, newBalance, "settled"]
    );

    return NextResponse.json({
      id: ledgerId,
      worker_id,
      amount,
      date,
      new_balance: newBalance,
    }, { status: 201 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error recording payment:", errorMsg);
    return NextResponse.json(
      { error: "Failed to record payment", detail: errorMsg },
      { status: 500 }
    );
  }
}
