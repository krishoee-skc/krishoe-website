import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const API = "app/api/factory/items/route.ts";
const PAGE = "app/admin/factory/items/page.tsx";

function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

/**
 * A factory item is created by typing its name while entering work, and a typo
 * there was permanent. One of the nine was called "45" — a rate typed into the
 * name box — and nothing in the app could take it out, so it sat in every
 * dropdown waiting to be picked by mistake.
 */
describe("taking a factory item out of use", () => {
  it("can be done from the app", async () => {
    const api = await readFile(API, "utf8");
    const page = await readFile(PAGE, "utf8");

    expect(api).toContain('status must be active or inactive');
    expect(page).toContain("setItemStatus");
    expect(page).toContain("बन्द गर्ने");
  });

  it("retires rather than deletes", async () => {
    const api = code(await readFile(API, "utf8"));

    // The wages and daily work recorded against an item stay where they are.
    // Deleting would take a month of somebody's pay with it, and could not be
    // undone.
    expect(api).toContain("SET status = $2");
    expect(api).not.toMatch(/DELETE\s+FROM\s+factory_items/i);
  });

  it("can be undone with the same button", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain('setItemStatus(item.id, "active")');
    expect(page).toContain("फेरि चालु गर्ने");
  });

  it("refuses any status the column would not hold", async () => {
    const api = await readFile(API, "utf8");
    const branch = api.slice(api.indexOf('if (typeof body.status === "string")'));

    // factory_items_status_check allows exactly these two.
    expect(branch.slice(0, 400)).toContain('status !== "active" && status !== "inactive"');
  });
});

/**
 * Retiring an item hides it everywhere — every list and form asks for
 * status = 'active'. That is the point, and it makes this screen a one-way door
 * unless it is the exception.
 */
describe("finding a retired item again", () => {
  it("is possible, because this screen asks for them", async () => {
    const api = await readFile(API, "utf8");
    const page = await readFile(PAGE, "utf8");

    expect(api).toContain('searchParams.get("include") === "retired"');
    expect(page).toContain("/api/factory/items?include=retired");
  });

  it("keeps them hidden anywhere that did not ask", async () => {
    const api = code(await readFile(API, "utf8"));

    // The default is still active-only; the filter is dropped only on request.
    expect(api).toContain(`includeRetired ? "" : "WHERE items.status = 'active'"`);
  });

  it("shows at a glance that it is out of use", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("line-through");
    expect(page).toContain('"बन्द"');
  });
});

describe("the record of it", () => {
  it("names who did what, both ways", async () => {
    const api = await readFile(API, "utf8");

    expect(api).toContain('"factory_item_retired"');
    expect(api).toContain('"factory_item_restored"');
  });
});
