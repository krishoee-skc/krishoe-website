import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The shop must never print an account number nobody owns.
 *
 * The checkout page carried this, hard-coded, for months:
 *
 *   Bank: Nabil Bank Ltd.
 *   Account No: 12345678901234
 *
 * It was shown at the exact moment a shopper decides whether to send real
 * money. Everything else on the page — the honest testimonials, the real stock
 * counts, the size guide — is arguing that this is a real shop, and that one
 * line argues the opposite louder.
 *
 * The details now come from the owner's Settings, and an empty account number
 * hides the panel entirely. A shop not yet taking transfers should say nothing
 * rather than show half an account.
 */
const SETTINGS = "lib/admin-settings.ts";
const PANEL = "components/PaymentInstructions.tsx";

async function sourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sourceFiles(full)));
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("no invented bank account reaches a shopper", () => {
  it("is in no line the shop actually renders", async () => {
    const files = [...(await sourceFiles("app")), ...(await sourceFiles("components"))];
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const offenders: string[] = [];

    files.forEach((file, index) => {
      sources[index].split("\n").forEach((line, number) => {
        // A long run of consecutive ascending digits is nobody's account —
        // 12345678901234 is the shape the placeholder took.
        if (!/12345678\d*/.test(line)) return;

        // Only lines that can reach a screen count, and only where the number
        // would read as an account. Three things are correctly left alone: a
        // comment explaining the old bug; the weak-password blocklist in
        // account/actions.ts, which exists to *refuse* 12345678; and the admin
        // measurement page, which shows the shape of a Meta Pixel ID as help
        // text — a digit-format example, never money.
        const trimmed = line.trim();
        const isComment = trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
        const isPasswordRule = /password|qwerty|abc123/i.test(line);
        const isIdFormatHelp = /looksLike|pixel|digit/i.test(line);
        if (isComment || isPasswordRule || isIdFormatHelp) return;

        offenders.push(`${file}:${number + 1}: ${trimmed.slice(0, 80)}`);
      });
    });

    expect(offenders.join("\n"), "an invented-looking account number can reach a screen").toBe("");
  });

  it("comes from settings, not from the component", async () => {
    const panel = await readFile(PANEL, "utf8");

    expect(panel).toContain("bank.bankAccountNumber");
    // The old panel hard-coded all four lines.
    expect(panel).not.toContain("Nabil Bank Ltd.");
  });

  it("shows nothing at all when the account number is blank", async () => {
    const panel = await readFile(PANEL, "utf8");

    // Half an account is worse than none: it looks like the shop lost the rest.
    expect(panel).toContain("if (!bank.bankAccountNumber.trim()) return null;");
  });

  it("drops any single line the owner left blank", async () => {
    const panel = await readFile(PANEL, "utf8");

    // So a half-filled form never prints a dangling "Branch:" with nothing after.
    expect(panel).toContain("filter((line) => line.value.trim())");
  });
});

describe("what the settings store accepts as an account number", () => {
  it("keeps digits, spaces and dashes, and drops anything else", async () => {
    const source = await readFile(SETTINGS, "utf8");
    const start = source.indexOf("function bankAccountNumber");
    const body = source.slice(start, source.indexOf("function normalizeEmail"));

    expect(start, "bankAccountNumber helper is missing").toBeGreaterThan(-1);
    // A bank account is not free text; letters mean something was pasted wrong.
    expect(body).toContain("/^[0-9][0-9 -]*$/");
  });

  it("is saved on both data backends, not just Postgres", async () => {
    const source = await readFile(SETTINGS, "utf8");

    // The local-json path is what tests and any offline run use; a field added
    // to only one backend silently loses itself on the other.
    expect(source.split("bankAccountNumber: bankAccountNumber(").length - 1).toBe(2);
  });

  it("survives a settings file written before the field existed", async () => {
    const source = await readFile(SETTINGS, "utf8");

    // normalizeStore reads older stored settings; a missing field must become
    // "" rather than undefined, which would print "undefined" on checkout.
    expect(source).toContain("bankAccountNumber: optionalText(source.company?.bankAccountNumber)");
  });
});
