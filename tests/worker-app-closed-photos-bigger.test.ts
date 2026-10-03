import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { workerPortalMigrations } from "@/lib/worker-portal-db";
import { isPhotoKind, PHOTO_KINDS, PHOTOS_PER_DAY } from "@/lib/worker-portal";

const read = (file: string) => readFile(file, "utf8");

/** Owner, 2026-10-02: a worker who left cannot get in; photos of work; bigger and easier. */
describe("a worker who has left cannot get back in", () => {
  it("closing a worker switches their app off and signs their phones out", async () => {
    const route = await read("app/api/factory/workers/route.ts");
    expect(route).toContain('if (status === "inactive" && current[0].status !== "inactive") {');
    expect(route).toContain("appLocked = await lockWorkerApp(workerId,");
    const lock = await read("lib/worker-app-lock.ts");
    expect(lock).toContain('await saveAdminStaffAccount({ id: account.id, status: "Disabled" });');
    expect(lock).toContain("revokeAllAdminStaffSessions(account.id");
  });

  it("tells them the account is closed — only with their own right password", async () => {
    const login = await read("app/admin/login/actions.ts");
    expect(login).toContain("if (!staff && (await isClosedWorkerSignIn(email, password))) {");
    const lock = await read("lib/worker-app-lock.ts");
    expect(lock).toContain('match.role === "Worker" && match.status === "Disabled"');
    expect(await read("components/worker/WorkerPortalUnavailable.tsx")).toContain("तपाईंको खाता बन्द छ");
  });

  it("asks first, with what is still owed, and keeps their records", async () => {
    const team = await read("app/admin/factory/workers/TeamList.tsx");
    expect(team).toContain("window.confirm(");
    expect(team).toContain("balances[worker.id]");
    expect(team).toContain("बन्द गर्ने");
    expect(team).toContain("फेरि चालु गर्ने");
  });

  it("opens again only through a new code, once they are active", async () => {
    const actions = await read("app/admin/factory/workers/actions.ts");
    expect(actions).toContain('if (!worker || worker.status !== "active") {');
    expect(actions).toContain('await saveAdminStaffAccount({ id: staff.id, status: "Active" });');
  });
});

describe("photos, questions and leave", () => {
  it("adds three tables and touches nothing else", () => {
    expect(workerPortalMigrations.map((migration) => migration.table)).toEqual(["factory_worker_photos", "factory_worker_requests", "factory_worker_leave", "factory_worker_photos", "factory_worker_photos", "factory_worker_photos"]);
    for (const migration of workerPortalMigrations) {
      // Nothing removed or changed; "ON DELETE RESTRICT" is a guard that keeps rows,
      // and the one ALTER allowed is adding a column that is not there.
      const withoutAddColumn = migration.sql.replace(/ALTER TABLE \w+ ADD COLUMN IF NOT EXISTS/g, "");
      expect(withoutAddColumn).not.toMatch(/\b(DROP|ALTER|TRUNCATE)\b|^\s*(DELETE|UPDATE)\b/im);
    }
  });

  it("takes a worker's photo only from their own sign-in, a few a day, and never changes the books itself", async () => {
    expect(PHOTO_KINDS.map((kind) => kind.value)).toEqual(["done", "upper", "ready", "problem"]);
    expect(isPhotoKind("problem")).toBe(true);
    expect(isPhotoKind("salary")).toBe(false);
    expect(PHOTOS_PER_DAY).toBe(10);
    const route = await read("app/api/worker/photos/route.ts");
    expect(route).toContain("await getCurrentWorkerAccess()");
    expect(route).toContain("isWorkerOnLeave(worker.id)");
    expect(route).not.toContain("factory_daily_work");
  });

  it("lets the owner answer questions and advances without moving money", async () => {
    const actions = await read("app/admin/factory/photos/actions.ts");
    expect(actions).toContain('requireAdminPermission("wages:write")');
    expect(actions).not.toContain("factory_worker_ledger");
  });
});

describe("the worker app is bigger and easier", () => {
  it("scales its text, and has four big tabs", async () => {
    const chrome = await read("components/worker/WorkerChrome.tsx");
    expect(chrome).toContain('const SIZES = ["112.5%", "125%", "140%"] as const;');
    expect(chrome).toContain('{ href: "/worker/photos", icon: "📷", ne: "फोटो", en: "Photo" }');
    const home = await read("app/worker/dashboard/page.tsx");
    expect(home).toContain("आज · Today");
    expect(home).toContain("तलब पठाइयो");
    expect(home).toContain('"हिसाब मिलेन? भन्ने"');
  });
});
