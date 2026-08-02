import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { queryPostgres } from "@/lib/postgres/client";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

interface Item {
  id: string;
  name: string;
  code: string | null;
  status: string;
  production_item_id: string | null;
  production_item_name: string | null;
}

interface ProductionItemOption {
  id: string;
  name: string;
  category: string;
  production_type: string;
  size_group: string;
}

export async function GET() {
  const denied = await authorizeFactoryApi("/api/factory/items", "GET");
  if (denied) return denied;

  try {
    const [items, productionItems] = await Promise.all([
      queryPostgres<Item>(
        STORE,
        `SELECT items.id, items.name, items.code, items.status, items.created_at,
                items.production_item_id, production.name AS production_item_name
         FROM factory_items items
         LEFT JOIN production_items production ON production.id = items.production_item_id
         WHERE items.status = 'active'
         ORDER BY items.name ASC`,
      ),
      queryPostgres<ProductionItemOption>(
        STORE,
        `SELECT id, name, category, production_type, size_group
         FROM production_items
         WHERE status = 'Active'
         ORDER BY name ASC`,
      ),
    ]);

    return NextResponse.json({ items, productionItems });
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
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const code = typeof body.code === "string" && body.code.trim() ? body.code.trim() : null;
    const productionItemId = typeof body.production_item_id === "string" && body.production_item_id.trim()
      ? body.production_item_id.trim()
      : null;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (productionItemId) {
      const productionItems = await queryPostgres<{ id: string }>(
        STORE,
        `SELECT id FROM production_items WHERE id = $1 AND status = 'Active'`,
        [productionItemId],
      );
      if (!productionItems[0]) {
        return NextResponse.json({ error: "Active Production Item not found" }, { status: 404 });
      }

      const linked = await queryPostgres<{ id: string }>(
        STORE,
        `SELECT id FROM factory_items WHERE production_item_id = $1 LIMIT 1`,
        [productionItemId],
      );
      if (linked[0]) {
        return NextResponse.json({ error: "This Production Item is already linked to a Factory Item" }, { status: 409 });
      }
    }

    const id = crypto.randomUUID();
    await queryPostgres(
      STORE,
      `INSERT INTO factory_items (id, name, code, status, production_item_id)
       VALUES ($1, $2, $3, 'active', $4)`,
      [id, name, code, productionItemId]
    );
    await recordAdminAuditEvent(
      "factory_item_create",
      `Factory item ${name} created${productionItemId ? " with a Production Item link" : " without a Production Item link"}.`,
    );

    return NextResponse.json(
      { id, name, code, status: "active", production_item_id: productionItemId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating item:", error);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await authorizeFactoryApi("/api/factory/items", "PATCH");
  if (denied) return denied;

  try {
    const body = await request.json();
    const itemId = typeof body.item_id === "string" ? body.item_id.trim() : "";
    const productionItemId = typeof body.production_item_id === "string" && body.production_item_id.trim()
      ? body.production_item_id.trim()
      : null;

    if (!itemId) {
      return NextResponse.json({ error: "item_id is required" }, { status: 400 });
    }

    if (productionItemId) {
      const productionItems = await queryPostgres<{ id: string }>(
        STORE,
        `SELECT id FROM production_items WHERE id = $1 AND status = 'Active'`,
        [productionItemId],
      );
      if (!productionItems[0]) {
        return NextResponse.json({ error: "Active Production Item not found" }, { status: 404 });
      }

      const linked = await queryPostgres<{ id: string }>(
        STORE,
        `SELECT id FROM factory_items WHERE production_item_id = $1 AND id <> $2 LIMIT 1`,
        [productionItemId, itemId],
      );
      if (linked[0]) {
        return NextResponse.json({ error: "This Production Item is already linked to another Factory Item" }, { status: 409 });
      }
    }

    const updated = await queryPostgres<Item>(
      STORE,
      `UPDATE factory_items
       SET production_item_id = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, name, code, status, production_item_id,
                 NULL::text AS production_item_name`,
      [itemId, productionItemId],
    );
    if (!updated[0]) {
      return NextResponse.json({ error: "Factory Item not found" }, { status: 404 });
    }

    await recordAdminAuditEvent(
      "factory_item_production_link_update",
      `Factory item ${updated[0].name} Production Item link ${productionItemId ? "updated" : "removed"}.`,
    );
    return NextResponse.json({ item: updated[0] });
  } catch (error) {
    console.error("Error linking Factory Item to Production Item:", error);
    return NextResponse.json({ error: "Failed to update Factory Item link" }, { status: 500 });
  }
}
