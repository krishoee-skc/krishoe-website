import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { queryPostgres } from "@/lib/postgres/client";
import { monthKey, numeric, type DbNumeric } from "@/lib/factory-money";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

interface SalaryWorker {
  id: string;
  name: string;
  monthly_salary: DbNumeric;
}

export async function GET(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/salary", "GET");
  if (denied) return denied;

  try {
    const workerId = request.nextUrl.searchParams.get("workerId");
    const month = request.nextUrl.searchParams.get("month");

    if (!workerId) {
      return NextResponse.json({ error: "workerId is required" }, { status: 400 });
    }

    // Get worker info
    const workers = await queryPostgres<SalaryWorker>(
      STORE,
      "SELECT id, name, monthly_salary FROM factory_workers WHERE id = $1",
      [workerId]
    );

    if (!workers || workers.length === 0) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const worker = workers[0];
    const selectedMonth = monthKey(month) ?? new Date().toISOString().slice(0, 7);
    const [year, monthNum] = selectedMonth.split("-");

    // Get salary payments this month
    const payments = await queryPostgres<{ total_paid: DbNumeric }>(
      STORE,
      `SELECT COALESCE(SUM(payment_given), 0) as total_paid
       FROM factory_worker_ledger
       WHERE worker_id = $1
       AND entry_type = 'payment'
       AND EXTRACT(YEAR FROM date) = $2
       AND EXTRACT(MONTH FROM date) = $3`,
      [workerId, parseInt(year), parseInt(monthNum)]
    );

    // Get advances this month
    const advances = await queryPostgres<{ total_advance: DbNumeric }>(
      STORE,
      `SELECT COALESCE(SUM(advance_amount), 0) as total_advance
       FROM factory_weekly_advance
       WHERE worker_id = $1
       AND EXTRACT(YEAR FROM week_of_date) = $2
       AND EXTRACT(MONTH FROM week_of_date) = $3`,
      [workerId, parseInt(year), parseInt(monthNum)]
    );

    const totalSalary = numeric(worker.monthly_salary);
    const totalPaid = numeric(payments?.[0]?.total_paid);
    const totalAdvance = numeric(advances?.[0]?.total_advance);
    const remainingBalance = totalSalary - totalPaid - totalAdvance;

    return NextResponse.json({
      worker_id: workerId,
      month: selectedMonth,
      total_salary: totalSalary,
      total_paid: totalPaid,
      total_advance: totalAdvance,
      remaining_balance: remainingBalance,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error fetching salary:", errorMsg);
    return NextResponse.json({
      error: "Failed to fetch salary",
      detail: errorMsg,
    }, { status: 500 });
  }
}
