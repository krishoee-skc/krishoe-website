import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Reports that leave the building on paper.
 *
 * The shop already printed bills and ledgers, and those are receipts: one short
 * page, printed once, handed over. A worker's ledger, a payslip, the dues list
 * and a stock count are a different kind of document — they run past one sheet,
 * they are read next to the person they are about, and they get kept. The owner
 * asked for these four, and the owner caught the two I had missed: the factory
 * ledger and the payslip.
 *
 * What goes wrong on paper is not what goes wrong on a screen, so the CSS that
 * makes a receipt fit one page does none of this:
 *
 *   - A table splits mid-row and half a line lands on the next sheet, so the
 *     reader cannot tell which number belongs to which name.
 *   - The header row prints on page one only, leaving pages two and three as
 *     columns of unlabelled figures. `display: table-header-group` repeats it.
 *   - The screen's tinted rows and dark panels either eat the shop's ink or
 *     come out as grey mud on a mono printer.
 *
 * And two things every sheet has to carry, which a screenshot would not: the
 * shop's own name, so a loose page can be traced back, and the date it was
 * printed. These reports change between printings — a worker does more work, a
 * customer pays part of what they owe — so two copies a week apart are
 * different documents and only the date says which is current.
 */
const CSS = "app/globals.css";

/** The four sheets, and what each must carry. */
const SHEETS = [
  { file: "app/admin/factory/ledger/PieceLedger.tsx", what: "the worker's ledger" },
  { file: "app/worker/payslip/page.tsx", what: "the payslip" },
  { file: "app/admin/dues/page.tsx", what: "the dues list" },
  { file: "app/admin/stock/page.tsx", what: "the stock count" },
];

describe("what the print stylesheet has to do", () => {
  it("repeats the table header on every sheet", async () => {
    const css = await readFile(CSS, "utf8");
    const print = css.slice(css.indexOf("@media print"));

    // Without this, page two of a dues list is a column of numbers with no
    // names above them.
    expect(print).toContain("display: table-header-group");
  });

  it("keeps a row from splitting across the fold", async () => {
    const css = await readFile(CSS, "utf8");
    const print = css.slice(css.indexOf("@media print"));

    expect(print).toContain("break-inside: avoid");
    // The older spelling, for browsers that only understand that one.
    expect(print).toContain("page-break-inside: avoid");
  });

  it("prints black on white rather than the screen's tints", async () => {
    const css = await readFile(CSS, "utf8");
    const rules = css.slice(css.indexOf(".report-print th,"), css.indexOf(".report-print thead th"));

    expect(rules).toContain("background: transparent !important");
    expect(rules).toContain("color: #000 !important");
  });

  it("leaves the paper size to the printer dialog", async () => {
    const css = await readFile(CSS, "utf8");
    const page = css.slice(css.indexOf("@page"), css.indexOf("@page") + 120);

    // Pinning a size locks the dialog to it and hides the A5/Letter chooser.
    // The shop picks the paper; the layout fits whatever is chosen.
    expect(page).toContain("margin");
    expect(page).not.toMatch(/size:\s*(A4|A5|letter|portrait|landscape)/i);
  });
});

describe("every sheet that leaves the building", () => {
  it("is marked as a report, not a receipt", async () => {
    for (const sheet of SHEETS) {
      const source = await readFile(sheet.file, "utf8");
      expect(source, sheet.what).toContain("report-print");
    }
  });

  it("carries the shop's own name and address", async () => {
    for (const sheet of SHEETS) {
      const source = await readFile(sheet.file, "utf8");

      // A loose page of figures with no shop on it is worth nothing the moment
      // it is put down next to another one.
      expect(source, sheet.what).toContain("KRISHOE");
      expect(source, sheet.what).toContain("businessContact.streetAddress");
    }
  });

  it("says when it was printed", async () => {
    for (const sheet of SHEETS) {
      const source = await readFile(sheet.file, "utf8");
      expect(source, sheet.what).toContain("<PrintedOn />");
    }
  });

  it("can actually be printed", async () => {
    for (const sheet of SHEETS) {
      const source = await readFile(sheet.file, "utf8");

      // A print stylesheet with no button is a feature nobody can reach.
      expect(source, sheet.what).toContain("<PrintButton");
    }
  });

  it("hides its buttons and filters from the paper", async () => {
    for (const sheet of SHEETS) {
      const source = await readFile(sheet.file, "utf8");
      expect(source, sheet.what).toContain("print:hidden");
    }
  });
});

describe("the date stamp", () => {
  it("waits for the browser rather than rendering on the server", async () => {
    const source = await readFile("components/admin/PrintedOn.tsx", "utf8");

    // new Date() on the server and again in the browser are two different
    // instants — React finds different text than it rendered and replaces the
    // node, which the reader sees flicker.
    expect(source).toContain("useState<{ bs: string; ad: string } | null>(null)");
    expect(source).toContain("if (!stamp) return null;");
  });

  it("schedules the first reading instead of setting state in the effect body", async () => {
    const source = await readFile("components/admin/PrintedOn.tsx", "utf8");

    // react-hooks/set-state-in-effect forbids the synchronous version, and the
    // rule is right — it renders twice for nothing.
    expect(source).toContain("setTimeout(");
    expect(source).toContain("clearTimeout(timeout)");
  });

  it("prints both calendars", async () => {
    const source = await readFile("components/admin/PrintedOn.tsx", "utf8");

    // The shop and its workers keep Bikram Sambat; a bank or supplier reading
    // the same sheet keeps the other one.
    expect(source).toContain("toBikramSambatNepali");
    expect(source).toContain("formatAdminDate");
  });
});

describe("the payslip, which a worker keeps", () => {
  it("turns its dark panel into plain text on paper", async () => {
    const source = await readFile("app/worker/payslip/page.tsx", "utf8");

    // bg-brand-green-ink is right on a screen and wrong on paper: it eats ink
    // on a colour printer and prints as grey mud on a mono one.
    expect(source).toContain("print:bg-transparent");
    expect(source).toContain("print:text-brand-green-ink");
  });

  it("names the worker it belongs to, and says what the sheet is", async () => {
    const source = await readFile("app/worker/payslip/page.tsx", "utf8");
    const header = source.slice(source.indexOf("report-head"), source.indexOf("bg-brand-green-ink"));

    expect(header.length, "the print header moved").toBeGreaterThan(0);

    // A payslip with no name on it belongs to nobody.
    expect(header).toContain("detail.worker.name");
    expect(header).toContain("Payslip");
  });
});
