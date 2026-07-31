import { queryPostgres } from "@/lib/postgres/client";
import { positiveAmount, ymdDate } from "@/lib/factory-money";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

export async function POST(request: NextRequest) {
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

    const advanceId = crypto.randomUUID();
    const [year, month, day] = date.split("-");
    const weekOfDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    weekOfDate.setDate(weekOfDate.getDate() - weekOfDate.getDay());

    await queryPostgres(
      STORE,
      `INSERT INTO factory_weekly_advance (id, worker_id, week_of_date, advance_amount, date_given)
       VALUES ($1, $2, $3, $4, $5)`,
      [advanceId, worker_id, weekOfDate.toISOString().split("T")[0], amount, date]
    );

    return NextResponse.json({
      id: advanceId,
      worker_id,
      amount,
      date,
    }, { status: 201 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error recording advance:", errorMsg);
    return NextResponse.json(
      { error: "Failed to record advance", detail: errorMsg },
      { status: 500 }
    );
  }
}
