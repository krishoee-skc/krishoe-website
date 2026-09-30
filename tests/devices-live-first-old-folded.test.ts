import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Login devices listed every login ever made in one list — fifteen live ones
 * lost among thirty-odd logged out and expired (owner, 2026-09-30). The live
 * ones come first, this device at the top; the ended ones fold away, kept as
 * the record rather than deleted.
 */
describe("login devices", () => {
  it("lists the devices still signed in first, this one at the top", async () => {
    const page = await read("app/admin/devices/page.tsx");
    expect(page).toContain("{liveSessions.map((entry) => {");
    expect(page).toContain("Number(right.id === session.sessionId) - Number(left.id === session.sessionId)");
  });

  it("folds the ended ones away, deleting nothing", async () => {
    const page = await read("app/admin/devices/page.tsx");
    expect(page).toContain("const endedSessions = sessions.filter((entry) => !entry.active);");
    expect(page).toContain('<details className="mt-6 rounded-2xl');
    expect(page).toContain("पुराना login (${endedSessions.length})");
    expect(page).not.toMatch(/DELETE FROM admin_staff_sessions/);
  });
});
