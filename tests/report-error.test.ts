import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportError, reportingErrors } from "@/lib/report-error";

let logged: string[] = [];

beforeEach(() => {
  logged = [];
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    logged.push(line);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reportingErrors", () => {
  it("returns the value when the work succeeds", async () => {
    const result = await reportingErrors("do the thing", () => Promise.resolve(42));

    expect(result).toBe(42);
    expect(logged).toHaveLength(0);
  });

  it("swallows the failure so the caller can carry on", async () => {
    const result = await reportingErrors("do the thing", () =>
      Promise.reject(new Error("network down")),
    );

    // The whole point: the caller's work already committed and must not be
    // undone by a failure in the step after it.
    expect(result).toBeUndefined();
  });

  it("says what failed and why", async () => {
    await reportingErrors("notify admin of order KRS-1", () =>
      Promise.reject(new Error("network down")),
    );

    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("notify admin of order KRS-1");
    expect(logged[0]).toContain("network down");
  });

  it("reports a synchronous throw too", async () => {
    const result = await reportingErrors("do the thing", () => {
      throw new Error("bad input");
    });

    expect(result).toBeUndefined();
    expect(logged[0]).toContain("bad input");
  });
});

describe("reportError", () => {
  it("keeps a stack when there is one", () => {
    reportError("save order", new Error("boom"));

    expect(logged[0]).toContain("save order");
    expect(logged[0]).toContain("boom");
    expect(logged[0]).toContain("report-error.test.ts");
  });

  it("handles something thrown that is not an Error", () => {
    reportError("save order", "just a string");

    expect(logged[0]).toContain("save order");
    expect(logged[0]).toContain("just a string");
  });

  it("handles a thrown object", () => {
    reportError("save order", { code: "ECONNRESET" });

    expect(logged[0]).toContain("ECONNRESET");
  });

  it("is greppable in a shared log", () => {
    reportError("save order", new Error("boom"));

    // Vercel's runtime log carries every request for every project. Without a
    // fixed marker there is no way to pull out only this app's failures.
    expect(logged[0].startsWith("[krishoe] ")).toBe(true);
  });
});
