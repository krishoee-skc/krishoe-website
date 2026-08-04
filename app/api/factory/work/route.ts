import { authorizeFactoryApi } from "@/lib/factory-api-access";
import {
  createFactoryWork,
  FactoryMutationError,
  submissionKeyForFactoryRequest,
} from "@/lib/factory-mutations";
import { queryPostgres } from "@/lib/postgres/client";
import {
  numeric,
  positiveInteger,
  ymdDate,
  type DbNumeric,
} from "@/lib/factory-money";
import { notifyWorkEntry } from "@/lib/whatsapp-gateway";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

interface WorkEntry {
  id: string;
  date: string;
  worker_id: string;
  item_id: string;
  color: string | null;
  size: string | null;
  pairs_count: number;
  status: string;
  rate_applied: DbNumeric;
  amount_earned: DbNumeric;
}

export async function POST(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/work", "POST");
  if (denied) return denied;

  try {
    const body = await request.json();
    const workerId = typeof body.worker_id === "string" ? body.worker_id.trim() : "";
    const itemId = typeof body.item_id === "string" ? body.item_id.trim() : "";
    const workOrderId =
      typeof body.work_order_id === "string" && body.work_order_id.trim()
        ? body.work_order_id.trim()
        : null;
    const color = body.color;
    const size = body.size;
    const status = typeof body.status === "string" && body.status ? body.status : "completed";
    const date = ymdDate(body.date);
    const pairsCount = positiveInteger(body.pairs_count);
    const submissionKey = submissionKeyForFactoryRequest(request, body.submission_key);

    if (!date || !workerId || !itemId || !pairsCount) {
      return NextResponse.json(
        { error: "date, worker_id, item_id, and a positive pairs_count are required" },
        { status: 400 }
      );
    }

    const result = await createFactoryWork({
      submissionKey,
      date,
      workerId,
      itemId,
      workOrderId,
      color: typeof color === "string" && color.trim() ? color.trim() : null,
      size: typeof size === "string" && size.trim() ? size.trim() : null,
      pairsCount,
      status,
    });

    // Send WhatsApp notification if work entry was created successfully
    if (!result.replayed && result.id) {
      try {
        // Fetch worker and item names for notification
        const worker = await queryPostgres(
          STORE,
          "SELECT name FROM factory_workers WHERE id = $1",
          [workerId]
        );
        const item = await queryPostgres(
          STORE,
          "SELECT name FROM factory_items WHERE id = $1",
          [itemId]
        );

        if (worker.length > 0 && item.length > 0) {
          const workerName = (worker[0] as any).name;
          const itemName = (item[0] as any).name;
          const amount = Number(result.amount_earned) || 0;

          await notifyWorkEntry({
            workerName,
            productName: itemName,
            pairsCount: Number(pairsCount),
            amount,
          });
        }
      } catch (notificationError) {
        // Log but don't fail the request if notification fails
        console.error("Failed to send WhatsApp notification:", notificationError);
      }
    }

    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    console.error("Error creating work entry:", error);
    return NextResponse.json(
      {
        error:
          error instanceof FactoryMutationError
            ? error.message
            : "Failed to create work entry",
      },
      { status: error instanceof FactoryMutationError ? error.status : 500 }
    );
  }
}

interface WorkWithNames extends WorkEntry {
  worker_name: string;
  item_name: string;
}

export async function GET(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/work", "GET");
  if (denied) return denied;

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

    const params: string[] = [];
    const conditions = ["fw.worker_type = 'piece_rate'"];

    if (date) {
      params.push(date);
      conditions.push(`w.date = $${params.length}`);
    }
    if (workerId) {
      params.push(workerId);
      conditions.push(`w.worker_id = $${params.length}`);
    }

    query += ` WHERE ${conditions.join(" AND ")}`;
    query += ` ORDER BY w.created_at DESC`;

    const works = await queryPostgres<WorkWithNames>(STORE, query, params.length > 0 ? params : undefined);

    // PostgreSQL NUMERIC values arrive as strings. Normalize them at the API
    // boundary so dashboard arithmetic never becomes string concatenation.
    const validWorks = works
      .filter((work) => work && work.worker_name && work.item_name)
      .map((work) => ({
        ...work,
        pairs_count: Number(work.pairs_count) || 0,
        rate_applied: numeric(work.rate_applied),
        amount_earned: numeric(work.amount_earned),
      }));

    if (validWorks.length === 0 && works.length > 0) {
      return NextResponse.json({
        error: "No valid work entries found. Check if factory_workers and factory_items tables are populated.",
        works: []
      });
    }

    return NextResponse.json({ works: validWorks });
  } catch (error) {
    console.error("Error fetching work entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch work entries." },
      { status: 500 },
    );
  }
}
