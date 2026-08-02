import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("staff security implementation contract", () => {
  it("stores only hashes for one-time staff secrets", () => {
    const migration = source("scripts/migrations/20260802_admin_access_v1.sql");
    expect(migration).toContain("token_hash");
    expect(migration).toContain("secret_hash");
    expect(migration).not.toMatch(/raw_token|raw_secret|plain_password/i);
  });

  it("revokes old sessions after password and sensitive account changes", () => {
    const accessActions = source("app/admin/access/actions.ts");
    const settingsActions = source("app/admin/settings/actions.ts");
    const adminAuth = source("lib/admin-auth.ts");
    const loginPage = source("app/(admin-auth)/admin/login/page.tsx");
    const proxy = source("proxy.ts");
    expect(accessActions).toContain("revokeAllAdminStaffSessions");
    expect(accessActions).toContain("password_reset_completed");
    expect(settingsActions).toContain("revokeSecuritySessions");
    expect(settingsActions).toContain('nextStatus === "Disabled" || nextStatus === "Locked"');
    expect(settingsActions).toContain("accessSecurityChanged");
    expect(settingsActions).toContain('"mfa-change"');
    expect(adminAuth).toContain("session.staffId && !session.sessionId");
    expect(loginPage).toContain("await getAdminSession()");
    expect(proxy).not.toContain("isAdminAuthPage(pathname) && hasValidSession");
  });

  it("enforces database branch isolation and branch-scoped stock", () => {
    const migration = source("scripts/migrations/20260802_branch_access_v1.sql");
    const postgresClient = source("lib/postgres/client.ts");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("krishoe_can_access_branch");
    expect(migration).toContain("branch_product_stock");
    expect(migration).toContain("pos_invoices");
    expect(migration).toContain("purchase_invoices");
    expect(migration).toContain("production_work_orders");
    expect(postgresClient).toContain("app.krishoe_branch_id");
    expect(postgresClient).toContain("configureAdminBranchContext");
  });

  it("records safe before/after access history and emails owner alerts", () => {
    const settingsActions = source("app/admin/settings/actions.ts");
    expect(settingsActions).toContain("beforeState");
    expect(settingsActions).toContain("afterState");
    expect(settingsActions).toContain("sendOwnerSecurityAlert");
    expect(settingsActions).not.toMatch(/payload:\s*\{[^}]*\bpassword\s*:/);
  });
});
