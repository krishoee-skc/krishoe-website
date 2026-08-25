import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { productionStageForFactoryCategory } from "@/lib/factory-mutations";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";
import { positiveAmount } from "@/lib/factory-money";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

interface Rate {
  id: string;
  item_id: string;
  worker_category: string;
  rate_per_pair: number;
  effective_date: string;
  rate_source?: string;
}

export async function GET(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/rates", "GET");
  if (denied) return denied;

  try {
    const itemId = request.nextUrl.searchParams.get("itemId");
    const workerCategory = request.nextUrl.searchParams.get("workerCategory");

    let rates: Rate[] = [];

    if (itemId && workerCategory) {
      rates = await queryPostgres<Rate>(
        STORE,
        `SELECT id, item_id, worker_category, rate_per_pair, effective_date,
                'Factory rate'::text AS rate_source
         FROM factory_rates
         WHERE item_id = $1 AND worker_category = $2
           AND effective_date <= CURRENT_DATE
         ORDER BY effective_date DESC, created_at DESC
         LIMIT 1`,
        [itemId, workerCategory]
      );
    } else {
      rates = await queryPostgres<Rate>(
        STORE,
        `SELECT id, item_id, worker_category, rate_per_pair, effective_date
         FROM factory_rates
         ORDER BY effective_date DESC, created_at DESC`
      );
    }

    return NextResponse.json({ rates });
  } catch (error) {
    console.error("Error fetching rates:", error);
    return NextResponse.json({ error: "Failed to fetch rates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/rates", "POST");
  if (denied) return denied;

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

    const stage = productionStageForFactoryCategory(worker_category);
    const id = crypto.randomUUID();
    const savedRate = await transactionPostgres(STORE, async (db) => {
      const itemRows = await db.query<{ production_item_id: string | null }>(
        `SELECT production_item_id FROM factory_items WHERE id = $1 AND status = 'active' FOR UPDATE`,
        [item_id],
      );
      if (!itemRows[0]) throw new Error("Active Factory Item not found.");

      const savedRates = await db.query<Rate>(
        `INSERT INTO factory_rates (id, item_id, worker_category, rate_per_pair, effective_date)
         VALUES ($1, $2, $3, $4, CURRENT_DATE)
         ON CONFLICT (item_id, worker_category, effective_date)
         DO UPDATE SET rate_per_pair = EXCLUDED.rate_per_pair
         RETURNING id, item_id, worker_category, rate_per_pair, effective_date`,
        [id, item_id, worker_category, ratePerPair],
      );

      if (itemRows[0].production_item_id && stage) {
        await db.query(
          `INSERT INTO production_stage_rates
             (id, item_id, stage, rate_per_pair, effective_from, status)
           VALUES ($1, $2, $3, $4, CURRENT_DATE, 'Active')
           ON CONFLICT (item_id, stage, effective_from) DO UPDATE SET
             rate_per_pair = EXCLUDED.rate_per_pair, status = 'Active', updated_at = now()`,
          [crypto.randomUUID(), itemRows[0].production_item_id, stage, ratePerPair],
        );
      }

      return savedRates[0];
    });

    await recordAdminAuditEvent(
      "factory_stage_rate_update",
      `Factory wage rate for ${worker_category} set to Rs. ${ratePerPair} per pair${stage ? " and synchronized with Production stage rate" : ""}.`,
    );

    return NextResponse.json(
      savedRate ?? { id, item_id, worker_category, rate_per_pair: ratePerPair },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating rate:", error);
    return NextResponse.json({ error: "Failed to create rate" }, { status: 500 });
  }
}
