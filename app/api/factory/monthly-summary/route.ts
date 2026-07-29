import { queryPostgres } from "@/lib/postgres/client";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

interface Summary {
  id: string;
  month: string;
  worker_id: string;
  worker_name: string;
  total_pairs: number;
  total_earned: number;
  total_paid: number;
  final_balance: number;
  status: string;
}

export async function GET(request: NextRequest) {
  try {
    const month = request.nextUrl.searchParams.get("month"); // Format: 2026-07
    const workerId = request.nextUrl.searchParams.get("workerId");

    if (!month) {
      return NextResponse.json({ error: "month parameter is required (YYYY-MM)" }, { status: 400 });
    }

    let query = `SELECT ms.id, ms.month, ms.worker_id, ms.total_pairs, ms.total_earned,
                        ms.total_paid, ms.final_balance, ms.status,
                        fw.name as worker_name, fw.worker_type, fw.category
                 FROM factory_monthly_summary ms
                 JOIN factory_workers fw ON ms.worker_id = fw.id
                 WHERE DATE_TRUNC('month', ms.month) = DATE_TRUNC('month', $1::date)`;

    const params: (string | null)[] = [month + "-01"];

    if (workerId) {
      query += ` AND ms.worker_id = $2`;
      params.push(workerId);
    }

    query += ` ORDER BY fw.name ASC`;

    const summaries = await queryPostgres<Summary>(STORE, query, params);
    return NextResponse.json({ summaries });
  } catch (error) {
    console.error("Error fetching monthly summary:", error);
    return NextResponse.json({ error: "Failed to fetch monthly summary" }, { status: 500 });
  }
}

interface WorkData {
  total_pairs: number | null;
  total_earned: number | null;
}

interface PaymentData {
  total_paid: number | null;
}

interface ExistingSummary {
  id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { month, worker_id } = body;

    if (!month || !worker_id) {
      return NextResponse.json(
        { error: "month and worker_id are required" },
        { status: 400 }
      );
    }

    // Get all work entries for this worker in this month
    const workData = await queryPostgres<WorkData>(
      STORE,
      `SELECT SUM(pairs_count) as total_pairs, SUM(amount_earned) as total_earned
       FROM factory_daily_work
       WHERE worker_id = $1
       AND DATE_TRUNC('month', date) = DATE_TRUNC('month', $2::date)`,
      [worker_id, month + "-01"]
    );

    const work = workData[0] || { total_pairs: 0, total_earned: 0 };

    // Get all payments for this worker in this month
    const paymentData = await queryPostgres<PaymentData>(
      STORE,
      `SELECT SUM(payment_given) as total_paid
       FROM factory_worker_ledger
       WHERE worker_id = $1
       AND entry_type = 'payment'
       AND DATE_TRUNC('month', date) = DATE_TRUNC('month', $2::date)`,
      [worker_id, month + "-01"]
    );

    const payment = paymentData[0] || { total_paid: 0 };
    const totalPairs = work.total_pairs || 0;
    const totalEarned = work.total_earned || 0;
    const totalPaid = payment.total_paid || 0;
    const finalBalance = totalEarned - totalPaid;

    const summaryId = crypto.randomUUID();
    const monthDate = new Date(`${month}-01`);

    // Check if summary already exists
    const existing = await queryPostgres<ExistingSummary>(
      STORE,
      `SELECT id FROM factory_monthly_summary
       WHERE worker_id = $1 AND DATE_TRUNC('month', month) = DATE_TRUNC('month', $2::date)`,
      [worker_id, monthDate.toISOString()]
    );

    if (existing.length > 0) {
      // Update existing
      const id = existing[0].id;
      await queryPostgres(
        STORE,
        `UPDATE factory_monthly_summary
         SET total_pairs = $1, total_earned = $2, total_paid = $3, final_balance = $4, updated_at = now()
         WHERE id = $5`,
        [totalPairs, totalEarned, totalPaid, finalBalance, id]
      );

      return NextResponse.json({
        id,
        month,
        worker_id,
        total_pairs: totalPairs,
        total_earned: totalEarned,
        total_paid: totalPaid,
        final_balance: finalBalance,
      });
    }

    // Create new summary
    await queryPostgres(
      STORE,
      `INSERT INTO factory_monthly_summary
       (id, month, worker_id, total_pairs, total_earned, total_paid, final_balance, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')`,
      [summaryId, monthDate.toISOString(), worker_id, totalPairs, totalEarned, totalPaid, finalBalance]
    );

    return NextResponse.json(
      {
        id: summaryId,
        month,
        worker_id,
        total_pairs: totalPairs,
        total_earned: totalEarned,
        total_paid: totalPaid,
        final_balance: finalBalance,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating monthly summary:", error);
    return NextResponse.json({ error: "Failed to create monthly summary" }, { status: 500 });
  }
}
