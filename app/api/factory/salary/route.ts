import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { queryPostgres } from "@/lib/postgres/client";
import { monthKey, numeric, type DbNumeric } from "@/lib/factory-money";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

interface SalaryWorker {
  id: string;
  name: string;
  monthly_salary: DbNumeric;
  worker_type: string;
}

export async function GET(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/salary", "GET");
  if (denied) return denied;

  try {
    const workerId = request.nextUrl.searchParams.get("workerId");
    const requestedMonth = request.nextUrl.searchParams.get("month");
    const selectedMonth = monthKey(requestedMonth);

    if (!workerId || !requestedMonth || !selectedMonth) {
      return NextResponse.json(
        { error: "workerId and month (YYYY-MM) are required" },
        { status: 400 },
      );
    }

    // Get worker info
    const workers = await queryPostgres<SalaryWorker>(
      STORE,
      "SELECT id, name, monthly_salary, worker_type FROM factory_workers WHERE id = $1",
      [workerId]
    );

    if (!workers || workers.length === 0) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const worker = workers[0];
    if (worker.worker_type !== "monthly_staff") {
      return NextResponse.json(
        { error: "Factory salary is for monthly staff; use HR payroll for daily staff" },
        { status: 409 },
      );
    }

    // Get salary payments this month
    const payments = await queryPostgres<{ total_paid: DbNumeric }>(
      STORE,
      `SELECT COALESCE(SUM(payment_given), 0) as total_paid
       FROM factory_worker_ledger
       WHERE worker_id = $1
       AND entry_type = 'payment'
       AND status <> 'reversed'
       AND COALESCE(salary_period_month, date_trunc('month', date)::date) = $2::date`,
      [workerId, `${selectedMonth}-01`]
    );

    // Get advances this month
    const advances = await queryPostgres<{ total_advance: DbNumeric }>(
      STORE,
      `SELECT COALESCE(SUM(advance_amount), 0) as total_advance
       FROM factory_weekly_advance
       WHERE worker_id = $1
       AND COALESCE(salary_period_month, date_trunc('month', date_given)::date) = $2::date`,
      [workerId, `${selectedMonth}-01`]
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
    return NextResponse.json(
      { error: "Failed to fetch salary" },
      { status: 500 },
    );
  }
}
