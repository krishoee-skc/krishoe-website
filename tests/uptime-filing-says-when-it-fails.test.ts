import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The outside checker logged "filed — up" from 27 Sept while nothing reached
 * monitoring_uptime: the insert's failure was swallowed and the endpoint
 * answered 201 (owner, 2026-09-30). Now the failure is said, all the way out.
 */
const monitoring = vi.hoisted(() => ({
  lastUptimeReading: vi.fn(async () => ({ status: "up", downSince: null })),
  recordUptimeCheck: vi.fn(),
}));
vi.mock("@/lib/monitoring", () => monitoring);

import { POST } from "@/app/api/monitoring/uptime/route";

function filing() {
  return new Request("https://example.test/api/monitoring/uptime", {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify({ status: "up", responseTime: 400, statusCode: 200, region: "github-actions" }),
  });
}

describe("filing an outside reading", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("answers 500 with the database's reason when the reading was not written", async () => {
    vi.stubEnv("UPTIME_WRITE_TOKEN", "test-token");
    monitoring.recordUptimeCheck.mockResolvedValueOnce({ ok: false, error: "relation is read-only" });
    const response = await POST(filing());
    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("relation is read-only");
  });

  it("answers 201 when it was", async () => {
    vi.stubEnv("UPTIME_WRITE_TOKEN", "test-token");
    monitoring.recordUptimeCheck.mockResolvedValueOnce({ ok: true });
    const response = await POST(filing());
    expect(response.status).toBe(201);
  });

  it("logs the reason where the monitoring screen reads, and the checker prints it", async () => {
    const lib = await read("lib/monitoring.ts");
    expect(lib).toContain("message: `record uptime check failed: ${message}`,");
    const probe = await read("scripts/uptime-probe.mjs");
    expect(probe).toContain('throw new Error(`filing returned HTTP ${response.status}${said ? `: ${said.slice(0, 300)}` : ""}`);');
  });
});
