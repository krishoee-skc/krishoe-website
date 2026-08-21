import { authorizeFactoryApi } from "@/lib/factory-api-access";
import {
  FactoryMutationError,
  refreshFactoryMonthlySummary,
  submissionKeyForFactoryRequest,
} from "@/lib/factory-mutations";
import { queryPostgres } from "@/lib/postgres/client";
import { bikramMonthRange } from "@/lib/bikram-sambat";
import { numeric } from "@/lib/factory-money";
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
  const denied = await authorizeFactoryApi("/api/factory/monthly-summary", "GET");
  if (denied) return denied;

  try {
    const requestedMonth = request.nextUrl.searchParams.get("bsMonth");
    const range = requestedMonth ? bikramMonthRange(requestedMonth) : null;
    const workerId = request.nextUrl.searchParams.get("workerId");

    if (!requestedMonth || !range) {
      return NextResponse.json(
        { error: "bsMonth is required (a Bikram Sambat month such as 2083-05)" },
        { status: 400 },
      );
    }

    let query = `SELECT ms.id, ms.month, ms.worker_id, ms.total_pairs, ms.total_earned,
                        ms.total_paid, ms.final_balance, ms.status,
                        fw.name as worker_name, fw.worker_type, fw.category
                 FROM factory_monthly_summary ms
                 JOIN factory_workers fw ON ms.worker_id = fw.id
                 WHERE ms.month >= $1::date AND ms.month < $2::date
                   AND fw.worker_type = 'piece_rate'`;

    const params: (string | null)[] = [range.startKey, range.endKey];

    if (workerId) {
      query += ` AND ms.worker_id = $3`;
      params.push(workerId);
    }

    query += ` ORDER BY fw.name ASC`;

    const summaries = await queryPostgres<Summary>(STORE, query, params);
    return NextResponse.json({
      summaries: summaries.map((summary) => ({
        ...summary,
        total_pairs: numeric(summary.total_pairs),
        total_earned: numeric(summary.total_earned),
        total_paid: numeric(summary.total_paid),
        final_balance: numeric(summary.final_balance),
      })),
    });
  } catch (error) {
    console.error("Error fetching monthly summary:", error);
    return NextResponse.json({ error: "Failed to fetch monthly summary" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/monthly-summary", "POST");
  if (denied) return denied;

  try {
    const body = await request.json();
    const workerId = typeof body.worker_id === "string" ? body.worker_id.trim() : "";
    // A Bikram Sambat month key, the same shape the reader takes.
    const month = typeof body.bsMonth === "string" && bikramMonthRange(body.bsMonth) ? body.bsMonth.trim() : null;
    const submissionKey = submissionKeyForFactoryRequest(request, body.submission_key);

    if (!month || !workerId) {
      return NextResponse.json(
        { error: "bsMonth and worker_id are required" },
        { status: 400 }
      );
    }

    const result = await refreshFactoryMonthlySummary({
      submissionKey,
      month,
      workerId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating monthly summary:", error);
    return NextResponse.json(
      {
        error:
          error instanceof FactoryMutationError
            ? error.message
            : "Failed to create monthly summary",
      },
      { status: error instanceof FactoryMutationError ? error.status : 500 },
    );
  }
}
