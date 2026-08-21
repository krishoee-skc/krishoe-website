import { authorizeFactoryApi } from "@/lib/factory-api-access";
import {
  createFactoryAdvance,
  FactoryMutationError,
  submissionKeyForFactoryRequest,
} from "@/lib/factory-mutations";
import { bikramMonthRange } from "@/lib/bikram-sambat";
import { positiveAmount, ymdDate } from "@/lib/factory-money";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/salary-advance", "POST");
  if (denied) return denied;

  try {
    const body = await request.json();
    const workerId = typeof body.worker_id === "string" ? body.worker_id.trim() : "";
    const amount = positiveAmount(body.amount);
    const date = ymdDate(body.date);
    // A Bikram Sambat month key — "2083-05" for Bhadra.
    const requestedPeriod = typeof body.period_month === "string" ? body.period_month.trim() : "";
    const periodMonth = bikramMonthRange(requestedPeriod) ? requestedPeriod : null;
    const submissionKey = submissionKeyForFactoryRequest(request, body.submission_key);

    if (!workerId || !amount || !date || !periodMonth) {
      return NextResponse.json(
        {
          error:
            "worker_id, a positive amount, a YYYY-MM-DD date, and period_month (YYYY-MM) are required",
        },
        { status: 400 }
      );
    }

    const result = await createFactoryAdvance({
      submissionKey,
      workerId,
      amount,
      date,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      periodMonth,
    });

    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error recording advance:", errorMsg);
    return NextResponse.json(
      {
        error:
          error instanceof FactoryMutationError
            ? error.message
            : "Failed to record advance",
      },
      { status: error instanceof FactoryMutationError ? error.status : 500 }
    );
  }
}
