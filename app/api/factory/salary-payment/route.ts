import { authorizeFactoryApi } from "@/lib/factory-api-access";
import {
  createFactoryLedgerEntry,
  FactoryMutationError,
  submissionKeyForFactoryRequest,
} from "@/lib/factory-mutations";
import { monthKey, positiveAmount, ymdDate } from "@/lib/factory-money";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/salary-payment", "POST");
  if (denied) return denied;

  try {
    const body = await request.json();
    const workerId = typeof body.worker_id === "string" ? body.worker_id.trim() : "";
    const amount = positiveAmount(body.amount);
    const date = ymdDate(body.date);
    const periodMonth = monthKey(body.period_month);
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

    const result = await createFactoryLedgerEntry({
      submissionKey,
      workerId,
      date,
      entryType: "payment",
      workPairs: null,
      amountEarned: 0,
      paymentGiven: amount,
      status: "settled",
      notes:
        typeof body.notes === "string" && body.notes.trim()
          ? body.notes.trim()
          : "Factory salary payment",
      salaryPeriodMonth: periodMonth,
      allowedWorkerTypes: ["monthly_staff"],
    });

    return NextResponse.json(
      {
        ...result,
        amount: result.payment_given,
        new_balance: result.running_balance,
      },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error recording payment:", errorMsg);
    return NextResponse.json(
      {
        error:
          error instanceof FactoryMutationError
            ? error.message
            : "Failed to record payment",
      },
      { status: error instanceof FactoryMutationError ? error.status : 500 }
    );
  }
}
