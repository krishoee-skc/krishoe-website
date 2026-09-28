import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { COMMON_COLOURS, WORK_SIZE_RUNS } from "@/app/admin/factory/add-work/work-entry-rules";

/**
 * The work-entry form as the owner laid it out on 2026-09-27.
 *
 * Their list: the boxes did not line up and should all be one size; the QC
 * box ran the full width for one small number; the date could be written
 * another way; the colours were wrong for this factory (blue is rarely made,
 * cream, cherry and gray are made all the time); sizes 21–25 and 36–40 were
 * missing; the form should fill a computer screen; and Enter should do Tab's
 * job. Plus the suggestions they took: "same as last", the day's entries
 * beside the form, a question before a likely double entry, the shoe's usual
 * colour and size first, and the wage on the Save button.
 */
const FORM = "app/admin/factory/add-work/WorkEntryForm.tsx";
const TODAY = "app/admin/factory/add-work/TodayEntries.tsx";
const PAGE = "app/admin/factory/add-work/page.tsx";

describe("the colours and sizes this factory makes", () => {
  it("offers cream, cherry, gray, black, white and red, in that order", () => {
    expect(COMMON_COLOURS.map((colour) => colour.en)).toEqual(["Cream", "Cherry", "Gray", "Black", "White", "Red"]);
  });

  it("offers 21–25 and 36–40 beside the old runs", () => {
    expect(WORK_SIZE_RUNS.map((run) => `${run.from}-${run.to}`)).toEqual(["21-25", "25-30", "31-35", "36-40", "36-41"]);
  });

  it("puts the shoe's usual colour and size first, starred", async () => {
    const form = await readFile(FORM, "utf8");
    const page = await readFile(PAGE, "utf8");
    expect(page).toContain("SELECT DISTINCT ON (item_id) item_id, color AS colour, size");
    expect(page).toContain("lastColour:");
    expect(form).toContain("currentItem?.lastSize");
    expect(form).toContain("currentItem?.lastColour");
    expect(form).toContain("★");
  });
});

describe("the layout", () => {
  it("fills a computer screen, with the day's entries on the right", async () => {
    const form = await readFile(FORM, "utf8");
    expect(form).not.toContain("max-w-5xl");
    expect(form).toContain("max-w-[1600px]");
    expect(form).toContain("lg:grid-cols-[minmax(0,1fr)_20rem]");
    expect(form).toContain("<TodayEntries");
  });

  it("gives every box one height through one class", async () => {
    const form = await readFile(FORM, "utf8");
    expect(form).toMatch(/const CONTROL =\s*"h-12 /);
    for (const id of ["work-worker", "work-stage", "work-item", "work-colour", "work-size"]) {
      const at = form.indexOf(`id="${id}"`);
      expect(at, id).toBeGreaterThan(0);
      expect(form.slice(at, at + 600), id).toContain("className={CONTROL}");
    }
  });

  it("keeps the rejects box one box of the grid, not the full width", async () => {
    const form = await readFile(FORM, "utf8");
    const at = form.indexOf('id="work-reject"');
    const block = form.slice(form.lastIndexOf("<div", at - 300), at);
    expect(block).not.toContain("col-span");
  });

  it("writes the day as a line, with today and yesterday one tap", async () => {
    const form = await readFile(FORM, "utf8");
    expect(form).toContain("toBikramSambatNepali(formData.date)");
    expect(form).toContain('text("Yesterday", "हिजो")');
    expect(form).toContain('text("Another day…", "अर्को मिति…")');
    // The calendar is still there for any other day.
    expect(form).toContain("<NepaliDateField");
  });
});

describe("the suggestions the owner took", () => {
  it("fills the last entry again with one press", async () => {
    const form = await readFile(FORM, "utf8");
    expect(form).toContain('text("Same as last", "अघिल्लो जस्तै")');
    expect(form).toContain("setLastEntry({");
  });

  it("asks before saving what the day already has", async () => {
    const form = await readFile(FORM, "utf8");
    const request = form.slice(form.indexOf("const requestSave"), form.indexOf("const cancelConfirm"));
    expect(request).toContain("(dayEntries ?? []).some(looksLikeForm)");
    expect(form).toContain("यो आज टिपिसकेको जस्तो छ।");
  });

  it("lists the day's entries with a total, and never reversed ones", async () => {
    const today = await readFile(TODAY, "utf8");
    expect(today).toContain('entry.status !== "reversed"');
    expect(today).toContain('text("Total", "जम्मा")');
    expect(today).toContain("/admin/factory/ledger");
  });
});

describe("the two tabs", () => {
  it("drops the form's grid when Post to stock is chosen", async () => {
    const form = await readFile(FORM, "utf8");
    // `lg:grid` sets display itself and beats the hidden attribute on a
    // computer, which left the form on screen above Post to stock. The class
    // has to go with the view, not only the attribute.
    expect(form).toContain(
      'className={view === "entry" ? "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6" : "hidden"}',
    );
    expect(form).not.toMatch(/hidden=\{view !== "entry"\} className="lg:grid/);
  });
});
