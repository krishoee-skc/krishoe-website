import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { migrationChecksum } from "@/lib/delivery-database";
import { orderDispatchMigrations } from "@/lib/order-dispatch-database";

/**
 * The order desk as five steps (owner, 2026-09-29): New → Called → Sent →
 * Reached and money in → Bill made, one big button for the next step, a
 * packing slip, a message for the customer, and a reason for every cancel.
 *
 * What must not move: an order's status. A sent order stays Contacted, so it
 * keeps holding its pairs (lib/order-stock.ts, the checkout's hold SQL) and
 * counts as a sale in every report exactly as before. "Sent" lives in new
 * columns, added only from an Owner button.
 */
describe("the Owner's database button for sending orders", () => {
  it.each(orderDispatchMigrations.map((migration) => [migration.name, migration]))(
    "%s is the migration file, word for word",
    async (name, migration) => {
      const file = (await readFile(`scripts/migrations/${name}`, "utf8")).replace(/\r\n/g, "\n");
      expect(migration.sql).toBe(file);
      expect(migrationChecksum(migration.sql)).toBe(migrationChecksum(file));
    },
  );

  it("only adds columns, never changes a status or removes anything", () => {
    for (const migration of orderDispatchMigrations) {
      const statements = migration.sql
        .split("\n")
        .filter((line) => line.trim() && !line.trim().startsWith("--"))
        .join("\n");
      expect(statements).toMatch(/^(ALTER TABLE orders ADD COLUMN IF NOT EXISTS [^\n]+ DEFAULT [^\n]+\n?)+$/);
      expect(statements).not.toMatch(/CONSTRAINT|DROP|status/i);
    }
  });

  it("is offered in Settings behind a preview, Owner only", async () => {
    const page = await readFile("app/admin/settings/page.tsx", "utf8");
    const action = await readFile("app/admin/settings/actions.ts", "utf8");
    expect(page).toContain("orderDispatchDatabase && !orderDispatchDatabase.ready");
    expect(page).toContain("<form action={prepareOrderDispatchDatabaseAction}");
    const prepare = action.slice(action.indexOf("export async function prepareOrderDispatchDatabaseAction"));
    expect(prepare.slice(0, 500)).toContain('await requireAdminPermission("settings:write")');
    expect(prepare.slice(0, 500)).toContain('textValue(formData, "confirm") !== "yes"');
  });
});

describe("sending an order", () => {
  it("keeps the status, except that a New order sent is confirmed", async () => {
    const lib = await readFile("lib/order-dispatch.ts", "utf8");
    const mark = lib.slice(lib.indexOf("export async function markOrderDispatched"), lib.indexOf("export async function clearOrderDispatch"));
    expect(mark).toContain("status = CASE WHEN status = 'New' THEN 'Contacted' ELSE status END");
    expect(mark).toContain("WHERE id = $1 AND status IN ('New', 'Contacted')");
    // Nothing is read or written until the Owner's button has run.
    expect(lib).toContain("if (ids.length === 0 || !(await orderDispatchAvailable())) return {};");
  });

  it("the order statuses themselves are unchanged", async () => {
    const constants = await readFile("lib/order-constants.ts", "utf8");
    expect(constants).toContain('export const orderStatuses = ["New", "Contacted", "Closed", "Cancelled"] as const;');
  });
});

describe("the desk", () => {
  it("shows the five steps and one next step", async () => {
    const desk = await readFile("app/admin/OrdersClient.tsx", "utf8");
    for (const step of ["नयाँ", "फोन गरियो", "पठाइयो", "पुग्यो र पैसा आयो", "बिल बन्यो"]) {
      expect(desk, step).toContain(`ne: "${step}"`);
    }
    expect(desk).toContain('run(updateOrderStatusAction, { id: order.id, status: "Contacted" })');
    expect(desk).toContain("run(markOrderDispatchedAction, {");
    expect(desk).toContain("run(createPosInvoiceFromOrderAction, {");
  });

  it("will not make a bill for pairs that are not on the shelf", async () => {
    const desk = await readFile("app/admin/OrdersClient.tsx", "utf8");
    expect(desk).toContain("(stage === 1 || stage === 2) && !stockShort ?");
  });

  it("asks why before cancelling, and refuses to cancel a billed order", async () => {
    const desk = await readFile("app/admin/OrdersClient.tsx", "utf8");
    expect(desk).toContain("disabled={!reason || isPending}");
    const actions = await readFile("app/admin/actions.ts", "utf8");
    const cancel = actions.slice(actions.indexOf("export async function cancelOrderWithReasonAction"));
    expect(cancel.slice(0, 900)).toContain("if (!reason) return");
    expect(cancel.slice(0, 900)).toContain("getPosInvoiceForOnlineOrder(id)");
  });

  it("keeps every old control, folded under Detailed", async () => {
    const desk = await readFile("app/admin/OrdersClient.tsx", "utf8");
    const detailed = desk.slice(desk.indexOf("<details className=\"rounded-xl border border-brand-green-line p-3\">"));
    for (const control of ["<OrderStatusSelector", "<OrderPaymentForm", "<OrderToPosForm"]) {
      expect(detailed, control).toContain(control);
    }
  });

  it("prints only the packing slip", async () => {
    const css = await readFile("app/globals.css", "utf8");
    expect(css).toContain("body:has(.print-slip) * { visibility: hidden; }");
  });
});
