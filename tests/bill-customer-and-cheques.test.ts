import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { chequeAmount, chequeMigrations, chequesToWatch, type ChequeState } from "@/lib/cheques";
import { customerForPhone, customerSuggestions, knownCustomersFrom, phoneProblem } from "@/lib/customer-contact-rules";
import { migrationChecksum } from "@/lib/delivery-database";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Three things the bill list showed (owner, 2026-09-30): phones nobody can
 * ring, one customer written in twice, and a cheque marked Paid the day it was
 * taken.
 */
describe("a phone that cannot be rung", () => {
  it("passes a mobile or a landline, and says nothing when blank", () => {
    expect(phoneProblem("")).toBeNull();
    expect(phoneProblem("9812345678")).toBeNull();
    expect(phoneProblem("+977 976-6630193")).toBeNull();
    expect(phoneProblem("01-4412345")).toBeNull();
  });

  it("warns on the numbers the bills went through with", () => {
    expect(phoneProblem("5555555")?.ne).toContain("सबै अंक एउटै");
    expect(phoneProblem("11111111111")?.ne).toContain("सबै अंक एउटै");
    expect(phoneProblem("23232323")).not.toBeNull();
    expect(phoneProblem("981234567")?.ne).toBe("9 अंक मात्र — मोबाइल नम्बर १० अंकको हुन्छ।");
  });

  it("is a warning beside the box, not a refusal", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain("const phoneWarning = phoneProblem(phone);");
    expect(form).toContain("⚠ {text(phoneWarning.en, phoneWarning.ne)}");
  });
});

describe("one customer, one name", () => {
  const known = knownCustomersFrom([
    { name: "sample 2", phone: "1212121212" },
    { name: "Walk-in Customer", phone: "" },
    { name: "sample 2", phone: "11111111111" },
    { name: "Dauunne devi", phone: "" },
    { name: "sample 2", phone: "1212121212" },
  ]);

  it("lists each name and phone once, and nobody for Walk-in", () => {
    expect(known).toEqual([
      { name: "sample 2", phone: "1212121212" },
      { name: "sample 2", phone: "11111111111" },
      { name: "Dauunne devi", phone: "" },
    ]);
  });

  it("offers the ones that read like the name typed, with their phones", () => {
    expect(customerSuggestions("samp", "", known).map((person) => person.phone)).toEqual(["1212121212", "11111111111"]);
    expect(customerSuggestions("devi", "", known)).toEqual([{ name: "Dauunne devi", phone: "" }]);
    expect(customerSuggestions("s", "", known)).toEqual([]);
    // Picked already: nothing more to offer.
    expect(customerSuggestions("sample 2", "1212121212", known)).toEqual([]);
  });

  it("names the customer a phone was billed to", () => {
    expect(customerForPhone("121 212 1212", known)?.name).toBe("sample 2");
    expect(customerForPhone("98", known)).toBeNull();
  });

  it("is fed from the bills and accounts, and fills both boxes", async () => {
    const page = await read("app/admin/pos/page.tsx");
    expect(page).toContain("knownCustomers={knownCustomers}");
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain("const nameSuggestions = customerSuggestions(customerName, phone, knownCustomers);");
    expect(form).toContain("if (person.phone) setPhone(person.phone);");
  });
});

describe("a cheque until the bank pays", () => {
  const bill = (id: string, extra: Partial<Parameters<typeof chequeAmount>[0]> = {}) => ({
    id,
    kind: "Sale" as const,
    status: "Paid",
    paymentMethod: "Cheque",
    paidAmount: 10500,
    payments: [],
    ...extra,
  });

  it("reads what a bill took by cheque", () => {
    expect(chequeAmount(bill("a"))).toBe(10500);
    expect(chequeAmount(bill("b", { paymentMethod: "Cash" }))).toBe(0);
    expect(
      chequeAmount(
        bill("c", {
          paymentMethod: "Cash",
          payments: [
            { method: "Cash", amount: 500, purpose: "bill" },
            { method: "Cheque", amount: 4000, purpose: "bill", reference: "CHQ 1" },
          ],
        }),
      ),
    ).toBe(4000);
    expect(chequeAmount(bill("d", { kind: "Return" }))).toBe(0);
    expect(chequeAmount(bill("e", { status: "Voided" }))).toBe(0);
  });

  it("keeps a cheque listed until it clears, and a bounced one until the money is in", () => {
    const states = new Map<string, ChequeState>([
      ["cleared", "cleared"],
      ["bounced", "bounced"],
      ["recovered", "recovered"],
    ]);
    const rows = chequesToWatch([bill("new"), bill("cleared"), bill("bounced"), bill("recovered"), bill("old")], states);
    expect(rows.map((row) => [row.invoice.id, row.state])).toEqual([
      ["old", "waiting"],
      ["bounced", "bounced"],
      ["new", "waiting"],
    ]);
  });

  it("gets its table from the Owner's button, word for word, and only creates", async () => {
    for (const migration of chequeMigrations) {
      const file = await read(`scripts/migrations/${migration.name}`);
      expect(migration.sql).toBe(file);
      expect(migrationChecksum(migration.sql)).toBe(migrationChecksum(file));
      const statements = migration.sql.split("\n").filter((line) => line.trim() && !line.trim().startsWith("--"));
      expect(statements.join("\n")).not.toMatch(/\b(DROP|DELETE|UPDATE|ALTER)\b/i);
    }
    const settings = await read("app/admin/settings/page.tsx");
    expect(settings).toContain("<form action={prepareChequesDatabaseAction}");
  });

  it("is shown above the recent bills", async () => {
    const page = await read("app/admin/pos/page.tsx");
    expect(page).toContain("const cheques = chequesToWatch(pos.invoices, chequeStates);");
    expect(page.indexOf("<ChequesToClear")).toBeLessThan(page.indexOf('ne="भर्खरका बिल"'));
  });
});
