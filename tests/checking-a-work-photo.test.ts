import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { workerPortalMigrations } from "@/lib/worker-portal-db";

const read = (file: string) => readFile(file, "utf8");

/**
 * Owner, 2026-10-03: a photo came in and could only be marked "Seen". Now it is
 * checked — work or not, which work, the shoe, pairs, day, damage — put on the
 * books or taken back, and the worker is told.
 */
describe("checking a worker's photo", () => {
  it("adds the review columns, and only adds", () => {
    const review = workerPortalMigrations.find((migration) => migration.name === "20261003_factory_worker_photos_review");
    for (const column of ["verdict", "reply", "hidden", "stage", "work_date", "reject_pairs", "history"]) {
      expect(review?.sql, column).toContain(`ADD COLUMN IF NOT EXISTS ${column} `);
    }
  });

  it("can book a photo already marked seen, and keeps a line of history for each change", async () => {
    const actions = await read("app/admin/factory/photos/actions.ts");
    expect(actions).toContain('if (photo.status === "added") return { ok: false, en: "Already on the books."');
    expect(actions).not.toContain('photo.status !== "new"');
    const lib = await read("lib/worker-portal.ts");
    expect(lib).toContain("history = history || $");
  });

  it("marks not work with the reason the worker reads", async () => {
    const actions = await read("app/admin/factory/photos/actions.ts");
    expect(actions).toContain('{ verdict: "not_work", status: "seen", reply }');
    const worker = await read("app/worker/photos/page.tsx");
    expect(worker).toContain("✖ मिलेन");
  });

  // Taken back, not deleted: proof of a wage stays (owner, 2026-10-21).
  it("takes work back the way the piece ledger does — kept, reversed, owner only, never a paid month", async () => {
    const actions = await read("app/admin/factory/photos/actions.ts");
    expect(actions).toContain("await reverseFactoryWork({ workId: photo.workId,");
    expect(actions).not.toContain("deleteFactoryWork");
    // Booked again after a take-back, it goes in with the next key.
    expect(actions).toContain("const submissionKey = await photoWorkKey(photoKey);");
    const lib = await read("lib/worker-portal.ts");
    expect(lib).toContain("return takenBack > 0 ? `${submissionKey}:again-${takenBack}` : submissionKey;");
    expect(lib).toContain("WHERE ${PHOTO_KEYS_SQL} AND status <> 'reversed'");
    expect(actions.slice(actions.indexOf("export async function takeBackPhotoWorkAction"))).toContain('requireAdminPermission("wages:write")');
  });

  it("deletes only a photo that is neither on the books nor a problem; those are hidden", async () => {
    const lib = await read("lib/worker-portal.ts");
    expect(lib).toContain("DELETE FROM factory_worker_photos WHERE id = $1 AND status <> 'added'");
    const actions = await read("app/admin/factory/photos/actions.ts");
    const remove = actions.slice(actions.indexOf("export async function deletePhotoAction"));
    expect(remove).toContain('requireAdminPermission("wages:write")');
    expect(remove).toContain('if (photo.kind === "problem")');
    expect(remove).toContain("await del(url)");
  });

  it("prices the draft from the same rate book Add work uses", async () => {
    const inbox = await read("app/admin/factory/photos/WorkerInbox.tsx");
    expect(inbox).toContain("return quoteWork(");
    expect(inbox).toContain("productionStageForFactoryCategory(draft.stage || photo.workerCategory)");
  });
});
