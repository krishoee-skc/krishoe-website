import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { FACTORY_STAGES, normaliseWorkRow, stageTotals } from "@/lib/factory-board";

/**
 * Numbers drawn so a glance is enough.
 *
 * The owner asked for charts like the circular infographic they had seen. A
 * donut is the wrong tool for almost everything this shop counts — seven shoes
 * with exactly 60 pairs each become seven identical slices saying nothing — so
 * the shapes here are a stacked bar for part-to-whole and rows of bars for
 * magnitude, which carry a name and a number on every mark.
 *
 * The greens are one hue, light to dark, checked with the dataviz validator
 * against both surfaces. The first ramp tried FAILED its light end on the light
 * surface and was re-stepped; that is why the values are what they are.
 *
 * The stage bar is the one that earns its place today. All 420 pairs in the
 * shop are at Upper, the first of four stages, so nothing is finished and
 * nothing can be sold — a fact that took a database query to find and now shows
 * itself on the factory board.
 */
const SHARE = "components/admin/ShareBar.tsx";
const BOARD = "app/admin/factory/FactoryBoard.tsx";

function work(stage: string, pairs: number) {
  return normaliseWorkRow({
    worker_id: "w",
    worker_name: "w",
    item_id: "i",
    item_name: "i",
    stage,
    pairs_count: pairs,
    amount_earned: 1,
    status: "completed",
  });
}

describe("counting pairs by stage", () => {
  it("keeps every stage, including the ones at zero", () => {
    const totals = stageTotals([work("Upper", 420)]);

    // The zeroes are the finding. A chart of only the stages with work would
    // read "one stage, all done" — the opposite of the truth.
    expect(totals).toHaveLength(FACTORY_STAGES.length);
    expect(totals.find((row) => row.stage === "Upper")?.pairs).toBe(420);
    expect(totals.filter((row) => row.pairs === 0)).toHaveLength(3);
  });

  it("keeps the stages in the order a shoe passes through them", () => {
    expect(stageTotals([]).map((row) => row.stage)).toEqual([...FACTORY_STAGES]);
  });

  it("adds up several entries at the same stage", () => {
    const totals = stageTotals([work("Upper", 60), work("Upper", 60), work("Fiber Silai", 12)]);

    expect(totals.find((row) => row.stage === "Upper")?.pairs).toBe(120);
    expect(totals.find((row) => row.stage === "Fiber Silai")?.pairs).toBe(12);
  });

  it("counts a stage it does not recognise rather than dropping its pairs", () => {
    // Losing pairs from the total would make every share in the bar wrong.
    const totals = stageTotals([work("Upper", 60), work("Something New", 40)]);
    const sum = totals.reduce((n, row) => n + row.pairs, 0);

    expect(sum).toBe(100);
  });

  it("ignores an entry with no stage recorded", () => {
    expect(stageTotals([work("", 60)]).every((row) => row.pairs === 0)).toBe(true);
  });
});

describe("the bar itself", () => {
  it("says nothing rather than drawing an empty bar", async () => {
    const source = await readFile(SHARE, "utf8");

    // A bar of zeroes is a lie dressed as a chart.
    expect(source).toContain("total <= 0");
    expect(source).toContain("emptyLabel");
  });

  it("never leaves colour as the only way to read it", async () => {
    const source = await readFile(SHARE, "utf8");

    // Every segment and every row carries its name and its number as text.
    expect(source).toContain("{row.label}");
    expect(source).toContain('toLocaleString("en-IN")');
  });

  it("separates touching marks with a gap, not a border", async () => {
    const source = await readFile(SHARE, "utf8");

    expect(source).toContain("gap-0.5");
    expect(source).not.toMatch(/border-2|outline-2/);
  });

  it("uses one hue, light to dark, from the validated ramp", async () => {
    const source = await readFile(SHARE, "utf8");

    // Re-stepped after a real FAIL on the light end; these exact values pass.
    expect(source).toContain('"#7FBC9E"');
    expect(source).toContain('"#12634A"');
  });
});

describe("what the factory board shows", () => {
  it("draws where the pairs have reached", async () => {
    const board = await readFile(BOARD, "utf8");

    expect(board).toContain('layout="stack"');
    expect(board).toContain("जोडी कहाँ पुग्यो");
  });

  it("draws today's shoes as bars instead of a flat list", async () => {
    const board = await readFile(BOARD, "utf8");

    expect(board).toContain("<ShareBar");
    // The old list gave every shoe the same weight on the page.
    expect(board).not.toContain("flex items-center justify-between rounded bg-brand-paper-deep");
  });

  it("reads the stage from the database, or the bar would be all zeros", async () => {
    const data = await readFile("lib/factory-board-data.ts", "utf8");
    const select = data.slice(
      data.indexOf("SELECT w.worker_id"),
      data.indexOf("FROM factory_daily_work"),
    );

    // Pinned to the SELECT list, not to the file: "w.stage" also appears further
    // down in a different query's row mapping, and an earlier version of this
    // test passed with the column deleted from the SELECT because of it. Checked
    // by deleting it again.
    expect(select.length, "the day's work query moved").toBeGreaterThan(0);
    expect(select).toContain("w.stage");
  });
});
