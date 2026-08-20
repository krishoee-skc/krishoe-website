import { beforeEach, describe, expect, it, vi } from "vitest";

const after = vi.fn();
const logError = vi.fn();

vi.mock("next/server", () => ({ after: (...args: unknown[]) => after(...args) }));
vi.mock("@/lib/monitoring", () => ({ logError: (...args: unknown[]) => logError(...args) }));

import { reportError, reportingErrors } from "@/lib/report-error";

beforeEach(() => {
  logError.mockReset().mockResolvedValue(undefined);
  after.mockReset().mockImplementation((run: () => unknown) => {
    // Runs it now, as the real one does, but without leaving the rejection of a
    // deliberately-failing logError floating past the end of the test.
    void Promise.resolve(run()).catch(() => {});
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/**
 * Thirty-nine call sites already said exactly what was being attempted, and
 * said it only to console.error — a runtime log on a host nobody in this shop
 * has signed into, which drops what it holds after a few days. A fault that ran
 * for a week was, in practice, recorded nowhere the owner could find it.
 */
describe("reporting a failure", () => {
  it("keeps it where the dashboard can read it", async () => {
    reportError("sync catalog stock after purchase PUR-12", new Error("timeout"));

    expect(logError).toHaveBeenCalledTimes(1);
    const [entry] = logError.mock.calls[0] as [Record<string, unknown>];
    expect(entry.level).toBe("error");
    expect(entry.context).toBe("sync catalog stock after purchase PUR-12");
    expect(entry.message).toContain("sync catalog stock after purchase PUR-12 failed");
    expect(entry.message).toContain("timeout");
  });

  it("still shouts to the console", () => {
    reportError("post bill INV-3", new Error("boom"));

    expect(console.error).toHaveBeenCalled();
  });

  it("puts a sentence in the message and the stack in the stack", () => {
    reportError("post bill INV-3", new Error("boom"));

    const [entry] = logError.mock.calls[0] as [{ message: string; stack?: string }];
    // A stack is not a sentence, and the dashboard renders this as one line.
    expect(entry.message).not.toContain("\n");
    expect(entry.stack).toContain("Error: boom");
  });

  it("schedules the write rather than making the shopper wait for it", () => {
    reportError("post bill INV-3", new Error("boom"));

    // The bill is already posted; the response should leave at its usual speed.
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("still records when there is no request to run after", () => {
    // A script, a test, a background job — outside a request there is nothing
    // for `after` to schedule into, and it throws rather than returning.
    after.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope");
    });

    expect(() => reportError("nightly digest", new Error("boom"))).not.toThrow();
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("does not let a failed write break the work that already committed", async () => {
    logError.mockRejectedValue(new Error("monitoring table is gone"));

    await expect(
      reportingErrors("post bill INV-3", async () => {
        throw new Error("boom");
      })
    ).resolves.toBeUndefined();
  });
});
