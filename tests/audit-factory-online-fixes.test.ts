import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { POS_ANSWER_FIELD } from "@/lib/pos-questions";
import { heldKey } from "@/lib/pos-held-pairs";
import { readPosScreen } from "./helpers/pos-screen";

/**
 * The bug audit, phases 3 (factory) and 5 (online), owner 2026-10-28
 * ("garau"): found by browser checks on a local test database.
 */
const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const WORK = "app/admin/factory/add-work/WorkEntryForm.tsx";

describe("KR-BUG-011: a work entry pressed twice is one wage", () => {
  it("does not send an entry that is already on its way", async () => {
    const form = await read(WORK);
    expect(form).toContain("const inFlight = useRef(new Set<string>());");
    expect(form).toContain("if (inFlight.current.has(keyScope)) return;\n    inFlight.current.add(keyScope);\n    const key = idempotencyKeys.get(keyScope);");
    expect(form).toContain("inFlight.current.delete(keyScope);\n      setSubmitting(false);");
  });
});

describe("KR-BUG-010: a new shoe with no worker chosen does not trap the counter", () => {
  it("asks the rate only once a worker is chosen", async () => {
    const form = await read(WORK);
    expect(form).toContain("if (workers.some((worker) => worker.id === formData.worker_id)) {");
    expect(form).toContain("Choose the worker — the rate is asked then.");
  });

  it("says inside the rate box why Set Rate did nothing", async () => {
    const dialogs = await read("app/admin/factory/add-work/WorkEntryDialogs.tsx");
    expect(dialogs).toContain('<p role="alert" className="mb-4 rounded-lg bg-brand-clay-tint');
    expect(await read(WORK)).toContain("onSet={handleSetRate}\n          error={error}");
  });
});

describe("KR-BUG-009: one main landmark on a page", () => {
  it("leaves <main> to the admin layout", async () => {
    for (const path of [
      "app/admin/factory/layout.tsx",
      "app/admin/factory/worker-portal-qr/page.tsx",
      "app/admin/change-password/page.tsx",
      "app/admin/error.tsx",
    ]) {
      expect(await read(path), path).not.toMatch(/<main\b/);
    }
    expect(await read("app/admin/layout.tsx")).toContain('<main className="admin-canvas');
  });
});

describe("KR-BUG-014: the counter asks before selling pairs held for an online order", () => {
  it("counts the website's own hold rule, by shoe and size", async () => {
    const helper = await read("lib/pos-held-pairs.ts");
    expect(helper).toContain("o.status = 'Contacted'");
    expect(helper).toContain("o.status = 'New' AND o.created_at > now() - make_interval(hours => $2::int)");
    expect(heldKey(" Test Sandal ", "38")).toBe("test sandal::38");
  });

  it("asks on a shop or wholesale bill, not on the order's own online bill", async () => {
    const pos = await read("lib/pos.ts");
    expect(pos).toContain('if (input.channel !== "Online" && !input.answerHeldForOrder) {');
    expect(pos).toContain('"heldForOrder",');
    expect(pos).toContain("return line.pairs > free ? [{ ...line, hold, free }] : [];");
  });

  it("carries the counter's yes", async () => {
    expect(POS_ANSWER_FIELD.heldForOrder).toBe("answerHeldForOrder");
    expect(await read("app/admin/pos/actions.ts")).toContain('answerHeldForOrder: textValue(formData, POS_ANSWER_FIELD.heldForOrder) === "yes",');
    expect(await readPosScreen()).toContain('text("Yes, sell them anyway", "हो, जे भए पनि बेच्ने")');
  });
});

describe("KR-BUG-015: the track page shows a real order number's shape", () => {
  it("is not the made-up KRI-1042", async () => {
    const form = await read("components/TrackOrderForm.tsx");
    expect(form).toContain('placeholder="KRS-ORD-20261028103045-AB12"');
    expect(form).not.toContain('placeholder="KRI-1042"');
  });
});
