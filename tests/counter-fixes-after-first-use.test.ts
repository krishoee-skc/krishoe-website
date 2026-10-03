import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * What the first day of counter goods turned up (owner, 2026-09-29): kitto 770's
 * 100 uncounted pairs filed on its size-40 row; a credit sale that could not
 * open an account because the name box sat far away marked "optional"; and a ✓
 * pressed three times in a second.
 */
describe("the uncounted pile keeps its own row", () => {
  it("is posted before the sizes", async () => {
    const source = await read("lib/counter-items.ts");
    const rows = source.slice(source.indexOf("const rows: Array<[string, number]> = ["));
    const pile = rows.indexOf('[["Mixed", pilePairs]]');
    const sizes = rows.indexOf("...Object.entries(sizes)");
    expect(pile).toBeGreaterThan(-1);
    expect(sizes).toBeGreaterThan(pile);
  });
});

describe("a credit sale opens its account where it is asked for", () => {
  it("has the name and phone boxes beside the open-account button", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    const panel = form.slice(form.indexOf("canOpenLedger ? ("), form.indexOf("onClick={openLedger}"));
    expect(panel).toContain('aria-label={text("Customer\'s name for the account"');
    // the phone box carries its country since 2026-10-03
    expect(panel).toContain('ariaLabel={text("Customer\'s phone for the account"');
  });

  it("says the name is needed, not optional, while credit waits for an account", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain("ग्राहकको नाम (उधारोका लागि चाहिन्छ)");
  });
});

describe("the Owner's ✓", () => {
  it("is off while it saves", async () => {
    const button = await read("app/admin/stock/ReviewButton.tsx");
    expect(button).toContain("const { pending } = useFormStatus();");
    expect(button).toContain("disabled={pending}");
    const watch = await read("app/admin/stock/CounterGoodsWatch.tsx");
    expect(watch).toContain("<ReviewButton />");
  });
});
