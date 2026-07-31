import { queryPostgres } from "@/lib/postgres/client";
import { positiveAmount } from "@/lib/factory-money";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

interface Rate {
  id: string;
  item_id: string;
  worker_category: string;
  rate_per_pair: number;
  effective_date: string;
}

export async function GET(request: NextRequest) {
  try {
    const itemId = request.nextUrl.searchParams.get("itemId");
    const workerCategory = request.nextUrl.searchParams.get("workerCategory");

    let rates: Rate[] = [];

    if (itemId && workerCategory) {
      rates = await queryPostgres<Rate>(
        STORE,
        `SELECT id, item_id, worker_category, rate_per_pair, effective_date
         FROM factory_rates
         WHERE item_id = $1 AND worker_category = $2
         ORDER BY effective_date DESC
         LIMIT 1`,
        [itemId, workerCategory]
      );
    } else {
      rates = await queryPostgres<Rate>(
        STORE,
        `SELECT id, item_id, worker_category, rate_per_pair, effective_date
         FROM factory_rates
         ORDER BY effective_date DESC`
      );
    }

    return NextResponse.json({ rates });
  } catch (error) {
    console.error("Error fetching rates:", error);
    return NextResponse.json({ error: "Failed to fetch rates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, worker_category } = body;
    const ratePerPair = positiveAmount(body.rate_per_pair);

    if (!item_id || !worker_category || !ratePerPair) {
      return NextResponse.json(
        { error: "item_id, worker_category, and a positive rate_per_pair are required" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await queryPostgres(
      STORE,
      `INSERT INTO factory_rates (id, item_id, worker_category, rate_per_pair, effective_date)
       VALUES ($1, $2, $3, $4, CURRENT_DATE)`,
      [id, item_id, worker_category, ratePerPair]
    );

    return NextResponse.json(
      { id, item_id, worker_category, rate_per_pair: ratePerPair },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating rate:", error);
    return NextResponse.json({ error: "Failed to create rate" }, { status: 500 });
  }
}
