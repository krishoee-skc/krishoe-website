import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { addProductionItem } from "@/lib/production-accounting";
import { isDuplicateNameViolation } from "@/lib/duplicate-name-error";
import { queryPostgres } from "@/lib/postgres/client";
import { NextRequest, NextResponse } from "next/server";

const STORE = "krishoe";

function duplicateItemMessage(existingName?: string) {
  const what = existingName ? `An item named "${existingName}"` : "An item with this name";
  return `${what} already exists.`;
}

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

interface WorkOrderOption {
  id: string;
  work_order_number: string;
  item_id: string;
  item_name_snapshot: string;
  colour: string;
  size_breakdown: Record<string, number> | string;
  planned_pairs: number | string;
  current_stage: string;
  status: string;
  due_date: string | Date | null;
}

export async function GET() {
  const denied = await authorizeFactoryApi("/api/factory/items", "GET");
  if (denied) return denied;

  try {
    const [items, productionItems, workOrders] = await Promise.all([
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
      queryPostgres<WorkOrderOption>(
        STORE,
        `SELECT id, work_order_number, item_id, item_name_snapshot, colour,
                size_breakdown, planned_pairs, current_stage, status, due_date
         FROM production_work_orders
         WHERE status NOT IN ('Completed', 'Cancelled')
         ORDER BY due_date NULLS LAST, created_at DESC
         LIMIT 100`,
      ),
    ]);

    return NextResponse.json({
      items,
      productionItems,
      workOrders: workOrders.map((order) => ({
        ...order,
        planned_pairs: Number(order.planned_pairs),
        size_breakdown:
          typeof order.size_breakdown === "string"
            ? JSON.parse(order.size_breakdown)
            : order.size_breakdown,
        due_date:
          order.due_date instanceof Date
            ? order.due_date.toISOString().slice(0, 10)
            : order.due_date
              ? String(order.due_date).slice(0, 10)
              : null,
      })),
    });
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

    // Case- and space-insensitive, because "bagopen" and "Bagopen" existing side
    // by side is how one item ended up with two wage rates and work split across
    // both. The name is what the owner recognises in a dropdown, so two rows
    // that read the same are indistinguishable at the point of entry.
    const clash = await queryPostgres<{ name: string }>(
      STORE,
      `SELECT name FROM factory_items WHERE lower(btrim(name)) = lower($1) LIMIT 1`,
      [name],
    );
    if (clash[0]) {
      return NextResponse.json(
        { error: duplicateItemMessage(clash[0].name) },
        { status: 409 },
      );
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
    // Two saves of the same name arriving together: the check above ran twice
    // before either insert, so the index is what stopped it.
    if (isDuplicateNameViolation(error, "factory_items_name_unique_idx")) {
      return NextResponse.json({ error: duplicateItemMessage() }, { status: 409 });
    }
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
    let productionItemId = typeof body.production_item_id === "string" && body.production_item_id.trim()
      ? body.production_item_id.trim()
      : null;

    if (!itemId) {
      return NextResponse.json({ error: "item_id is required" }, { status: 400 });
    }

    /**
     * Create the Production Item this Factory Item should point at, then link it.
     *
     * The link is what turns two half-pictures into one: the Factory side knows
     * who made how many pairs, the Production side knows what those pairs cost
     * in leather and soles, and only a linked item can answer what a pair
     * actually earns.
     *
     * Nine factory items existed and one production item, so eight of them had
     * nothing to point at. Making them by hand meant leaving this screen,
     * creating an item, coming back, and choosing it — nine times over, which
     * is why after months not one link had been made.
     *
     * The name is copied rather than asked for. Two names for one shoe is how
     * the two sides drift apart again, and it is the drift, not the typing,
     * that costs.
     */
    if (!productionItemId && body.create_production_item) {
      const source = await queryPostgres<{ name: string }>(
        STORE,
        `SELECT name FROM factory_items WHERE id = $1`,
        [itemId],
      );
      if (!source[0]) {
        return NextResponse.json({ error: "Factory Item not found" }, { status: 404 });
      }

      const existing = await queryPostgres<{ id: string }>(
        STORE,
        `SELECT id FROM production_items
          WHERE lower(btrim(name)) = lower(btrim($1)) AND status = 'Active'
          LIMIT 1`,
        [source[0].name],
      );

      // Reuse a Production Item that already carries this name instead of
      // making a second one — a duplicate here would split the same shoe's
      // costs across two records for good.
      productionItemId =
        existing[0]?.id ??
        (
          await addProductionItem({
            name: source[0].name,
            category: typeof body.category === "string" ? body.category : "Footwear",
            productionType: "Manufactured",
            sizeGroup: "Mixed",
            catalogProductId: "",
          })
        ).id;
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
