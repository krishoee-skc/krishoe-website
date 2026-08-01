import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { queryPostgres } from "@/lib/postgres/client";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

interface Item {
  id: string;
  name: string;
  code: string | null;
  status: string;
}

export async function GET() {
  const denied = await authorizeFactoryApi("/api/factory/items", "GET");
  if (denied) return denied;

  try {
    const items = await queryPostgres<Item>(
      STORE,
      `SELECT id, name, code, status, created_at
       FROM factory_items
       WHERE status = 'active'
       ORDER BY name ASC`
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching items:", error);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/items", "POST");
  if (denied) return denied;

  try {
    const body = await request.json();
    const { name, code } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await queryPostgres(
      STORE,
      `INSERT INTO factory_items (id, name, code, status)
       VALUES ($1, $2, $3, 'active')`,
      [id, name, code || null]
    );

    return NextResponse.json(
      { id, name, code, status: "active" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating item:", error);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}
