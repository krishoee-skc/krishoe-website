import { queryPostgres } from "@/lib/postgres/client";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

export async function GET(request: NextRequest) {
  try {
    const workerId = request.nextUrl.searchParams.get("workerId");
    const month = request.nextUrl.searchParams.get("month");

    if (!workerId) {
      return NextResponse.json({ error: "workerId is required" }, { status: 400 });
    }

    // Get worker info
    const workers = await queryPostgres<any>(
      STORE,
      "SELECT id, name, monthly_salary FROM factory_workers WHERE id = $1",
      [workerId]
    );

    if (!workers || workers.length === 0) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const worker = workers[0];
    const [year, monthNum] = month ? month.split("-") : [new Date().getFullYear().toString(), String(new Date().getMonth() + 1).padStart(2, "0")];

    // Get salary payments this month
    const payments = await queryPostgres<{ total_paid: number }>(
      STORE,
      `SELECT COALESCE(SUM(amount_earned), 0) as total_paid
       FROM factory_worker_ledger
       WHERE worker_id = $1
       AND entry_type = 'payment'
       AND EXTRACT(YEAR FROM date) = $2
       AND EXTRACT(MONTH FROM date) = $3`,
      [workerId, parseInt(year), parseInt(monthNum)]
    );

    // Get advances this month
    const advances = await queryPostgres<{ total_advance: number }>(
      STORE,
      `SELECT COALESCE(SUM(advance_amount), 0) as total_advance
       FROM factory_weekly_advance
       WHERE worker_id = $1
       AND EXTRACT(YEAR FROM week_of_date) = $2
       AND EXTRACT(MONTH FROM week_of_date) = $3`,
      [workerId, parseInt(year), parseInt(monthNum)]
    );

    const totalSalary = worker.monthly_salary || 0;
    const totalPaid = payments?.[0]?.total_paid || 0;
    const totalAdvance = advances?.[0]?.total_advance || 0;
    const remainingBalance = totalSalary - totalPaid - totalAdvance;

    return NextResponse.json({
      worker_id: workerId,
      month: `${year}-${monthNum}`,
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
