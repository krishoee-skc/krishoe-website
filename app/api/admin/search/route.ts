import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  ADMIN_SEARCH_PAGES,
  searchRecords,
  withKindTerms,
  type AdminSearchRecord,
} from "@/lib/admin-search";
import { queryPostgres } from "@/lib/postgres/client";
import { reportError } from "@/lib/report-error";

const STORE = "krishoe";

/**
 * One box that finds anything in the shop.
 *
 * The page it serves used to load the whole product list, the whole operations
 * file, all of purchasing and all of POS on every keystroke's worth of typing,
 * then filter them in memory. That was survivable when it only ran on submit.
 * Typing as you go means a request per pause, so the matching moved into the
 * database: each query returns at most a handful of rows already narrowed by
 * what was typed, instead of everything the shop has ever recorded.
 *
 * Workers, factory items and customer orders are searched here for the first
 * time. The owner typed "ank" looking for ankus and the search reported
 * nothing, because workers were never in it.
 */

const PER_KIND = 6;

type Row = Record<string, string | number | null>;

function text(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

async function safeQuery(what: string, sql: string, params: unknown[]): Promise<Row[]> {
  try {
    return await queryPostgres<Row>(STORE, sql, params as never[]);
  } catch (error) {
    // One table being unavailable must not blank the whole search. The rest of
    // the shop is still findable, and the failure is recorded rather than
    // shown as "no results", which would read as "this does not exist".
    reportError(`search ${what}`, error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const adminUser = await requireAdminPermission("production:entry");
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();

  // Two letters, because one letter matches most of the shop and the list that
  // comes back is noise the reader has to scroll past.
  if (query.length < 2) {
    return NextResponse.json({ hits: [], query });
  }

  const like = `%${query.toLowerCase()}%`;

  const [workers, items, products, customers, orders, invoices, suppliers] = await Promise.all([
    safeQuery(
      "workers",
      `SELECT id, name, category, worker_type, status
       FROM factory_workers
       WHERE lower(name) LIKE $1
       ORDER BY status ASC, name ASC LIMIT ${PER_KIND}`,
      [like],
    ),
    safeQuery(
      "factory items",
      `SELECT id, name, status
       FROM factory_items
       WHERE lower(name) LIKE $1
       ORDER BY status ASC, name ASC LIMIT ${PER_KIND}`,
      [like],
    ),
    safeQuery(
      "products",
      `SELECT id, name, sku, stock, status
       FROM products
       WHERE lower(name) LIKE $1 OR lower(coalesce(sku, '')) LIKE $1
       ORDER BY name ASC LIMIT ${PER_KIND}`,
      [like],
    ),
    safeQuery(
      "customers",
      `SELECT id, name, phone
       FROM users
       WHERE lower(coalesce(name, '')) LIKE $1 OR coalesce(phone, '') LIKE $1
       ORDER BY name ASC LIMIT ${PER_KIND}`,
      [like],
    ),
    safeQuery(
      "orders",
      // The order table names the buyer in `name` and has no reference of its
      // own — the id is the reference. Checked against the live columns rather
      // than assumed, which is how two guessed names were caught here.
      `SELECT id, name, phone, total
       FROM orders
       WHERE lower(coalesce(name, '')) LIKE $1
          OR coalesce(phone, '') LIKE $1
          OR lower(id) LIKE $1
       ORDER BY created_at DESC LIMIT ${PER_KIND}`,
      [like],
    ),
    safeQuery(
      "bills",
      `SELECT id, invoice_number, customer_name, phone, total
       FROM pos_invoices
       WHERE lower(coalesce(invoice_number, '')) LIKE $1
          OR lower(coalesce(customer_name, '')) LIKE $1
          OR coalesce(phone, '') LIKE $1
       ORDER BY created_at DESC LIMIT ${PER_KIND}`,
      [like],
    ),
    safeQuery(
      "suppliers",
      `SELECT id, supplier_name, phone
       FROM supplier_ledgers
       WHERE lower(coalesce(supplier_name, '')) LIKE $1 OR coalesce(phone, '') LIKE $1
       ORDER BY supplier_name ASC LIMIT ${PER_KIND}`,
      [like],
    ),
  ]);

  const records: AdminSearchRecord[] = [
    // People first, then what they make, then what was sold. Ties in the
    // ranking keep this order, which is the order the shop thinks in.
    ...workers.map((row) => ({
      kind: "worker" as const,
      title: text(row.name),
      detail: `${text(row.category)} · ${text(row.worker_type).replace(/_/g, " ")}${
        row.status === "active" ? "" : " · बन्द"
      }`,
      href: `/admin/factory/ledger?workerId=${encodeURIComponent(text(row.id))}`,
      terms: [text(row.name), text(row.category)],
    })),
    ...items.map((row) => ({
      kind: "factoryItem" as const,
      title: text(row.name),
      detail: row.status === "active" ? "कारखानाको item" : "बन्द गरिएको",
      href: "/admin/factory/items",
      terms: [text(row.name)],
    })),
    ...products.map((row) => ({
      kind: "product" as const,
      title: text(row.name),
      detail: `${text(row.stock)} जोडी · ${text(row.status)}${row.sku ? ` · ${text(row.sku)}` : ""}`,
      href: `/admin/products?edit=${encodeURIComponent(text(row.id))}`,
      terms: [text(row.name), text(row.sku)],
    })),
    ...customers.map((row) => ({
      kind: "customer" as const,
      title: text(row.name) || text(row.phone),
      detail: text(row.phone),
      href: "/admin/customers",
      terms: [text(row.name), text(row.phone)],
    })),
    ...orders.map((row) => ({
      kind: "order" as const,
      title: text(row.name) || text(row.id).slice(0, 8),
      detail: `${text(row.phone)} · Rs. ${text(row.total)}`,
      href: `/admin/orders`,
      terms: [text(row.name), text(row.phone), text(row.id)],
    })),
    ...invoices.map((row) => ({
      kind: "invoice" as const,
      title: text(row.invoice_number),
      detail: `${text(row.customer_name)} · ${text(row.phone)}`,
      href: `/admin/pos/${encodeURIComponent(text(row.id))}`,
      terms: [text(row.invoice_number), text(row.customer_name), text(row.phone)],
    })),
    ...suppliers.map((row) => ({
      kind: "supplier" as const,
      title: text(row.supplier_name),
      detail: text(row.phone),
      href: "/admin/purchasing",
      terms: [text(row.supplier_name), text(row.phone)],
    })),
    // Half of what anyone types into a search box is a place, not a record.
    ...ADMIN_SEARCH_PAGES,
  ];

  return NextResponse.json({ query, hits: searchRecords(records.map(withKindTerms), query) });
}
