import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStreamingJsonResponse } from "@/lib/streaming-json-response";

const mocks = vi.hoisted(() => ({
  requireAdminPermission: vi.fn(),
  buildAdminBackup: vi.fn(),
  recordAdminAuditEvent: vi.fn(),
}));

vi.mock("@/lib/admin-permissions", () => ({
  requireAdminPermission: mocks.requireAdminPermission,
}));

vi.mock("@/lib/backup", () => ({
  buildAdminBackup: mocks.buildAdminBackup,
}));

vi.mock("@/lib/admin-audit", () => ({
  recordAdminAuditEvent: mocks.recordAdminAuditEvent,
}));

async function readStream(response: Response) {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("Expected a streamed response body.");
  }

  const decoder = new TextDecoder();
  let text = "";
  let chunks = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;
    chunks += 1;
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return { text, chunks };
}

describe("admin backup streaming response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPermission.mockResolvedValue(undefined);
    mocks.recordAdminAuditEvent.mockResolvedValue(undefined);
  });

  it("preserves Unicode when a surrogate pair lands on a chunk boundary", async () => {
    const chunkCharacters = 16;
    const jsonValuePrefixLength = '{"data":"'.length;
    const shoeEmoji = "\uD83D\uDC5F";
    const nepaliKrishna = "\u0915\u0943\u0937\u094D\u0923";
    const value = {
      data: `${"a".repeat(chunkCharacters - 1 - jsonValuePrefixLength)}${shoeEmoji} Nepali: ${nepaliKrishna}`,
    };
    const response = createStreamingJsonResponse(value, {}, chunkCharacters);
    const streamed = await readStream(response);

    expect(streamed.chunks).toBeGreaterThan(1);
    expect(JSON.parse(streamed.text)).toEqual(value);
  });

  it("streams a payload larger than Vercel's buffered response limit with download headers", async () => {
    const largeBackup = {
      schemaVersion: 15,
      source: "KRISHOE admin backup",
      data: {
        assets: {
          uploaded_images: [
            {
              id: "image-large",
              bytes: "A".repeat(5 * 1024 * 1024),
            },
          ],
        },
      },
    };
    mocks.buildAdminBackup.mockResolvedValue(largeBackup);
    const { GET } = await import("@/app/api/admin/backup/route");

    const response = await GET();
    const streamed = await readStream(response);

    expect(streamed.chunks).toBeGreaterThan(1);
    expect(JSON.parse(streamed.text)).toEqual(largeBackup);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="krishoe-backup-v15-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(response.headers.has("content-length")).toBe(false);
    expect(mocks.requireAdminPermission).toHaveBeenCalledWith("backup:export");
    expect(mocks.recordAdminAuditEvent).toHaveBeenCalledWith(
      "backup_export",
      "Admin backup schema v15 exported.",
    );
  });
});
