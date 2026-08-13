import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { queryPostgres } from "@/lib/postgres/client";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";
const workerTypes = new Set(["piece_rate", "monthly_staff", "daily_staff"]);
const workerCategories = new Set([
  "Upper",
  "Fiber Preparation",
  "Fiber Silai",
  "Bottom Final",
  "Packing / QC",
  "Staff",
]);

interface Worker {
  id: string;
  name: string;
  worker_type: string;
  category: string;
  monthly_salary: number | null;
  weekly_advance: number | null;
  status: string;
  hr_employee_id: string | null;
  hr_employee_name: string | null;
  today_pairs: number;
}

interface HrEmployeeOption {
  id: string;
  name: string;
  phone: string;
  department: string;
  salary_type: string;
}

export async function GET() {
  const denied = await authorizeFactoryApi("/api/factory/workers", "GET");
  if (denied) return denied;

  try {
    const [workers, hrEmployees] = await Promise.all([
      queryPostgres<Worker>(
        STORE,
        `SELECT workers.id, workers.name, workers.worker_type, workers.category,
                workers.monthly_salary, workers.weekly_advance, workers.status,
                workers.created_at, workers.hr_employee_id,
                COALESCE(today_work.today_pairs, 0)::integer AS today_pairs,
                employees.name AS hr_employee_name
         FROM factory_workers workers
         LEFT JOIN hr_employees employees ON employees.id = workers.hr_employee_id
         LEFT JOIN LATERAL (
           SELECT SUM(work.pairs_count)::integer AS today_pairs
           FROM factory_daily_work work
           WHERE work.worker_id = workers.id AND work.date = CURRENT_DATE
         ) today_work ON true
         WHERE workers.status = 'active'
         ORDER BY workers.name ASC`,
      ),
      queryPostgres<HrEmployeeOption>(
        STORE,
        `SELECT id, name, phone, department, salary_type
         FROM hr_employees
         WHERE status = 'Active'
         ORDER BY name ASC`,
      ),
    ]);

    return NextResponse.json({ workers, hrEmployees });
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
    const hrEmployeeId = typeof body.hr_employee_id === "string" && body.hr_employee_id.trim()
      ? body.hr_employee_id.trim()
      : null;

    if (!name || !workerTypes.has(worker_type) || !workerCategories.has(category)) {
      return NextResponse.json(
        { error: "A valid name, worker type, and factory stage are required" },
        { status: 400 }
      );
    }

    if (hrEmployeeId) {
      const employees = await queryPostgres<{ id: string }>(
        STORE,
        `SELECT id FROM hr_employees WHERE id = $1 AND status = 'Active'`,
        [hrEmployeeId],
      );
      if (!employees[0]) {
        return NextResponse.json({ error: "Active HR employee not found" }, { status: 404 });
      }

      const linked = await queryPostgres<{ id: string }>(
        STORE,
        `SELECT id FROM factory_workers WHERE hr_employee_id = $1 LIMIT 1`,
        [hrEmployeeId],
      );
      if (linked[0]) {
        return NextResponse.json({ error: "This HR employee is already linked to a factory worker" }, { status: 409 });
      }
    }

    const id = crypto.randomUUID();
    await queryPostgres(
      STORE,
      `INSERT INTO factory_workers
       (id, name, worker_type, category, monthly_salary, weekly_advance, status, hr_employee_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)`,
      [id, name, worker_type, category, monthly_salary || null, weekly_advance || null, hrEmployeeId]
    );
    await recordAdminAuditEvent(
      "factory_worker_create",
      `Factory worker ${name} created${hrEmployeeId ? " with an HR Employee ID link" : " without an HR link"}.`,
    );

    return NextResponse.json(
      { id, name, worker_type, category, monthly_salary, weekly_advance, hr_employee_id: hrEmployeeId },
      { status: 201 }
    );
  } catch (error) {
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
    const hrEmployeeId = typeof body.hr_employee_id === "string" && body.hr_employee_id.trim()
      ? body.hr_employee_id.trim()
      : null;

    if (!workerId) {
      return NextResponse.json({ error: "worker_id is required" }, { status: 400 });
    }

    if (hrEmployeeId) {
      const employees = await queryPostgres<{ id: string }>(
        STORE,
        `SELECT id FROM hr_employees WHERE id = $1 AND status = 'Active'`,
        [hrEmployeeId],
      );
      if (!employees[0]) {
        return NextResponse.json({ error: "Active HR employee not found" }, { status: 404 });
      }

      const linked = await queryPostgres<{ id: string }>(
        STORE,
        `SELECT id FROM factory_workers WHERE hr_employee_id = $1 AND id <> $2 LIMIT 1`,
        [hrEmployeeId, workerId],
      );
      if (linked[0]) {
        return NextResponse.json({ error: "This HR employee is already linked to another factory worker" }, { status: 409 });
      }
    }

    const updated = await queryPostgres<Worker>(
      STORE,
      `UPDATE factory_workers
       SET hr_employee_id = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, name, worker_type, category, monthly_salary, weekly_advance,
                 status, hr_employee_id, NULL::text AS hr_employee_name`,
      [workerId, hrEmployeeId],
    );

    if (!updated[0]) {
      return NextResponse.json({ error: "Factory worker not found" }, { status: 404 });
    }

    await recordAdminAuditEvent(
      "factory_worker_hr_link_update",
      `Factory worker ${updated[0].name} HR link ${hrEmployeeId ? "updated" : "removed"}.`,
    );

    return NextResponse.json({ worker: updated[0] });
  } catch (error) {
    console.error("Error linking factory worker to HR:", error);
    return NextResponse.json({ error: "Failed to update worker HR link" }, { status: 500 });
  }
}
