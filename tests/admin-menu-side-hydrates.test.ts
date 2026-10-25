import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hook = readFileSync("app/admin/useAdminWorkspace.ts", "utf8");

// React error #418 on Dashboard and Stock (owner, 2026-10-25): on a page of
// both sides, a browser that remembered "shop" drew the shop menu while
// hydrating the factory menu the server sent.
describe("the admin menu's side on a page of both sides", () => {
  it("is not read from localStorage inside the first render", () => {
    const body = hook.slice(hook.indexOf("export function useAdminWorkspace"));
    expect(body).not.toMatch(/useState<AdminWorkspace>\(\(\) =>/);
    expect(body).not.toContain("storedWorkspace() ??");
  });

  it("comes from the store that answers the server with factory", () => {
    expect(hook).toContain('() => (storedWorkspace() === "shop" ? "shop" : "factory"), () => "factory")');
    expect(hook).toContain("const remembered = useShownWorkspace();");
    expect(hook).toContain('const chosen: AdminWorkspace = decided ?? remembered;');
    // Only a decided side is written back, never the server's first guess.
    expect(hook).toContain('if (decided === null || decided === "both") return;');
  });
});

// The same error #418, its other cause: the service worker served the app's
// scripts cache-first, so they ran before the page's HTML had all arrived.
describe("the service worker and the app's own scripts", () => {
  it("leaves /_next/static to the browser's cache", () => {
    const worker = readFileSync("public/sw.js", "utf8");
    const fetchHandler = worker.slice(worker.indexOf('self.addEventListener("fetch"'));
    const leave = fetchHandler.indexOf('if (url.pathname.startsWith("/_next/static/")) return;');
    expect(leave).toBeGreaterThan(-1);
    // Before the cache-first branch, so a script never reaches it.
    expect(leave).toBeLessThan(fetchHandler.indexOf("caches.match(request)"));
  });
});

describe("the service worker and private pages", () => {
  it("lets the browser load admin, worker and account pages itself", () => {
    const worker = readFileSync("public/sw.js", "utf8");
    const privateBranch = worker.slice(worker.indexOf("if (isPrivatePath(url.pathname)) {"));
    expect(privateBranch.indexOf('if (request.mode === "navigate") return;')).toBeGreaterThan(-1);
    expect(privateBranch.indexOf('if (request.mode === "navigate") return;')).toBeLessThan(privateBranch.indexOf("event.respondWith("));
  });
});
