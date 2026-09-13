import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The foot of the bill, which is the paper the customer keeps.
 *
 * A POS bill leaves in the customer's bag and is the one thing they still have
 * three days later, when the shoe turns out to be a size small. What the foot
 * of it said was:
 *
 *   Billed by <cashier> · This is a computer generated invoice · KRISHOE POS
 *
 * None of which they can use. And halfway up the same bill, in the remarks,
 * it said something worse:
 *
 *   Note: Goods once sold will not be taken back.
 *
 * That is the opposite of what this shop promises. /return-policy and the
 * storefront's trust strip both say seven days to exchange or return. A
 * customer holding a bill that contradicts the website has been told two
 * different things by the same shop, and the one on paper is the one they will
 * believe — so the hard-coded line is gone.
 *
 * In its place, at the foot: the shop's own note from Settings, then the phone
 * number, WhatsApp and web address. The note is a setting rather than code
 * because the return window is the shop's decision, not the software's — seven
 * days today, and if it becomes fifteen the owner changes it without asking
 * anyone.
 *
 * The column was added to the database before this code shipped
 * (scripts/migrations/20260913_company_bill_footer_note.sql, applied and
 * verified against the live database), so no deployment ever selects a column
 * that is not there.
 */
const BILL = "app/admin/pos/[id]/page.tsx";

/**
 * The bill's source with its comments blanked.
 *
 * Both removed lines are quoted in the comments that explain why they were
 * removed, so a plain search for them finds the explanation and fails on
 * correct code. Blanking keeps the line numbering intact.
 */
function withoutComments(source: string) {
  const blank = (match: string) => match.replace(/[^\n]/g, " ");
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:"'`])\/\/[^\n]*/g, blank);
}
const SETTINGS_LIB = "lib/admin-settings.ts";
const SETTINGS_FORM = "app/admin/settings/page.tsx";
const SETTINGS_ACTION = "app/admin/settings/actions.ts";

describe("the line that contradicted the shop", () => {
  it("no longer tells the customer goods cannot be returned", async () => {
    const bill = withoutComments(await readFile(BILL, "utf8"));

    // The shop promises seven days. A bill saying otherwise is not a stricter
    // policy, it is a different one — and it is the copy the customer holds.
    expect(bill).not.toContain("Goods once sold will not be taken back");
    expect(bill).not.toContain("RETURN_NOTE");
  });

  it("still says what the shop actually promises, on /return-policy", async () => {
    const policy = await readFile("app/return-policy/page.tsx", "utf8");
    const strip = await readFile("components/TrustStrip.tsx", "utf8");

    // The bill's note is the owner's to write, but it should not be written
    // against a policy that has quietly changed underneath it.
    expect(policy).toContain("7 days");
    expect(strip).toContain('text("7 days", "७ दिन")');
  });
});

describe("what the foot of the bill carries now", () => {
  it("prints the shop's own note when it has one", async () => {
    const bill = await readFile(BILL, "utf8");

    expect(bill).toContain("company.billFooterNote");
  });

  it("prints nothing rather than an empty box when it does not", async () => {
    const bill = await readFile(BILL, "utf8");

    // A blank setting must leave the bill reading exactly as it did before —
    // not a bordered strip with nothing in it.
    expect(bill).toContain("{company.billFooterNote ? (");
  });

  it("gives the customer a way to reach the shop", async () => {
    const bill = await readFile(BILL, "utf8");

    expect(bill).toContain("company.phone");
    expect(bill).toContain("businessContact.whatsappDisplay");
    expect(bill).toContain("{shopDomain}");
  });

  it("takes the web address from what the shop already knows", async () => {
    const bill = await readFile(BILL, "utf8");

    // Not a second copy of the domain to keep in step with the first.
    expect(bill).toContain("getSiteUrl()");
    // And without the scheme — a bill has no room for https:// and nobody
    // types it.
    expect(bill).toContain('.replace(/^https?:\\/\\//, "")');
  });

  it("drops the line that told the customer nothing", async () => {
    const bill = withoutComments(await readFile(BILL, "utf8"));

    expect(bill).not.toContain("This is a computer generated invoice");
    // The cashier's name stays: that is who to ask about this bill.
    expect(bill).toContain("Billed by {invoice.cashier}");
  });
});

describe("the note is the shop's to write", () => {
  it("is stored with the rest of the company settings", async () => {
    const lib = await readFile(SETTINGS_LIB, "utf8");

    expect(lib).toContain("billFooterNote: string;");
    expect(lib).toContain("bill_footer_note: string;");
  });

  it("is read, written and upserted — not just declared", async () => {
    const lib = await readFile(SETTINGS_LIB, "utf8");

    // Half-wiring this is the quiet failure: the field exists, the form saves,
    // and the value never survives a reload.
    expect(lib, "SELECT").toContain("default_branch_id, bill_footer_note, promo_text");
    expect(lib, "row read").toContain("billFooterNote: row.bill_footer_note");
    expect(lib, "INSERT column").toMatch(/INSERT INTO company_settings[\s\S]{0,400}bill_footer_note/);
    expect(lib, "INSERT value").toContain("nextCompany.billFooterNote,");
    expect(lib, "ON CONFLICT").toContain("bill_footer_note = EXCLUDED.bill_footer_note");
  });

  it("has as many placeholders as it has columns", async () => {
    const lib = await readFile(SETTINGS_LIB, "utf8");
    const start = lib.indexOf("INSERT INTO company_settings (");
    const block = lib.slice(start, lib.indexOf("RETURNING", start));

    const columns = block
      .slice(block.indexOf("(") + 1, block.indexOf(")"))
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    const placeholders = (block.match(/VALUES \([^)]*\)/)?.[0].match(/\$\d+/g) ?? []).length;

    // Adding a column and forgetting its $N is how an upsert starts writing
    // every value one field to the left. `id` is the literal 'default'.
    expect(placeholders + 1, "columns vs placeholders").toBe(columns.length);
  });

  it("can be set from the settings screen", async () => {
    const form = await readFile(SETTINGS_FORM, "utf8");
    const action = await readFile(SETTINGS_ACTION, "utf8");

    expect(form).toContain('name="billFooterNote"');
    expect(form).toContain("settings.company.billFooterNote");
    expect(action).toContain('textValue(formData, "billFooterNote")');
  });

  it("ships with the migration that makes the column exist", async () => {
    const migration = await readFile(
      "scripts/migrations/20260913_company_bill_footer_note.sql",
      "utf8",
    );

    // Safe to run twice, and safe on a database that already has it.
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS bill_footer_note");
    // Defaulted, so every existing row is valid the moment it is added.
    expect(migration).toContain("NOT NULL DEFAULT ''");
  });
});
