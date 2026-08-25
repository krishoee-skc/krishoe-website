import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { isDuplicateNameViolation } from "@/lib/duplicate-name-error";
import {
  FACTORY_WORKER_CATEGORIES,
  FACTORY_WORKER_TYPES,
} from "@/lib/factory-worker-options";
import { queryPostgres } from "@/lib/postgres/client";
import { NextRequest, NextResponse } from "next/server";

function duplicateWorkerMessage(existingName?: string) {
  const who = existingName ? `A worker named "${existingName}"` : "A worker with this name";
  return `${who} already exists. Add something that tells them apart, such as a surname.`;
}

const STORE = "krishoe";
// One list, shared with the screen. Written out here as well, it had already
// dropped "Fibermen" — the stage five of this shop's eight workers are in — so
// this endpoint would have refused to save a correction to any of them.
const workerTypes = new Set<string>(FACTORY_WORKER_TYPES);
const workerCategories = new Set<string>(FACTORY_WORKER_CATEGORIES);

interface Worker {
  id: string;
  name: string;
  worker_type: string;
  category: string;
  monthly_salary: number | null;
  weekly_advance: number | null;
  status: string;
  today_pairs: number;
}

export async function GET(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/workers", "GET");
  if (denied) return denied;

  const includeRetired = request.nextUrl.searchParams.get("include") === "retired";

  try {
    const workers = await queryPostgres<Worker>(
      STORE,
      `SELECT workers.id, workers.name, workers.worker_type, workers.category,
              workers.monthly_salary, workers.weekly_advance, workers.status,
              workers.created_at,
              COALESCE(today_work.today_pairs, 0)::integer AS today_pairs
       FROM factory_workers workers
       LEFT JOIN LATERAL (
         SELECT SUM(work.pairs_count)::integer AS today_pairs
         FROM factory_daily_work work
         WHERE work.worker_id = workers.id AND work.date = CURRENT_DATE
       ) today_work ON true
       ${includeRetired ? "" : "WHERE workers.status = 'active'"}
       ORDER BY workers.status ASC, workers.name ASC`,
    );

    return NextResponse.json({ workers });
  } catch (error) {
    console.error("Error fetching workers:", error);
    return NextResponse.json({ error: "Failed to fetch workers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/workers", "POST");
  if (denied) return denied;

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const worker_type = typeof body.worker_type === "string" ? body.worker_type : "";
    const category = typeof body.category === "string" ? body.category : "";
    const monthly_salary = Number(body.monthly_salary || 0) || null;
    const weekly_advance = Number(body.weekly_advance || 0) || null;

    if (!name || !workerTypes.has(worker_type) || !workerCategories.has(category)) {
      return NextResponse.json(
        { error: "A valid name, worker type, and factory stage are required" },
        { status: 400 }
      );
    }

    // Two workers reading the same in a dropdown cannot be told apart at entry
    // time, and their pay quietly splits across both rows — "aarif" and
    // "aarif " already did exactly that. Two people really can share a name, so
    // this refuses rather than merges: distinguish them at entry.
    //
    // Case and surrounding spaces are ignored, so "ankus", "Ankus" and "ankus "
    // are one worker. factory_workers_name_unique_idx applies the same rule in
    // the database, for the two requests that arrive too close together for
    // this check to see each other.
    const clash = await queryPostgres<{ name: string }>(
      STORE,
      `SELECT name FROM factory_workers WHERE lower(btrim(name)) = lower($1) LIMIT 1`,
      [name],
    );
    if (clash[0]) {
      return NextResponse.json(
        { error: duplicateWorkerMessage(clash[0].name) },
        { status: 409 },
      );
    }

    const id = crypto.randomUUID();
    await queryPostgres(
      STORE,
      `INSERT INTO factory_workers
       (id, name, worker_type, category, monthly_salary, weekly_advance, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
      [id, name, worker_type, category, monthly_salary || null, weekly_advance || null]
    );
    await recordAdminAuditEvent("factory_worker_create", `Factory worker ${name} created.`);

    return NextResponse.json(
      { id, name, worker_type, category, monthly_salary, weekly_advance },
      { status: 201 }
    );
  } catch (error) {
    // The index caught what the check above could not see: the same name being
    // saved twice at once. Same answer either way.
    if (isDuplicateNameViolation(error, "factory_workers_name_unique_idx")) {
      return NextResponse.json({ error: duplicateWorkerMessage() }, { status: 409 });
    }
    console.error("Error creating worker:", error);
    return NextResponse.json({ error: "Failed to create worker" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/workers", "PATCH");
  if (denied) return denied;

  try {
    const body = await request.json();
    const workerId = typeof body.worker_id === "string" ? body.worker_id.trim() : "";

    if (!workerId) {
      return NextResponse.json({ error: "worker_id is required" }, { status: 400 });
    }

    /**
     * Correct a worker's name, stage or pay type — or take them off the forms.
     *
     * A worker record is created by typing a name while entering work, and none
     * of it could be changed afterwards. A name mistyped once printed on that
     * person's payslip every month after, and someone who left the factory
     * stayed in every dropdown for the rest of the shop's life, waiting for a
     * day's work to be entered against them by mistake.
     *
     * Retired, never deleted — and the database agrees: worker_id in
     * factory_daily_work is ON DELETE RESTRICT, so removing someone who has
     * ever worked a day is refused outright, which is exactly right. Their
     * wages are theirs.
     *
     * Changing the stage is safe for the same reason it looks dangerous: every
     * row of daily work already carries the rate_applied and amount_earned it
     * was paid at, so a correction moves what happens next and never rewrites
     * what someone was paid last month.
     */
    const wantsDetails =
      typeof body.name === "string" ||
      typeof body.category === "string" ||
      typeof body.worker_type === "string" ||
      typeof body.status === "string";

    if (wantsDetails) {
      const current = await queryPostgres<Worker>(
        STORE,
        `SELECT id, name, worker_type, category, status FROM factory_workers WHERE id = $1`,
        [workerId],
      );
      if (!current[0]) {
        return NextResponse.json({ error: "Worker not found" }, { status: 404 });
      }

      const name = typeof body.name === "string" ? body.name.trim() : current[0].name;
      const category = typeof body.category === "string" ? body.category.trim() : current[0].category;
      const workerType = typeof body.worker_type === "string" ? body.worker_type.trim() : current[0].worker_type;
      const status = typeof body.status === "string" ? body.status.trim() : current[0].status;

      if (!name) {
        return NextResponse.json({ error: "A worker needs a name" }, { status: 400 });
      }
      if (!workerCategories.has(category)) {
        return NextResponse.json({ error: "That factory stage is not one this shop uses" }, { status: 400 });
      }
      if (!workerTypes.has(workerType)) {
        return NextResponse.json({ error: "That pay type is not one this shop uses" }, { status: 400 });
      }
      if (status !== "active" && status !== "inactive") {
        return NextResponse.json({ error: "status must be active or inactive" }, { status: 400 });
      }

      try {
        const saved = await queryPostgres<Worker>(
          STORE,
          `UPDATE factory_workers
           SET name = $2, category = $3, worker_type = $4, status = $5, updated_at = now()
           WHERE id = $1
           RETURNING id, name, worker_type, category, monthly_salary, weekly_advance,
                     status`,
          [workerId, name, category, workerType, status],
        );

        const changes = [
          name !== current[0].name ? `renamed from ${current[0].name}` : "",
          category !== current[0].category ? `stage ${current[0].category} → ${category}` : "",
          workerType !== current[0].worker_type ? `pay type ${current[0].worker_type} → ${workerType}` : "",
          status !== current[0].status ? (status === "active" ? "brought back into use" : "retired from the work forms") : "",
        ].filter(Boolean);

        await recordAdminAuditEvent(
          status !== current[0].status && status === "inactive"
            ? "factory_worker_retired"
            : "factory_worker_updated",
          `Factory worker ${name}: ${changes.join("; ") || "no change"}.`,
        );

        return NextResponse.json({ worker: saved[0] });
      } catch (error) {
        if (isDuplicateNameViolation(error, "factory_workers_name_unique_idx")) {
          return NextResponse.json({ error: duplicateWorkerMessage(name) }, { status: 409 });
        }
        throw error;
      }
    }

    // Nothing to change. This used to fall through to the HR link, which is
    // gone, so a PATCH carrying none of the four fields is now plainly wrong
    // rather than a silent no-op that reported success.
    return NextResponse.json(
      { error: "Send a name, factory stage, pay type or status to change." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error updating factory worker:", error);
    return NextResponse.json({ error: "Failed to update worker" }, { status: 500 });
  }
}
