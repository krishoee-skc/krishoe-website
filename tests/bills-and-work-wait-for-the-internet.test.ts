import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { addToQueue, isNetworkFailure, sendQueue, type Queued } from "@/lib/offline-queue";

/**
 * Owner, 2026-10-20, the five-rules sample, rule 4: with no internet a new
 * sale and a new work entry wait on the phone, with the key they would have
 * been sent with, and go when the internet is back — once.
 */
const bill = (id: string, savedAt: string, status: Queued["status"] = "waiting"): Queued => ({
  id,
  savedAt,
  status,
  kind: "bill",
  label: { en: "1 pair · Rs 950", ne: "1 जोडी · Rs 950" },
  entries: [["sourceSubmissionKey", `pos-${id}`]],
  snapshot: { cart: [], channel: "Retail", kind: "Sale" },
});

describe("the queue", () => {
  it("keeps a new one waiting, after the others", () => {
    const list = addToQueue([bill("a", "2026-10-20T01:00:00Z")], { kind: "work", label: { en: "x", ne: "x" }, body: "{}", idempotencyKey: "k1" }, "2026-10-20T02:00:00Z", "b");
    expect(list.map((item) => [item.id, item.status])).toEqual([["a", "waiting"], ["b", "waiting"]]);
  });

  it("tells a send that never arrived from one the shop refused", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"), true)).toBe(true);
    expect(isNetworkFailure(new Error("NetworkError when attempting to fetch resource."), true)).toBe(true);
    expect(isNetworkFailure(new Error("anything"), false)).toBe(true);
    expect(isNetworkFailure(new Error("Lose Hill Panja size 36 is not in stock."), true)).toBe(false);
  });
});

describe("sending what waits", () => {
  it("oldest first, each once; a refusal is held with its reason and does not stop the rest", async () => {
    const order: string[] = [];
    const result = await sendQueue(
      [bill("late", "2026-10-20T03:00:00Z"), bill("early", "2026-10-20T01:00:00Z"), bill("held", "2026-10-20T00:00:00Z", "needs-you"), bill("mid", "2026-10-20T02:00:00Z")],
      async (item) => {
        order.push(item.id);
        return item.id === "mid" ? { ok: false, message: "पसलमा पुग्दैन" } : { ok: true };
      },
    );
    expect(order).toEqual(["early", "mid", "late"]);
    expect(result).toEqual({ sent: ["early", "late"], held: [{ id: "mid", message: "पसलमा पुग्दैन" }], stopped: false });
  });

  it("stops when the internet goes again, and leaves the rest waiting", async () => {
    const result = await sendQueue(
      [bill("a", "2026-10-20T01:00:00Z"), bill("b", "2026-10-20T02:00:00Z"), bill("c", "2026-10-20T03:00:00Z")],
      async (item) => {
        if (item.id === "b") throw new TypeError("Failed to fetch");
        return { ok: true };
      },
    );
    expect(result).toEqual({ sent: ["a"], held: [], stopped: true });
  });
});

describe("the counter and the work form keep it", () => {
  it("only a new sale paid now waits; its key stays with it and the next bill gets a new one", async () => {
    const form = await readFile("app/admin/pos/_components/PosBillForm.tsx", "utf8");
    expect(form).toContain('const mayWait = kind === "Sale" && creditAmount === 0 && !collectDue && !needsAccount;');
    expect(form).toContain("if (isNetworkFailure(error) && mayWait) {");
    expect(form).toContain("setSubmissionKey(newSubmissionKey());");
    expect(form).toContain("फिर्ता, साटफेर र उधारो internet आएपछि मात्र मिल्छ।");
  });

  it("a work entry waits with its Idempotency-Key, only when the send never arrived", async () => {
    const work = await readFile("app/admin/factory/add-work/WorkEntryForm.tsx", "utf8");
    expect(work).toContain("if (!isNetworkFailure(networkError)) throw networkError;");
    expect(work).toContain("idempotencyKey: key,");
  });

  it("is sent from any admin screen, with the same keys", async () => {
    const sync = await readFile("components/admin/OfflineSync.tsx", "utf8");
    expect(sync).toContain('"Idempotency-Key": item.idempotencyKey');
    expect(sync).toContain("createPosInvoiceAction(null, form)");
    expect(await readFile("app/admin/layout.tsx", "utf8")).toContain("<OfflineSync />");
  });
});
