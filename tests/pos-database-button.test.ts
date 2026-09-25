import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { migrationChecksum } from "@/lib/delivery-database";
import { posMigrations } from "@/lib/pos-database";

/**
 * The bill's payments column reaches the live database the way the delivery
 * columns did: from an Owner button in Settings, because the database address
 * is Sensitive and cannot be read out. It must be the migration file word for
 * word, it must only add, and until it is there the counter must not save a
 * bill in parts as if it were paid one way.
 */

describe("the Owner's database button for the counter bill", () => {
  it.each(posMigrations.map((migration) => [migration.name, migration]))(
    "%s is the migration file, word for word",
    async (name, migration) => {
      const file = (await readFile(`scripts/migrations/${name}`, "utf8")).replace(/\r\n/g, "\n");
      expect(migration.sql).toBe(file);
      expect(migrationChecksum(migration.sql)).toBe(migrationChecksum(file));
    },
  );

  it("only adds a column, never changes or removes anything", () => {
    for (const migration of posMigrations) {
      const statements = migration.sql
        .split("\n")
        .filter((line) => line.trim() && !line.trim().startsWith("--"))
        .join("\n");
      expect(statements).toMatch(/^(ALTER TABLE pos_invoices ADD COLUMN IF NOT EXISTS [^\n]+ DEFAULT [^\n]+\n?)+$/);
    }
  });

  it("needs the Owner and the OK from inside the preview", async () => {
    const actions = await readFile("app/admin/settings/actions.ts", "utf8");
    const action = actions.slice(actions.indexOf("export async function preparePosDatabaseAction"));
    expect(action).toContain('await requireAdminPermission("settings:write")');
    expect(action).toContain('textValue(formData, "confirm") !== "yes"');
    const page = await readFile("app/admin/settings/page.tsx", "utf8");
    expect(page).toContain("posDatabase && !posDatabase.ready");
    expect(page).toContain("<form action={preparePosDatabaseAction}");
  });

  it("refuses to save a bill in parts before the column exists", async () => {
    const store = await readFile("lib/pos-postgres.ts", "utf8");
    const insert = store.slice(store.indexOf("async function insertPosInvoiceRow"));
    expect(insert).toContain("if (parts.length > 0 && !withPayments)");
    expect(insert).toContain("throw new Error(");
  });

  it("posts both bills of an exchange in one transaction", async () => {
    const store = await readFile("lib/pos-postgres.ts", "utf8");
    const exchange = store.slice(store.indexOf("export async function createPosExchangePostgres"));
    expect(exchange).toContain('transactionPostgres("pos invoices", async (db)');
    expect(exchange).toContain("returnInvoice: await postPosInvoice(db, returned)");
    expect(exchange).toContain("saleInvoice: await postPosInvoice(db, sold)");
  });
});
