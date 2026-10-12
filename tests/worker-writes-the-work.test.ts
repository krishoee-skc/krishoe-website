import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { workerPortalMigrations } from "@/lib/worker-portal-db";

const read = (path: string) => readFile(path, "utf8");

/**
 * The worker writes the day's work themselves (owner, 2026-10-13, "क"): the
 * shoe, colour, size and pairs, with no photo. It waits for the owner's ✓ like
 * a photo does — the books change only then, through the same booking.
 */
describe("a worker writes the day's work", () => {
  it("adds two columns and nothing else", () => {
    const migration = workerPortalMigrations.find((entry) => entry.name === "20261013_factory_worker_photos_written");
    expect(migration?.table).toBe("factory_worker_photos");
    expect(migration?.sql).toContain("ADD COLUMN IF NOT EXISTS color TEXT");
    expect(migration?.sql).toContain("ADD COLUMN IF NOT EXISTS size TEXT");
    expect(migration?.sql.replace(/ALTER TABLE \w+ ADD COLUMN IF NOT EXISTS/g, "")).not.toMatch(/\b(DROP|ALTER|TRUNCATE|DELETE|UPDATE)\b/i);
  });

  it("takes it only from the worker's own sign-in, today or yesterday, and never books it itself", async () => {
    const actions = await read("app/worker/write/actions.ts");
    expect(actions).toContain("await getCurrentWorkerAccess()");
    expect(actions).toContain('worker.workerType !== "piece_rate"');
    expect(actions).toContain("isWorkerOnLeave(worker.id)");
    expect(actions).toContain('nepalDay(input.day === "yesterday" ? 1 : 0)');
    expect(actions).toContain("FROM factory_items WHERE id = $1 AND status = 'active'");
    // Pay is the owner's ✓ — the worker's side never writes to the books.
    expect(actions).not.toContain("createFactoryWork");
    expect(actions).not.toContain("factory_daily_work");
  });

  it("is stored as a photo row with no picture, kept out of the photo list and away from the robot", async () => {
    const portal = await read("lib/worker-portal.ts");
    expect(portal).toContain("VALUES ($1, $2, $3, 'done', $4, $5, '', $6, $7, $8, $9)");
    expect(portal).toContain("written: !row.image_url,");
    expect(portal).toContain("AND image_url <> ''");
    expect(await read("lib/worker-photo-robot.ts")).toContain("photo.written ||");
    expect(await read("app/worker/photos/page.tsx")).toContain("photos.filter((photo) => !photo.written)");
  });

  it("reaches the owner with the worker's own colour and size, booked by the same ✓", async () => {
    const inbox = await read("app/admin/factory/photos/WorkerInbox.tsx");
    expect(inbox).toContain("color: photo.color || history[itemId]?.color");
    expect(inbox).toContain("<WrittenFace");
    const booking = await read("app/admin/factory/photos/actions.ts");
    expect(booking).toContain("const submissionKey = `worker-photo:${photo.id}`;");
  });

  it("is the first button on the worker's home and a tab of its own", async () => {
    const home = await read("app/worker/dashboard/page.tsx");
    expect(home.indexOf('"/worker/write"')).toBeGreaterThan(-1);
    expect(home.indexOf('"/worker/write"')).toBeLessThan(home.indexOf('"/worker/photos"'));
    expect(await read("components/worker/WorkerChrome.tsx")).toContain('href: "/worker/write"');
  });
});

describe("the worker's own work, on a phone", () => {
  it("is cards a day at a time, not a table slid sideways", async () => {
    const page = await read("app/worker/production/page.tsx");
    expect(page).not.toContain("min-w-[560px]");
    expect(page).not.toContain("<table");
    expect(page).toContain("dayLabel(day.date)");
  });
});
