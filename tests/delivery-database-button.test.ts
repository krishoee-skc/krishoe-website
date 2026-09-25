import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { deliveryMigrations, migrationChecksum } from "@/lib/delivery-database";

/**
 * The live database's address is Sensitive and cannot be read out, so the two
 * delivery migrations are run by the app itself from an Owner button. They
 * must be the migration files word for word, stamped the way the migration
 * script stamps them, and they must only ever add.
 */

describe("the Owner's database button for delivery", () => {
  it.each(deliveryMigrations.map((migration) => [migration.name, migration]))(
    "%s is the migration file, word for word",
    async (name, migration) => {
      const file = (await readFile(`scripts/migrations/${name}`, "utf8")).replace(/\r\n/g, "\n");
      expect(migration.sql).toBe(file);
      expect(migrationChecksum(migration.sql)).toBe(migrationChecksum(file));
    },
  );

  it("only adds columns, never changes or removes anything", () => {
    for (const migration of deliveryMigrations) {
      const statements = migration.sql
        .split("\n")
        .filter((line) => line.trim() && !line.trim().startsWith("--"))
        .join("\n");
      expect(statements).toMatch(/^(ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS [^\n]+\n?)+$/);
    }
  });

  it("stamps with the same fingerprint as the migration script", async () => {
    const script = await readFile("scripts/apply-postgres-schema.mjs", "utf8");
    expect(script).toContain('createHash("sha256").update(sql.replace(/\\r\\n/g, "\\n")).digest("hex")');
  });

  it("needs the Owner and the OK from inside the preview", async () => {
    const actions = await readFile("app/admin/settings/actions.ts", "utf8");
    const action = actions.slice(actions.indexOf("export async function prepareDeliveryDatabaseAction"));
    expect(action).toContain('await requireAdminPermission("settings:write")');
    expect(action).toContain('textValue(formData, "confirm") !== "yes"');
    const page = await readFile("app/admin/settings/page.tsx", "utf8");
    expect(page).toContain('<input type="hidden" name="confirm" value="yes" />');
    expect(page).toContain("deliveryDatabase && !deliveryDatabase.ready");
  });
});
