import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Neon puts an idle database to sleep and bills every wake-up for at least five
 * minutes of compute. The old database ran out of its quota, and three things
 * that were not orders were keeping it awake: the uptime checker, the speed
 * chart, and the error log. These pin the three changes that let it sleep.
 */

const queryPostgres = vi.fn();

vi.mock("@/lib/postgres/client", () => ({
  queryPostgres: (...args: unknown[]) => queryPostgres(...args),
}));
vi.mock("@/lib/data-backend", () => ({ getDataBackend: () => "postgres" }));

beforeEach(() => {
  vi.resetModules();
  queryPostgres.mockReset().mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("1. the uptime checker", () => {
  it("files nothing on an ordinary run when the shop is up", async () => {
    const probe = await readFile("scripts/uptime-probe.mjs", "utf8");
    expect(probe).toContain('if (reading.status === "up" && !DEEP && !AFTER_FAILURE)');
    expect(probe).toContain('url.searchParams.set("deep", "1")');
    expect(probe).toContain("const DEEP_HOURS_UTC = new Set([4, 8, 12]);");
  });

  it("ends a down run red, so the next run records the recovery", async () => {
    const probe = await readFile("scripts/uptime-probe.mjs", "utf8");
    const workflow = await readFile(".github/workflows/uptime.yml", "utf8");
    expect(probe).toContain('return reading.status === "down" ? 1 : 0;');
    expect(workflow).toContain("gh run list --workflow uptime.yml --status completed --limit 1");
    expect(workflow).toContain("LAST_CHECK_FAILED: ${{ steps.last.outputs.conclusion == 'failure' }}");
    expect(workflow).toContain("actions: read");
  });

  it("weighs each reading by how long it stood, so fewer ups do not inflate the downs", async () => {
    const monitoring = await readFile("lib/monitoring.ts", "utf8");
    expect(monitoring).toContain("LEAD(checked_at, 1, now()) OVER (ORDER BY checked_at)");
    expect(monitoring).toContain("checked_at + INTERVAL '8 hours'");
    expect(monitoring.match(/WEIGHTED_UPTIME_SQL, \[/g)).toHaveLength(2);
  });
});

describe("2. the speed chart", () => {
  it("measures one visit in ten and sends its vitals together", async () => {
    const reporter = await readFile("components/SpeedReporter.tsx", "utf8");
    expect(reporter).toContain("const SAMPLE_RATE = 0.1;");
    expect(reporter).toContain("if (!SAMPLED || !REPORTED.has(metric.name)) return;");
    expect(reporter).toContain("JSON.stringify({ metrics: queue.splice(0, queue.length) })");
  });

  it("writes a page's vitals in one statement", async () => {
    const { POST } = await import("@/app/api/monitoring/vitals/route");
    const response = await POST(
      new NextRequest("https://krishoe.test/api/monitoring/vitals", {
        method: "POST",
        body: JSON.stringify({
          metrics: [
            { metric: "LCP", value: 2100, path: "/", rating: "good" },
            { metric: "TTFB", value: 300, path: "/", rating: "good" },
            { metric: "CLS", value: 20, path: "/", rating: "good" },
            { metric: "BOGUS", value: 1, path: "/", rating: "good" },
            { metric: "FCP", value: 900, path: "https://evil.example/", rating: "good" },
          ],
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(queryPostgres).toHaveBeenCalledTimes(1);
    const [, sql, values] = queryPostgres.mock.calls[0] as [string, string, unknown[]];
    expect(sql).toContain("INSERT INTO monitoring_performance");
    // Three good vitals, seven values each; the made-up metric and the foreign
    // address were dropped.
    expect(values).toHaveLength(21);
  });

  it("does not wake the database for a post with nothing valid in it", async () => {
    const { POST } = await import("@/app/api/monitoring/vitals/route");
    await POST(
      new NextRequest("https://krishoe.test/api/monitoring/vitals", {
        method: "POST",
        body: JSON.stringify({ metrics: [{ metric: "BOGUS", value: 1, path: "/" }] }),
      }),
    );
    expect(queryPostgres).not.toHaveBeenCalled();
  });

  it("still accepts one vital in the old shape, from a tab opened before the deploy", async () => {
    const { POST } = await import("@/app/api/monitoring/vitals/route");
    await POST(
      new NextRequest("https://krishoe.test/api/monitoring/vitals", {
        method: "POST",
        body: JSON.stringify({ metric: "LCP", value: 1800, path: "/shop", rating: "good" }),
      }),
    );
    expect(queryPostgres).toHaveBeenCalledTimes(1);
  });
});

describe("3. the error log", () => {
  it("writes the same failure once in ten minutes, not once per visitor", async () => {
    const { logError } = await import("@/lib/monitoring");
    for (let visit = 0; visit < 5; visit += 1) {
      await logError({ level: "error", message: "load promo failed: missing setting" });
    }
    expect(queryPostgres).toHaveBeenCalledTimes(1);
  });

  it("still writes a different failure", async () => {
    const { logError } = await import("@/lib/monitoring");
    await logError({ level: "error", message: "load promo failed: missing setting" });
    await logError({ level: "error", message: "send email failed: provider refused" });
    expect(queryPostgres).toHaveBeenCalledTimes(2);
  });

  it("tries again after a write that did not land", async () => {
    queryPostgres.mockRejectedValueOnce(new Error("statement timeout")).mockResolvedValue([]);
    const { logError } = await import("@/lib/monitoring");
    await logError({ level: "error", message: "save order failed: x" });
    await logError({ level: "error", message: "save order failed: x" });
    expect(queryPostgres).toHaveBeenCalledTimes(2);
  });

  it("does not ask a database that is out of quota to write down that it is out of quota", async () => {
    const { logError } = await import("@/lib/monitoring");
    const quota = Object.assign(new Error("Your account or project has exceeded the quota."), { code: "53000" });
    await logError({ level: "error", message: "load catalog failed" }, quota);
    // …and pauses, so the next report in the same minute does not try either.
    await logError({ level: "error", message: "something else failed" });
    expect(queryPostgres).not.toHaveBeenCalled();
  });

  it("is handed the thrown value by reportError", async () => {
    const reportErrorSource = await readFile("lib/report-error.ts", "utf8");
    expect(reportErrorSource).toMatch(/logError\(\s*\{[\s\S]*?\},\s*\/\/[^\n]*\n\s*error,\s*\)/);
  });
});
