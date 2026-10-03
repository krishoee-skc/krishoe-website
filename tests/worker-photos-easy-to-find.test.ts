import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { adminNavGroups } from "@/app/admin/nav-links";
import { factoryLinks } from "@/app/admin/factory/_components/factory-nav";
import { photoLine, requestLine, workerInboxPush } from "@/lib/worker-inbox-alert";

const read = (file: string) => readFile(file, "utf8");

/**
 * Owner, 2026-10-03: two photos came from Ranjita and the screen to check them
 * was three presses deep. It is on the menu now with how many wait, on the
 * factory row and board, and the admin phones are told when one arrives.
 */
describe("workers' photos are easy to find", () => {
  it("sits in the menu under Factory today, with a count", async () => {
    const work = adminNavGroups.find((group) => group.id === "factory-work");
    expect(work?.links[1]?.href).toBe("/admin/factory/photos");
    const layout = await read("app/admin/layout.tsx");
    expect(layout).toContain('canAccessAdminPath(adminRole, "/admin/factory/photos")');
    expect(layout).toContain("counts={counts}");
    expect(await read("app/admin/AdminNav.tsx")).toContain("const waiting = counts?.[href] ?? 0;");
    expect(await read("app/admin/AdminMobileNav.tsx")).toContain("const waiting = counts?.[href] ?? 0;");
  });

  it("is on the factory row and the factory board", async () => {
    expect(factoryLinks.some((link) => link.href === "/admin/factory/photos")).toBe(true);
    expect(await read("app/admin/factory/layout.tsx")).toContain("<FactoryNav waiting={inbox.photos + inbox.requests} />");
    expect(await read("app/admin/factory/FactoryBoard.tsx")).toContain('href="/admin/factory/photos"');
  });

  it("tells the admin phones, one line per kind that says how many wait", async () => {
    expect(photoLine("✅", "काम सकियो", 60)).toBe("✅ काम सकियो · 60 जोडी");
    expect(requestLine(2000, "")).toBe("पेस्की Rs. 2000");
    const push = workerInboxPush("photo", "ranjita lamichhane", photoLine("✅", "काम सकियो", 60), { photos: 2, requests: 0 });
    expect(push.title).toBe("📷 ranjita lamichhaneको कामको फोटो");
    expect(push.body).toBe("✅ काम सकियो · 60 जोडी\nजाँच्न बाँकी: 2 फोटो, 0 कुरा");
    expect(push.url).toBe("/admin/factory/photos");
    expect(push.tag).toBe("worker-inbox-photo");
    expect(await read("app/api/worker/photos/route.ts")).toContain('await tellOwnerWorkerSent("photo"');
    expect(await read("app/worker/ask/actions.ts")).toContain('await tellOwnerWorkerSent("request"');
  });

  it("says on the card what a half-told photo is missing, and lets it be called not work", async () => {
    const inbox = await read("app/admin/factory/photos/WorkerInbox.tsx");
    expect(inbox).toContain('text("No shoe · no pairs", "जुत्ता र जोडी छैन")');
    expect(inbox).toContain("change(photo, { work: false });");
  });
});
