import { queryPostgres } from "@/lib/postgres/client";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

interface Worker {
  id: string;
  name: string;
  worker_type: string;
  category: string;
  monthly_salary: number | null;
  weekly_advance: number | null;
  status: string;
}

export async function GET() {
  try {
    const workers = await queryPostgres<Worker>(
      STORE,
      `SELECT id, name, worker_type, category, monthly_salary, weekly_advance, status, created_at
       FROM factory_workers
       WHERE status = 'active'
       ORDER BY name ASC`
    );

    return NextResponse.json({ workers });
  } catch (error) {
    console.error("Error fetching workers:", error);
    return NextResponse.json({ error: "Failed to fetch workers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, worker_type, category, monthly_salary, weekly_advance } = body;

    if (!name || !worker_type) {
      return NextResponse.json(
        { error: "Name and worker_type are required" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await queryPostgres(
      STORE,
      `INSERT INTO factory_workers (id, name, worker_type, category, monthly_salary, weekly_advance, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
      [id, name, worker_type, category, monthly_salary || null, weekly_advance || null]
    );

    return NextResponse.json(
      { id, name, worker_type, category, monthly_salary, weekly_advance },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating worker:", error);
    return NextResponse.json({ error: "Failed to create worker" }, { status: 500 });
  }
}
