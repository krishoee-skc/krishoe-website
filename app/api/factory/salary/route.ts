import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { queryPostgres } from "@/lib/postgres/client";
import { bikramMonthRange } from "@/lib/bikram-sambat";
import { numeric, type DbNumeric } from "@/lib/factory-money";
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
    const requestedMonth = request.nextUrl.searchParams.get("bsMonth");
    const range = requestedMonth ? bikramMonthRange(requestedMonth) : null;

    if (!workerId || !requestedMonth || !range) {
      return NextResponse.json(
        { error: "workerId and bsMonth (a Bikram Sambat month such as 2083-05) are required" },
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
       AND COALESCE(salary_period_month, date)::date >= $2::date
       AND COALESCE(salary_period_month, date)::date < $3::date`,
      [workerId, range.startKey, range.endKey]
    );

    // Get advances this month
    const advances = await queryPostgres<{ total_advance: DbNumeric }>(
      STORE,
      `SELECT COALESCE(SUM(advance_amount), 0) as total_advance
       FROM factory_weekly_advance
       WHERE worker_id = $1
       AND COALESCE(salary_period_month, date_given)::date >= $2::date
       AND COALESCE(salary_period_month, date_given)::date < $3::date`,
      [workerId, range.startKey, range.endKey]
    );

    const totalSalary = numeric(worker.monthly_salary);
    const totalPaid = numeric(payments?.[0]?.total_paid);
    const totalAdvance = numeric(advances?.[0]?.total_advance);
    const remainingBalance = totalSalary - totalPaid - totalAdvance;

    return NextResponse.json({
      worker_id: workerId,
      month: requestedMonth,
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
