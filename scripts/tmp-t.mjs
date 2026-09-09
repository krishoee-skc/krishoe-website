import fs from "node:fs";
const P = "tests/ledger-says-which-shoe.test.ts";
const raw = fs.readFileSync(P, "utf8");
const crlf = raw.includes("\r\n");
let s = crlf ? raw.split("\r\n").join("\n") : raw;
const one = (from, to) => {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`matched ${n}x: ${from.slice(0,55)}`);
  s = s.replace(from, to);
};

one(`  it("widens the empty row to match the new column count", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // A colSpan left at 7 leaves the "no entries" message short of the table.
    expect(screen).toContain("colSpan={8}");
  });`,
`  it("spans the empty row across every column", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // Seven now: Earned and Paid merged into one Amount column.
    expect(screen).toContain("colSpan={7}");
  });`);

one(`describe("the dash in a money column", () => {
  it("is grey, while only real amounts carry colour", async () => {
    const screen = await readFile(SCREEN, "utf8");

    const earned = screen.slice(
      screen.indexOf('data-label={text("Earned"'),
      screen.indexOf('data-label={text("Paid"'),
    );
    const paid = screen.slice(
      screen.indexOf('data-label={text("Paid"'),
      screen.indexOf('data-label={text("Balance"'),
    );

    // The colour sits on the figure, not on the cell around it.
    expect(earned).not.toMatch(/className=\{\`py-3[^\`]*text-green-600/);
    expect(paid).not.toMatch(/className=\{\`py-3[^\`]*text-red-600/);
    expect(earned).toContain("text-green-600");
    expect(paid).toContain("text-red-600");
    expect(paid).toContain("text-brand-muted-soft");
  });

  it("keeps the accounting order: earned, paid, then balance", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // In, out, result — moving Paid away from that would break the row's
    // arithmetic as it is read left to right.
    const earned = screen.indexOf('text("Earned", "कमाएको")');
    const paid = screen.indexOf('text("Paid", "पाएको")');
    const balance = screen.indexOf('text("Balance", "बाँकी")');

    expect(earned).toBeLessThan(paid);
    expect(paid).toBeLessThan(balance);
  });
});`,
`/**
 * One money column, because no row is ever both.
 *
 * Checked against the shop's ledger: nine rows are work — pairs and a wage,
 * never a payment — and two are payments, with no pairs and no wage. Two money
 * columns therefore left one of them empty on every single row, which is what
 * the owner kept reading as wrong: a column of dashes under a heading saying
 * Paid.
 */
describe("the amount column", () => {
  it("is one column, not an earned and a paid", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain('text("Amount", "रकम")');
    expect(screen).not.toContain('text("Earned", "कमाएको")');
    expect(screen).not.toContain('text("Paid", "पाएको")');
  });

  it("signs it: work adds, cash handed over takes away", async () => {
    const screen = await readFile(SCREEN, "utf8");
    const amount = screen.slice(
      screen.indexOf('data-label={text("Amount"'),
      screen.indexOf('data-label={text("Balance"'),
    );

    expect(amount).toContain("text-green-600");
    expect(amount).toContain("text-red-600");
    // The payment is checked first, so a row can never show both.
    expect(amount.indexOf("payment_given")).toBeLessThan(amount.indexOf("amount_earned"));
  });

  it("colours the figure, never the cell around it", async () => {
    const screen = await readFile(SCREEN, "utf8");
    const amount = screen.slice(
      screen.indexOf('data-label={text("Amount"'),
      screen.indexOf('data-label={text("Balance"'),
    );

    // A red dash in a money column reads as money going out.
    expect(amount).toContain("text-brand-muted-soft");
    expect(amount).not.toMatch(/className="py-3[^"]*text-red-600/);
  });

  it("puts the balance after the amount that produced it", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen.indexOf('text("Amount", "रकम")')).toBeLessThan(
      screen.indexOf('text("Balance", "बाँकी")'),
    );
  });
});

/**
 * A wage still owed is not a problem.
 *
 * The balance tile turned amber the moment a worker was owed anything, so a
 * normal Wednesday looked like something had gone wrong. Work is done through
 * the week and cleared on Saturday.
 */
describe("the balance tile", () => {
  it("does not warn about wages owed mid-week", async () => {
    const screen = await readFile(SCREEN, "utf8");
    const tile = screen.slice(screen.indexOf('text("Current balance"'));

    expect(tile.slice(0, 900)).toContain('text("to pay on Saturday", "शनिबार दिनुपर्ने")');
    expect(tile.slice(0, 900)).not.toContain('currentBalance > 0 ? "warn"');
  });

  it("marks a worker paid ahead of their work", async () => {
    const screen = await readFile(SCREEN, "utf8");
    const tile = screen.slice(screen.indexOf('text("Current balance"'));

    // Money to recover from future work is the case worth flagging.
    expect(tile.slice(0, 900)).toContain('currentBalance < 0');
  });
});`);

fs.writeFileSync(P, crlf ? s.split("\n").join("\r\n") : s);
console.log("tests updated for the merged column");
