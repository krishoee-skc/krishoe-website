import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { workerPortalMigrations } from "@/lib/worker-portal-db";

const read = (file: string) => readFile(file, "utf8");

/**
 * Owner, 2026-10-02 ("ख"): a worker's photo, with the shoe and the pairs, is a
 * draft of the day's work; the owner's ✓ puts it on the books.
 */
describe("work from a worker's photo", () => {
  it("adds the two columns, and only adds", () => {
    const draft = workerPortalMigrations.find((migration) => migration.name === "20261002_factory_worker_photos_draft");
    expect(draft?.sql).toContain("ADD COLUMN IF NOT EXISTS item_id TEXT REFERENCES factory_items(id)");
    expect(draft?.sql).toContain("ADD COLUMN IF NOT EXISTS work_id TEXT");
  });

  it("books it the way Add work does, once, on the day it was sent", async () => {
    const actions = await read("app/admin/factory/photos/actions.ts");
    expect(actions).toContain("entry = await createFactoryWork({");
    // keyed to the photo: a second press, or two people at once, books it once
    expect(actions).toContain("submissionKey: `worker-photo:${photo.id}`");
    expect(actions).toContain("date: nepalDay(photo.createdAt)");
    // at the worker's own stage and its rate
    expect(actions).toContain("stage: null,");
    expect(actions).toContain('requireAdminPermission("production:entry")');
  });

  it("never books a problem photo, monthly staff, or the same photo twice", async () => {
    const actions = await read("app/admin/factory/photos/actions.ts");
    expect(actions).toContain('if (photo.kind === "problem")');
    expect(actions).toContain('if (photo.workerType !== "piece_rate")');
    expect(actions).toContain('if (photo.status === "added")');
  });

  it("lets the worker say which shoe, checked against the factory's own list", async () => {
    const route = await read("app/api/worker/photos/route.ts");
    expect(route).toContain("SELECT id FROM factory_items WHERE id = $1 AND status = 'active'");
    const form = await read("app/worker/photos/WorkerPhotoForm.tsx");
    expect(form).toContain("कुन जुत्ता?");
  });

  it("lets the owner correct the shoe and pairs before ✓, and ✓ them all at once", async () => {
    const inbox = await read("app/admin/factory/photos/WorkerInbox.tsx");
    expect(inbox).toContain("bookPhotoWorkAction(photo.id, draftOf(photo).itemId, Number(draftOf(photo).pairs))");
    expect(inbox).toContain("const bookAll = () =>");
  });
});
