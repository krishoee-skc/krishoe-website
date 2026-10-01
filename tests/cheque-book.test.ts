import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  actionDateProblem,
  allowedActions,
  bankChoices,
  billsMissingDetails,
  chequeDateWarning,
  chequeMessage,
  chequeReminders,
  chequeStage,
  chequeTotals,
  chequeWeeks,
  stateAfter,
  type Cheque,
} from "@/lib/cheque-book-rules";
import { chequeMigrations } from "@/lib/cheques";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The cheque book (owner, 2026-10-01): "whose cheque, which bank, when to
 * deposit, did it clear — for us and for the customer, and we give cheques
 * when we buy, too."
 */
const today = "2026-10-01";
const cheque = (over: Partial<Cheque>): Cheque => ({
  id: "c1",
  direction: "in",
  source: "bill",
  sourceId: "b1",
  sourceNumber: "KRB003",
  partyName: "Sample 4",
  partyPhone: "9812345678",
  bank: "NIC Asia Bank",
  chequeNo: "15455565",
  amount: 3900,
  chequeDate: "2026-10-06",
  nameOnCheque: "",
  state: "waiting",
  depositedOn: "",
  clearedOn: "",
  bouncedOn: "",
  bounceReason: "",
  bankCharge: 0,
  note: "",
  createdAt: "2026-10-01T06:00:00.000Z",
  createdBy: "Owner",
  ...over,
});

describe("where a cheque stands", () => {
  it("waits in hand until its date, then is due at the bank", () => {
    expect(chequeStage(cheque({}), today)).toBe("hold");
    expect(chequeStage(cheque({ chequeDate: today }), today)).toBe("deposit");
    expect(chequeStage(cheque({ state: "deposited" }), today)).toBe("in-bank");
    expect(chequeStage(cheque({ direction: "out" }), today)).toBe("cashable");
    expect(chequeStage(cheque({ chequeDate: "" }), today)).toBe("no-date");
    expect(chequeStage(cheque({ state: "bounced" }), today)).toBe("bounced");
  });

  it("moves only the ways a cheque can", () => {
    expect(allowedActions(cheque({}))).toEqual(["deposit", "clear", "bounce", "cancel"]);
    expect(allowedActions(cheque({ state: "deposited" }))).toEqual(["clear", "bounce"]);
    expect(allowedActions(cheque({ state: "bounced" }))).toEqual(["recover"]);
    expect(allowedActions(cheque({ state: "cleared" }))).toEqual([]);
    expect(allowedActions(cheque({ direction: "out" }))).toEqual(["clear", "bounce", "cancel"]);
    expect(stateAfter("deposit")).toBe("deposited");
    expect(stateAfter("recover")).toBe("recovered");
  });

  it("refuses depositing before the cheque's date, and a day not yet come", () => {
    expect(actionDateProblem(cheque({}), "deposit", today, today)?.en).toMatch(/has not come/);
    expect(actionDateProblem(cheque({ chequeDate: today }), "deposit", today, today)).toBeNull();
    expect(actionDateProblem(cheque({}), "clear", "2026-10-02", today)?.en).toBe("That day has not come yet.");
    expect(chequeDateWarning("2026-03-01", today)?.en).toMatch(/months old/);
    expect(chequeDateWarning("2026-09-20", today)).toBeNull();
  });
});

describe("the figures and the reminders", () => {
  const book = [
    cheque({ id: "a", chequeDate: "2026-10-01" }),
    cheque({ id: "b", chequeDate: "2026-10-02", amount: 1000 }),
    cheque({ id: "c", chequeDate: "2026-10-09", amount: 500 }),
    cheque({ id: "d", state: "deposited", amount: 5200 }),
    cheque({ id: "e", state: "cleared", clearedOn: "2026-09-25", amount: 12000 }),
    cheque({ id: "f", state: "bounced", amount: 2500, bankCharge: 300 }),
    cheque({ id: "g", direction: "out", bank: "Nabil Bank", chequeDate: "2026-10-03", amount: 6000 }),
    cheque({ id: "h", direction: "out", bank: "Nabil Bank", chequeDate: "2026-10-02", amount: 8000 }),
    cheque({ id: "i", direction: "out", bank: "Nabil Bank", chequeDate: "2026-10-20", amount: 100 }),
  ];

  it("totals what is in hand, in the bank, cleared this month, bounced and given", () => {
    const totals = chequeTotals(book, "2026-09-17");
    expect(totals.toDeposit).toEqual({ amount: 3900 + 1000 + 500, count: 3 });
    expect(totals.inBank).toEqual({ amount: 5200, count: 1 });
    expect(totals.clearedThisMonth).toEqual({ amount: 12000, count: 1 });
    expect(totals.bouncedOwed).toEqual({ amount: 2800, count: 1 });
    expect(totals.givenOpen).toEqual({ amount: 14100, count: 3 });
  });

  it("reminds of cheques due by tomorrow, money to keep within two days, and bounces", () => {
    const word = chequeReminders(book, today);
    expect(word.toDeposit.map((item) => item.id)).toEqual(["a", "b"]);
    expect(word.coverByBank).toEqual([{ bank: "Nabil Bank", amount: 14000 }]);
    expect(word.bounced.map((item) => item.id)).toEqual(["f"]);
  });

  it("groups open cheques by week, in and out", () => {
    const { weeks, earlier } = chequeWeeks(book, today);
    expect(earlier).toEqual([]);
    expect(weeks[0].startKey).toBe("2026-09-27");
    expect(weeks[0].inAmount).toBe(3900 + 1000);
    expect(weeks[0].outAmount).toBe(14000);
  });
});

describe("words and lists", () => {
  it("puts the banks used before first, each once", () => {
    const banks = bankChoices(["Nabil Bank", "My Local Bank"]);
    expect(banks.slice(0, 3)).toEqual(["Nabil Bank", "My Local Bank", "NIC Asia Bank"]);
    expect(banks.filter((bank) => bank === "Nabil Bank")).toHaveLength(1);
  });

  it("writes the customer's and the supplier's message", () => {
    expect(chequeMessage(cheque({}), "2083/06/20").en).toContain("will be deposited on 2083/06/20");
    expect(chequeMessage(cheque({ state: "bounced", bankCharge: 300 }), "").en).toContain("Please pay Rs. 4,200 including the Rs. 300 bank charge");
    expect(chequeMessage(cheque({ direction: "out", partyName: "Rijal Suppliers" }), "2083/06/22").en).toContain("can be deposited from 2083/06/22");
  });

  it("lists the cheque bills from before the book", () => {
    expect(billsMissingDetails([{ id: "b1" }, { id: "b2" }], [cheque({})]).map((bill) => bill.id)).toEqual(["b2"]);
  });
});

describe("the wiring", () => {
  it("adds its table by the Owner's button, word for word from the migration", async () => {
    const migration = chequeMigrations.find((item) => item.table === "cheques");
    expect(migration?.sql).toBe(await read("scripts/migrations/20261001_cheques.sql"));
    expect(await read("docs/schema.sql")).toContain("CREATE TABLE IF NOT EXISTS cheques (");
    const cheques = await read("lib/cheques.ts");
    // The counter's own cheque marks do not wait for the book's table.
    expect(cheques).toContain('return tableReady("pos_cheques");');
  });

  it("files a bill's and a purchase's cheque after they are safe, never failing them", async () => {
    const pos = await read("app/admin/pos/actions.ts");
    expect(pos).toContain('return { ok: false, message: "A cheque needs its bank and its date." };');
    expect(pos).toContain("await reportingErrors(`file the cheque on ${invoice.invoiceNumber}`, () =>");
    const purchase = await read("app/admin/purchasing/actions.ts");
    expect(purchase).toContain('direction: "out",');
    expect(purchase).toContain("await reportingErrors(`file the cheque on ${invoice.purchaseNumber}`, () =>");
  });

  it("asks the bank and date on both forms, and reminds the Owner", async () => {
    expect(await read("app/admin/pos/_components/PosBillForm.tsx")).toContain('direction="in"');
    expect(await read("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx")).toContain('direction="out"');
    expect(await read("app/api/cron/daily-sales/route.ts")).toContain('name: "cheque-reminders",');
    expect(await read("app/admin/page.tsx")).toContain('key: "cheques-deposit",');
    expect(await read("app/admin/nav-links.ts")).toContain('{ href: "/admin/cheques", label: "Cheques", nepali: "चेक खाता", icon: CreditCardIcon },');
  });
});
