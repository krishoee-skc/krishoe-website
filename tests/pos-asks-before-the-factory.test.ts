import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PosNeedsAnswer, POS_ANSWER_FIELD } from "@/lib/pos-questions";

const createPosInvoice = vi.fn();
const reportError = vi.fn();
const permission = vi.fn(async () => ({ role: "Owner", session: { name: "Owner" } }));

vi.mock("@/lib/pos", () => ({
  createPosInvoice: (...args: unknown[]) => createPosInvoice(...args),
  repairPosInvoicePosting: vi.fn(),
}));
vi.mock("@/lib/admin-permissions", () => ({ requireAdminPermission: () => permission() }));
vi.mock("@/lib/admin-audit", () => ({ recordAdminAuditEvent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/report-error", () => ({
  reportError: (...args: unknown[]) => reportError(...args),
  reportingErrors: vi.fn(),
}));

import { createPosInvoiceAction } from "@/app/admin/pos/actions";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

function saleForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("kind", "Sale");
  formData.set("channel", "Retail");
  formData.set("paymentMethod", "Cash");
  formData.set("itemCount", "1");
  formData.set("item0Design", "Bantu Hill");
  formData.set("item0Quantity", "1");
  formData.set("item0Rate", "1150");
  formData.set("sourceSubmissionKey", "pos-ask-test-1");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  createPosInvoice.mockReset();
  reportError.mockReset();
  permission.mockClear();
});

/** Owner, 2026-10-20 (audit 6 and 12): the counter is asked, not overruled in silence. */
describe("a bill that needs one answer", () => {
  it("hands the question back to the counter, and does not log it as a failure", async () => {
    createPosInvoice.mockRejectedValue(
      new PosNeedsAnswer({ en: "Not enough at the shop — Bantu Hill: 0 at the shop, 53 at the factory. Give them from the factory?", ne: "पसलमा पुग्दैन — Bantu Hill: पसलमा 0, कारखानामा 53। कारखानाबाट दिने हो?" }, "fromFactory"),
    );
    const state = await createPosInvoiceAction(null, saleForm());
    expect(state.ok).toBe(false);
    expect(state.ask).toBe("fromFactory");
    expect(state.message).toContain("कारखानामा 53");
    expect(state.message).toContain("53 at the factory");
    expect(reportError).not.toHaveBeenCalled();
  });

  it("passes the counter's yes, and who is billing, to the bill", async () => {
    createPosInvoice.mockResolvedValue({ id: "POS-1", invoiceNumber: "KRB001", kind: "Sale", total: 1150 });
    await createPosInvoiceAction(null, saleForm({ [POS_ANSWER_FIELD.fromFactory]: "yes", [POS_ANSWER_FIELD.belowMinimum]: "yes" }));
    expect(createPosInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ answerFromFactory: true, answerBelowMinimum: true, billedByOwner: true }),
    );
  });

  it("asks only for the shop's own shelf, lets only the Owner go under a minimum, and keeps the website order as it was", async () => {
    const pos = await read("lib/pos.ts");
    expect(pos).toContain('if ((input.channel === "Retail" || input.channel === "Online") && !input.answerFromFactory) {');
    expect(pos).toContain("!(input.billedByOwner && input.answerBelowMinimum)");
    const orders = await read("app/admin/actions.ts");
    expect(orders).toContain("answerFromFactory: true,");
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('text("Yes, give them from the factory and save", "हो, कारखानाबाट दिएर बिल राख्ने")');
    // A yes belongs to the bill it was given to.
    expect(form).toContain("const givenAnswers = answers.key === answerKey ? answers.list : [];");
  });
});
