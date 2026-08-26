import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * There is one way to change who can get into this shop, and it is guarded.
 *
 * There used to be two. `/api/admin/staff/status` accepted an Owner-signed POST
 * and claimed to disable a staff account — the thing you do the hour somebody
 * leaves, or the hour a login is stolen. It could not do it: it wrote to a
 * table called `admin_staff` (the table is `admin_staff_accounts`) and sent a
 * status of "inactive" (the column allows Active, Invited, Locked, Disabled).
 * Every call threw and came back "Failed to update staff status". Nothing in
 * the app called it, and nothing ever had.
 *
 * A second door to a security-critical action, wired to nothing and silently
 * broken, is worse than no second door: the day somebody found it and used it,
 * they would believe access had been revoked when it had not.
 *
 * The real path is updateStaffAccessAction on the settings screen. It requires
 * settings:write, it reads the account it is about to change, and it refuses to
 * demote the last active Owner — none of which the deleted endpoint did.
 */

const SETTINGS_ACTIONS = "app/admin/settings/actions.ts";

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(entry)) out.push(path.split("\\").join("/"));
  }
  return out;
}

/** Backtick strings that carry SQL. "UPDATE" is not always SQL. */
function sqlStrings(source: string) {
  return [...source.matchAll(/`([^`]*)`/g)]
    .map((m) => m[1])
    .filter((text) => /\b(SELECT|INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM)\b/i.test(text));
}

describe("one door to staff access", () => {
  const files = ["app", "lib", "components"].flatMap((dir) => sourceFiles(dir));

  it("has no second endpoint that writes a staff account's status", () => {
    const writers = files
      .filter((file) => file !== SETTINGS_ACTIONS && !file.includes("/settings/"))
      .filter((file) =>
        sqlStrings(readFileSync(file, "utf8")).some((sql) =>
          /UPDATE\s+"?admin_staff/i.test(sql),
        ),
      );

    expect(
      writers,
      "Only the settings action may write a staff account. These also do:\n" +
        writers.join("\n"),
    ).toEqual([]);
  });

  it("never names a staff table that does not exist", () => {
    // The deleted endpoint said `admin_staff`. The table is
    // `admin_staff_accounts`, and a typo in a table name is a write that
    // silently never happens.
    const wrong = files.filter((file) =>
      sqlStrings(readFileSync(file, "utf8")).some((sql) =>
        /\b(?:FROM|INTO|UPDATE|JOIN)\s+admin_staff\b(?!_)/i.test(sql),
      ),
    );

    expect(wrong, `admin_staff is not a table:\n${wrong.join("\n")}`).toEqual([]);
  });

  it("keeps the real path behind a permission, and behind the last-Owner rule", async () => {
    const source = readFileSync(SETTINGS_ACTIONS, "utf8");
    const action = source.slice(source.indexOf("export async function updateStaffAccessAction"));

    // Not any signed-in admin: the permission that gates the settings screen.
    expect(action).toContain('requireAdminPermission("settings:write")');

    // A shop with no Owner left is a shop nobody can administer. The rule that
    // prevents it is the reason this action, and not a second endpoint, is the
    // only way in.
    expect(action).toContain("activeOwners");
    expect(action).toContain("Create another active Owner");
  });

  it("writes a status the column will actually accept", () => {
    // admin_staff_accounts.status is CHECKed against these four. The deleted
    // endpoint sent "active"/"inactive" in lower case, which the constraint
    // would have refused even had the table name been right.
    const schema = readFileSync("docs/schema.sql", "utf8");
    const block = schema.slice(
      schema.indexOf("CREATE TABLE IF NOT EXISTS admin_staff_accounts"),
    );
    const statusCheck = block.slice(0, block.indexOf(");"));

    for (const status of ["Active", "Invited", "Locked", "Disabled"]) {
      expect(statusCheck, `status allows ${status}`).toContain(`'${status}'`);
    }
  });
});
