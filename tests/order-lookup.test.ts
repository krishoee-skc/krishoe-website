import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Finding one order.
 *
 * getOrderById used to read the orders list and search it. That list is capped
 * at the most recent thousand — right for the screen it was written for, and
 * wrong here: past a thousand orders every older one came back as "not found".
 *
 * What calls it makes that serious. The customer's own order page, the review
 * invite, the admin actions, the daily-sales cron, and the payment-gateway
 * verification all look an order up by id. A shop's success would have quietly
 * broken its oldest receipts, and a payment against one of them.
 */
describe("looking one order up", () => {
  it("asks the database for that order, not for a page of recent ones", async () => {
    const source = await readFile("lib/submissions.ts", "utf8");

    expect(source).toContain("FROM orders WHERE id = $1");

    // The tell of the old shape: fetching the capped list and searching it.
    // getOrders() is still right for the readers that genuinely want the list.
    const lookup = source.slice(
      source.indexOf("export async function getOrderById"),
      source.indexOf("export function orderMatchesCustomer"),
    );
    expect(lookup).not.toContain("await getOrders()");
  });

  it("finds an order by its payment reference the same way", async () => {
    // A gateway callback carries a reference, not an id. Searching the capped
    // list meant an older payment could not be matched to its order at all.
    const source = await readFile("lib/submissions.ts", "utf8");
    const lookup = source.slice(source.indexOf("export async function getOrderByPaymentReference"));

    expect(lookup).toContain("WHERE payment_reference = $1");
  });

  it("fetches only that order's items", async () => {
    const source = await readFile("lib/submissions.ts", "utf8");
    const reader = source.slice(source.indexOf("async function getOrderByIdFromPostgres"));

    expect(reader).toContain("FROM order_items");
    expect(reader).toContain("WHERE order_id = $1");
  });

  it("returns nothing for an id that is not there, rather than throwing", async () => {
    const source = await readFile("lib/submissions.ts", "utf8");
    const reader = source.slice(source.indexOf("async function getOrderByIdFromPostgres"));

    expect(reader).toContain("return null;");
  });

  it("selects the same columns as the list, from one place", async () => {
    // Two readers building an order from different column lists is how a field
    // ends up present on one screen and missing on another.
    const source = await readFile("lib/submissions.ts", "utf8");

    expect(source).toContain("const ORDER_COLUMNS");
    expect(source).toContain("SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1");
    // Both readers select it, so neither can drift from the other.
    expect(source.match(/SELECT \$\{ORDER_COLUMNS\}/g) ?? []).toHaveLength(2);
  });

  it("keeps the local-json backend working the same way", async () => {
    // The shop can run on either backend; a fix that only lands on one of them
    // is a difference waiting to be discovered in production.
    const source = await readFile("lib/submissions.ts", "utf8");
    const lookup = source.slice(
      source.indexOf("export async function getOrderById"),
      source.indexOf("export function orderMatchesCustomer"),
    );

    expect(lookup).toContain("localJson:");
    expect(lookup).toContain("postgres:");
  });
});
