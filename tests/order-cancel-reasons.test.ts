import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CANCEL_REASONS, cancelReasonLabel, cancelReasonToSave } from "@/lib/order-cancel-reasons";

const english = (en: string) => en;
const nepali = (_en: string, ne: string) => ne;

/**
 * One reason, one saved form (owner, 2026-09-29): the desk read in Nepali
 * saved "फोन उठाएन" and read in English saved "Did not answer the phone", so
 * the same reason was counted as two.
 */
describe("a cancel reason is saved one way", () => {
  it.each(CANCEL_REASONS.map((reason) => [reason.en, reason]))("%s saves as its English words from either language", (_name, reason) => {
    expect(cancelReasonToSave(reason.en)).toBe(reason.en);
    expect(cancelReasonToSave(reason.ne)).toBe(reason.en);
    expect(cancelReasonToSave(`  ${reason.ne} `)).toBe(reason.en);
  });

  it("keeps a reason that is not on the list, as it was typed", () => {
    expect(cancelReasonToSave("  Wrong address ")).toBe("Wrong address");
    expect(cancelReasonToSave("")).toBe("");
  });

  it("shows a saved reason in the reader's language, old Nepali saves too", () => {
    expect(cancelReasonLabel("Size did not fit", nepali)).toBe("साइज मिलेन");
    expect(cancelReasonLabel("साइज मिलेन", english)).toBe("Size did not fit");
    expect(cancelReasonLabel("Wrong address", nepali)).toBe("Wrong address");
  });

  it("the desk sends the English words and the action saves through the one rule", async () => {
    const desk = await readFile("app/admin/OrdersClient.tsx", "utf8");
    const actions = await readFile("app/admin/actions.ts", "utf8");
    expect(desk).toContain("setReason(option.en)");
    expect(desk).not.toMatch(/const CANCEL_REASONS\s*=/);
    expect(actions).toContain('cancelReasonToSave(String(formData.get("reason")');
  });
});
