import { beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => ({ put: vi.fn(), list: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => blob);
vi.mock("@/lib/backup", () => ({
  buildAdminBackup: vi.fn(async () => ({ source: "KRISHOE admin backup", containsSensitiveData: true })),
}));

const { openBackup, runScheduledBackup } = await import("@/lib/scheduled-backup");

const KEY = Buffer.alloc(32, 7);
const day = 24 * 60 * 60 * 1000;
const stored = (ageDays: number, n: number) => ({
  url: `https://store.example/backups/b${n}.krbk`,
  downloadUrl: "",
  pathname: `backups/b${n}.krbk`,
  size: 1000,
  uploadedAt: new Date(Date.now() - ageDays * day),
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BACKUP_ENCRYPTION_KEY = KEY.toString("base64");
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  blob.put.mockResolvedValue({ pathname: "backups/new.krbk" });
});

describe("the weekly backup in the file store", () => {
  it("does nothing when last week's copy is recent", async () => {
    blob.list.mockResolvedValue({ blobs: [stored(2, 1)] });
    const run = await runScheduledBackup();
    expect(run.outcome).toBe("skipped");
    expect(blob.put).not.toHaveBeenCalled();
  });

  it("saves a locked copy when a week has passed, under backups/ with a random name", async () => {
    blob.list.mockResolvedValue({ blobs: [stored(7, 1)] });
    const run = await runScheduledBackup();
    expect(run.outcome).toBe("ok");
    const [pathname, body, options] = blob.put.mock.calls[0];
    expect(pathname).toMatch(/^backups\/krishoe-backup-\d{4}-\d{2}-\d{2}\.krbk$/);
    expect(options).toMatchObject({ addRandomSuffix: true });
    expect((body as Buffer).toString("utf8")).not.toContain("KRISHOE admin backup");
    expect(JSON.parse(openBackup(body as Buffer, KEY)).source).toBe("KRISHOE admin backup");
  });

  it("keeps the newest eight and deletes the rest", async () => {
    blob.list.mockResolvedValue({ blobs: Array.from({ length: 9 }, (_, i) => stored(7 + i * 7, i)) });
    await runScheduledBackup();
    // New one + 9 old = 10; the two oldest go.
    expect(blob.del).toHaveBeenCalledWith(["backups/b7.krbk", "backups/b8.krbk"]);
  });

  it("makes one now when the Owner asks, even if recent", async () => {
    blob.list.mockResolvedValue({ blobs: [stored(1, 1)] });
    expect((await runScheduledBackup({ force: true })).outcome).toBe("ok");
  });

  it("skips without a file store", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect((await runScheduledBackup()).outcome).toBe("skipped");
    expect(blob.list).not.toHaveBeenCalled();
  });
});
