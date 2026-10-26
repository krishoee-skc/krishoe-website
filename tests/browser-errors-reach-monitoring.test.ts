import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clientErrorFrom } from "@/lib/client-error-report";

const origin = "https://www.krishoe.com";
const read = (path: string) => readFileSync(path, "utf8");

// Owner, 2026-10-26 (security phase 2): React's #418 on Dashboard and Stock
// happened in the browser and never reached Monitoring.
describe("an error from a visitor's browser", () => {
  it("is kept when it comes from our page and our script", () => {
    expect(
      clientErrorFrom(
        {
          kind: "error",
          message: "Minified React error #418",
          path: "/admin/stock?tab=move",
          source: "https://www.krishoe.com/_next/static/chunks/app.js",
          line: 12,
          column: 34,
        },
        origin,
      ),
    ).toEqual({
      kind: "error",
      message: "Minified React error #418",
      path: "/admin/stock",
      where: "/_next/static/chunks/app.js:12:34",
    });
  });

  it("keeps a failed promise too", () => {
    expect(clientErrorFrom({ kind: "rejection", message: "boom", path: "/shop" }, origin)?.kind).toBe("rejection");
  });

  it("drops what every site's browsers report and nobody can fix", () => {
    for (const message of ["Script error.", "ResizeObserver loop limit exceeded", "Failed to fetch", "Load failed", "AbortError: aborted"]) {
      expect(clientErrorFrom({ message, path: "/" }, origin), message).toBeNull();
    }
  });

  it("drops an extension's error and another site's script", () => {
    expect(clientErrorFrom({ message: "x is undefined", path: "/", stack: "at chrome-extension://abc/content.js:1" }, origin)).toBeNull();
    expect(clientErrorFrom({ message: "x is undefined", path: "/", source: "https://ads.example.com/a.js" }, origin)).toBeNull();
  });

  it("never stores someone else's address or a payload as the page", () => {
    expect(clientErrorFrom({ message: "x", path: "https://evil.example/" }, origin)).toBeNull();
    expect(clientErrorFrom({ message: "x", path: "//evil.example/" }, origin)).toBeNull();
    expect(clientErrorFrom({ message: "", path: "/" }, origin)).toBeNull();
  });

  it("clamps what it keeps", () => {
    const kept = clientErrorFrom({ message: "y".repeat(5000), path: "/" + "p".repeat(900), stack: "s".repeat(9000) }, origin);
    expect(kept?.message.length).toBe(300);
    expect(kept?.path.length).toBeLessThanOrEqual(300);
    expect(kept?.stack?.length).toBe(1500);
  });
});

describe("the wiring", () => {
  it("reports from every page, quietly", () => {
    const reporter = read("components/ClientErrorReporter.tsx");
    expect(read("app/layout.tsx")).toContain("<ClientErrorReporter />");
    expect(reporter).toContain('process.env.NODE_ENV !== "production"');
    expect(reporter).toContain("const MAX_PER_PAGE_LOAD = 5;");
    expect(reporter).toContain("navigator.sendBeacon");
    expect(reporter).toContain('addEventListener("unhandledrejection"');
  });

  it("writes through logError, capped per minute, and not at all without a database", () => {
    const route = read("app/api/monitoring/client-error/route.ts");
    expect(route).toContain("const WRITES_PER_MINUTE = 30;");
    expect(route).toContain('process.env.DATA_BACKEND === "local-json"');
    expect(route).toContain('context: "Browser"');
    expect(route).toContain("clientErrorFrom(JSON.parse(raw), request.nextUrl.origin)");
  });
});
