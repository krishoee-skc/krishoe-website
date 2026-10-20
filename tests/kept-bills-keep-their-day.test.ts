import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeptBillTooOld, keptBillTime, nepalStamp } from "@/lib/kept-bill-time";

const createPosInvoice = vi.fn();

vi.mock("@/lib/pos", () => ({
  createPosInvoice: (...args: unknown[]) => createPosInvoice(...args),
  repairPosInvoicePosting: vi.fn(),
}));
vi.mock("@/lib/admin-permissions", () => ({ requireAdminPermission: async () => ({ role: "Owner", session: { name: "Owner" } }) }));
vi.mock("@/lib/admin-audit", () => ({ recordAdminAuditEvent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn(), reportingErrors: vi.fn() }));

import { createPosInvoiceAction } from "@/app/admin/pos/actions";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-20, the kept-bill sample: a cash sale kept on a phone falls
 * on the day it was sold (1), and a held one opened again is the whole bill,
 * with its own key (2).
 */
describe("1 · the day a kept bill falls on", () => {
  // 21 October, 7:30 in the morning in Nepal.
  const morning = new Date("2026-10-21T01:45:00Z");

  it("is the evening it was sold, and the bill says when it reached the shop", () => {
    const evening = "2026-10-20T14:25:00Z"; // 8:10 pm in Nepal
    expect(keptBillTime(evening, morning)).toEqual({
      createdAt: "2026-10-20T14:25:00.000Z",
      remark: "Kept offline · sent 21-10-2026 07:30",
    });
    expect(nepalStamp(new Date(evening))).toBe("20-10-2026 20:10");
  });

  it("is now for a bill made with the internet, a moment ago, or ahead of the shop's clock", () => {
    expect(keptBillTime(undefined, morning)).toBeNull();
    expect(keptBillTime("", morning)).toBeNull();
    expect(keptBillTime("not a time", morning)).toBeNull();
    expect(keptBillTime("2026-10-21T01:44:00Z", morning)).toBeNull();
    expect(keptBillTime("2026-10-22T09:00:00Z", morning)).toBeNull();
  });

  it("goes no further back than 24 hours: an older one is held, in both languages", () => {
    expect(keptBillTime("2026-10-20T01:46:00Z", morning)?.createdAt).toBe("2026-10-20T01:46:00.000Z");
    expect(() => keptBillTime("2026-10-20T01:44:00Z", morning)).toThrow(KeptBillTooOld);
    expect(() => keptBillTime("2026-10-20T01:44:00Z", morning)).toThrow(/२४ घण्टाभन्दा पुरानो.*more than 24 hours/);
  });

  it("is carried from the kept form to the bill, for a paid sale only", async () => {
    createPosInvoice.mockReset();
    createPosInvoice.mockResolvedValue({ id: "POS-1", invoiceNumber: "KRB012", kind: "Sale", total: 950 });
    const form = new FormData();
    form.set("kind", "Sale");
    form.set("itemCount", "1");
    form.set("item0Design", "Lose Hill Panja");
    form.set("item0Quantity", "1");
    form.set("item0Rate", "950");
    form.set("offlineSoldAt", "2026-10-20T14:25:00Z");
    await createPosInvoiceAction(null, form);
    expect(createPosInvoice).toHaveBeenCalledWith(expect.objectContaining({ soldAt: "2026-10-20T14:25:00Z" }));

    const pos = await read("lib/pos.ts");
    expect(pos).toContain('const kept = input.kind === "Sale" && creditAmount === 0 && !due ? keptBillTime(input.soldAt, new Date()) : null;');
    expect(pos).toContain("const createdAt = kept ? kept.createdAt : new Date().toISOString();");
    expect(pos).toContain('note: [cleanText(input.note), kept?.remark ?? ""].filter(Boolean).join(" · "),');

    const bill = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(bill).toContain('["offlineSoldAt", soldAt],');
  });
});

describe("2 · a held bill opened again", () => {
  it("is kept with its key and what was typed on it", async () => {
    const bill = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(bill).toContain('key: String(formData.get("sourceSubmissionKey") ?? ""),');
    for (const field of ["payment,", "received,", "reference,", "discountMode,", "discountText,", "phone,", "customerName,", "chequeDetails,"]) {
      expect(bill).toContain(`        ${field}`);
    }
    expect(bill).toContain('address: String(formData.get("customerAddress") ?? ""),');
    expect(bill).toContain('note: String(formData.get("note") ?? ""),');
  });

  it("comes back whole, with its key and why it was held", async () => {
    const bill = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(bill).toContain("setSubmissionKey(kept.key);");
    expect(bill).toContain('setDiscountText(words("discountText"));');
    expect(bill).toContain('setCustomerName(words("customerName"));');
    expect(bill).toContain('setLooseBoxes((boxes) => ({ stamp: boxes.stamp + 1, address: words("address"), note: words("note") }));');
    expect(bill).toContain('text("Why it was held", "किन रोकियो")');
    expect(await read("components/admin/OfflineSync.tsx")).toContain("JSON.stringify({ id: item.id, message: item.message, ...item.snapshot })");
  });

  it("opens on the counter that is already open, too", async () => {
    // Pressing "Open on the bill" while on the counter went to the same page,
    // which opened nothing (found in the browser, 2026-10-20).
    const bill = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(bill).toContain("window.addEventListener(POS_RESTORE_EVENT, openKept);");
    const sync = await read("components/admin/OfflineSync.tsx");
    expect(sync.indexOf("window.dispatchEvent(new Event(POS_RESTORE_EVENT));")).toBeLessThan(sync.indexOf('router.push("/admin/pos");'));
    expect(sync).toContain("window.dispatchEvent(new Event(POS_RESTORE_EVENT));");
  });

  it("takes a new key once its shoes are changed", async () => {
    const bill = await read("app/admin/pos/_components/PosBillForm.tsx");
    const at = bill.indexOf("if (reopened.current) {");
    expect(at).toBeGreaterThan(0);
    const block = bill.slice(at, bill.indexOf("reopened.current = null;", at));
    expect(block).toContain("if (reopened.current.cart !== JSON.stringify(cart)) {");
    expect(block).toContain('formData.set("sourceSubmissionKey", fresh);');
  });

  it("leaves the next bill's address and note empty after one is kept", async () => {
    const bill = await read("app/admin/pos/_components/PosBillForm.tsx");
    const kept = bill.slice(bill.indexOf("if (kept) {"), bill.indexOf("setSubmissionKey(newSubmissionKey());"));
    expect(kept).toContain('setLooseBoxes((boxes) => ({ stamp: boxes.stamp + 1, address: "", note: "" }));');
    expect(bill).toContain("key={`address-${looseBoxes.stamp}`}");
    expect(bill).toContain("key={`note-${looseBoxes.stamp}`}");
  });
});

describe("and what waits is not given up on a blink", () => {
  it("keeps waiting when the shop's database did not answer, and can be sent again by hand", async () => {
    const sync = await read("components/admin/OfflineSync.tsx");
    expect(sync).toContain("if (!result.ok && result.message === DATABASE_DID_NOT_ANSWER) throw new TypeError(result.message);");
    expect(sync).toContain("response.status === 502 || response.status === 503 || response.status === 504");
    expect(sync).toContain('text("Send again", "फेरि पठाउने")');
    expect(await read("lib/offline-queue.ts")).toContain("export function waitAgain(id: string) {");
  });
});

beforeEach(() => vi.clearAllMocks());
