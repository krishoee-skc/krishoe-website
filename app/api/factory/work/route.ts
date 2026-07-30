import { queryPostgres } from "@/lib/postgres/client";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

interface Rate {
  rate_per_pair: number;
}

interface Worker {
  category: string;
  worker_type: string;
}

interface WorkEntry {
  id: string;
  date: string;
  worker_id: string;
  item_id: string;
  color: string | null;
  size: string | null;
  pairs_count: number;
  status: string;
  rate_applied: number;
  amount_earned: number;
}

async function getRateForWork(itemId: string, workerCategory: string): Promise<number> {
  const rates = await queryPostgres<Rate>(
    STORE,
    `SELECT rate_per_pair FROM factory_rates
     WHERE item_id = $1 AND worker_category = $2
     ORDER BY effective_date DESC
     LIMIT 1`,
    [itemId, workerCategory]
  );

  if (rates.length === 0) {
    throw new Error(`No rate found for item ${itemId} and category ${workerCategory}`);
  }

  return rates[0].rate_per_pair;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, worker_id, item_id, color, size, pairs_count, status } = body;

    if (!date || !worker_id || !item_id || !pairs_count) {
      return NextResponse.json(
        { error: "date, worker_id, item_id, and pairs_count are required" },
        { status: 400 }
      );
    }

    // Get worker category and type
    const workers = await queryPostgres<Worker>(
      STORE,
      "SELECT category, worker_type FROM factory_workers WHERE id = $1",
      [worker_id]
    );

    if (workers.length === 0) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const workerCategory = workers[0].category;

    // Get rate for this worker category and item
    const rate = await getRateForWork(item_id, workerCategory);

    // Calculate amount
    const amountEarned = pairs_count * rate;

    // Save work entry
    const workId = crypto.randomUUID();
    await queryPostgres(
      STORE,
      `INSERT INTO factory_daily_work
       (id, date, worker_id, item_id, color, size, pairs_count, status, rate_applied, amount_earned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        workId,
        date,
        worker_id,
        item_id,
        color || null,
        size || null,
        pairs_count,
        status || "completed",
        rate,
        amountEarned,
      ]
    );

    // Add ledger entry for piece-rate workers
    if (workers[0].worker_type === "piece_rate") {
      // Get current balance
      const ledgerEntries = await queryPostgres<{ running_balance: number }>(
        STORE,
        `SELECT running_balance FROM factory_worker_ledger
         WHERE worker_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [worker_id]
      );

      const currentBalance = ledgerEntries.length > 0 ? ledgerEntries[0].running_balance : 0;
      const newBalance = currentBalance + amountEarned;

      // Add ledger entry
      const ledgerId = crypto.randomUUID();
      await queryPostgres(
        STORE,
        `INSERT INTO factory_worker_ledger
         (id, worker_id, date, entry_type, work_pairs, amount_earned, running_balance, status)
         VALUES ($1, $2, $3, 'work', $4, $5, $6, 'pending')`,
        [ledgerId, worker_id, date, pairs_count, amountEarned, newBalance]
      );
    }

    return NextResponse.json(
      {
        id: workId,
        date,
        worker_id,
        item_id,
        pairs_count,
        rate,
        amount_earned: amountEarned,
        status: status || "completed",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating work entry:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create work entry" },
      { status: 500 }
    );
  }
}

interface WorkWithNames extends WorkEntry {
  worker_name: string;
  item_name: string;
}

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date");
    const workerId = request.nextUrl.searchParams.get("workerId");

    let query = `SELECT w.id, w.date, w.worker_id, w.item_id, w.color, w.size,
                        w.pairs_count, w.status, w.rate_applied, w.amount_earned,
                        COALESCE(fw.name, 'Unknown Worker') as worker_name,
                        COALESCE(fi.name, 'Unknown Item') as item_name
                 FROM factory_daily_work w
                 LEFT JOIN factory_workers fw ON w.worker_id = fw.id
                 LEFT JOIN factory_items fi ON w.item_id = fi.id`;

    const params: (string | null)[] = [];

    if (date) {
      query += ` WHERE w.date = $1`;
      params.push(date);

      if (workerId) {
        query += ` AND w.worker_id = $2`;
        params.push(workerId);
      }
    } else if (workerId) {
      query += ` WHERE w.worker_id = $1`;
      params.push(workerId);
    }

    query += ` ORDER BY w.created_at DESC`;

    const works = await queryPostgres<WorkWithNames>(STORE, query, params.length > 0 ? params : undefined);

    // Filter out null results as safeguard
    const validWorks = works.filter(w => w && w.worker_name && w.item_name);

    if (validWorks.length === 0 && works.length > 0) {
      return NextResponse.json({
        error: "No valid work entries found. Check if factory_workers and factory_items tables are populated.",
        works: []
      });
    }

    return NextResponse.json({ works: validWorks });
  } catch (error) {
    console.error("Error fetching work entries:", error);
    return NextResponse.json({ error: `Failed to fetch work entries: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
}
