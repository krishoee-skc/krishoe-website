import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { backupExtensionTableSpecs } from "@/lib/backup-table-manifest.mjs";

/**
 * Every table is in the nightly backup, or says why not (owner, 2026-10-20,
 * audit 2). Eighteen tables had been added since the backup list was last
 * grown — the challans, where each pair is, cheques, discount codes, the
 * month's goal, workers' photos — and none of them would have come back after
 * a restore. A new table now fails this test until it is placed in one list.
 */

/** Written by lib/backup.ts through the shop's own readers (products, orders, operations, purchasing, settings). */
const CORE = [
  "products",
  "users",
  "password_reset_tokens",
  "email_verification_tokens",
  "orders",
  "order_items",
  "contact_messages",
  "admin_audit_events",
  "company_settings",
  "company_branches",
  "admin_staff_accounts",
  "notification_events",
  "raw_materials",
  "supplier_ledgers",
  "supplier_transactions",
  "purchase_invoices",
  "purchase_invoice_items",
  "costing_settings",
  "production_batches",
  "material_consumptions",
  "worker_tasks",
  "finished_stock",
  "stock_movements",
  "vehicle_dispatches",
  "vehicle_dispatch_items",
  "customer_ledgers",
  "ledger_transactions",
  "pos_invoices",
  "payment_transactions",
];

/** Left out on purpose: each is rebuilt by use, belongs to one device, or is a log. */
const NOT_BACKED_UP: Record<string, string> = {
  admin_staff_tokens: "one-time invite and reset links; a restored one would reopen a used link",
  admin_staff_sessions: "who is signed in now; everyone signs in again after a restore",
  admin_staff_access_history: "a log of sign-ins, kept in the live database",
  admin_passkeys: "a passkey belongs to one phone; it is set up again on that phone",
  admin_passkey_challenges: "lives for a minute during a sign-in",
  rate_limit_attempts: "counts of recent tries, minutes old",
  push_subscriptions: "a browser's own address, renewed when the browser opens the app",
  checkout_attempts: "a cart left behind, used for one reminder",
  sms_messages: "a log of what was sent",
  monitoring_errors: "the app's own error log",
  monitoring_performance: "speed measurements",
  monitoring_uptime: "uptime checks",
};

function schemaTables() {
  const schema = readFileSync("docs/schema.sql", "utf8");
  return [...new Set([...schema.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)/g)].map((match) => match[1]))];
}

describe("every table is in the nightly backup, or says why not", () => {
  it("leaves no table out by accident", () => {
    const placed = new Set([...CORE, ...Object.keys(NOT_BACKED_UP), ...backupExtensionTableSpecs.map(({ table }) => table)]);
    const unplaced = schemaTables().filter((table) => !placed.has(table));
    expect(unplaced, "add each to lib/backup-table-manifest.mjs, or to NOT_BACKED_UP with the reason").toEqual([]);
  });

  it("lists nothing twice and nothing that no longer exists", () => {
    const tables = new Set(schemaTables());
    const all = [...CORE, ...Object.keys(NOT_BACKED_UP), ...backupExtensionTableSpecs.map(({ table }) => table)];
    expect(all.filter((table) => !tables.has(table))).toEqual([]);
    expect(all.length).toBe(new Set(all).size);
  });
});
