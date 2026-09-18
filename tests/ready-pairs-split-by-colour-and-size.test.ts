import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * What is finished, counted per colour and size — not per shoe name.
 *
 * The ready-to-post figures grouped by item alone. That is fine while a shoe is
 * made in one colour and one run, and wrong the moment it is not: sixty black
 * uppers and sixty cherry bottoms grouped together read as "sixty pairs ready",
 * and sixty pairs of nothing get posted to stock.
 *
 * It is also what the whole automatic posting rests on. To put pairs in the
 * godown without anybody counting them, the app has to know which pairs — a
 * design, a colour and a size run — and "bagopen, sixty" is not that.
 *
 * The grouping uses the two keys built for this, so "Black" and "black" are one
 * colour and "36/41" and the chips' "36, 37, 38, 39, 40, 41" are one run. And
 * the arithmetic that was already right stays right: a pair is finished only
 * when every required stage has had it, so the smallest stage wins and a stage
 * with no entry counts as zero, never as "not required".
 */
const ROUTE = "app/api/factory/ready/route.ts";

describe("the work is grouped by what it actually is", () => {
  it("groups by colour and size run, not by item alone", async () => {
    const route = await readFile(ROUTE, "utf8");

    // Colour and size have to leave the database before they can group
    // anything — the query selected neither.
    expect(route, "colour must be read").toMatch(/work\.color/);
    expect(route, "size must be read").toMatch(/work\.size/);
  });

  it("uses the keys that make one spelling of each", async () => {
    const route = await readFile(ROUTE, "utf8");

    // Asserted as the key the grouping is actually built from, not as the
    // presence of the words: reverting to `groupKey = row.item_id` leaves both
    // imports in place, so a name check passes on the bug it exists to catch.
    //
    // Without these, "Black" and "black" are two groups and each shows half the
    // pairs — which is how this shop's own records already read.
    expect(route, "the group key must carry all three").toMatch(
      /groupKey\s*=\s*`\$\{row\.item_id\}[\s\S]{0,40}colourKey\([\s\S]{0,40}sizeRunKey\(/,
    );
  });

  it("still says which colour and size each group is", async () => {
    const route = await readFile(ROUTE, "utf8");

    // The owner is about to post these to stock. A row that cannot name its
    // own colour and size is not something anybody should press a button on.
    expect(route).toMatch(/colour:|color:/);
    expect(route).toMatch(/sizeRun:/);
  });
});

describe("the arithmetic that was already right", () => {
  it("still takes the smallest stage, never the sum", async () => {
    const route = await readFile(ROUTE, "utf8");
    const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Sixty uppers and sixty bottoms are sixty pairs. Summing them is the
    // mistake this screen exists to prevent.
    expect(code).toMatch(/Math\.min/);
    expect(code, "a missing stage counts as zero").toMatch(/\?\?\s*0/);
  });

  it("keeps both required stages named", async () => {
    const route = await readFile(ROUTE, "utf8");

    expect(route).toMatch(/REQUIRED_STAGES/);
    expect(route).toMatch(/"Upper"/);
    expect(route).toMatch(/"Fibermen"/);
  });
});

/**
 * What the screen does with rows that are no longer unique per shoe.
 *
 * One item can now appear more than once — black 36/41 and cherry 36/41 are two
 * rows of the same shoe. Everything the screen keyed on the item id would
 * collide between them: the same React key, the same draft box, the same
 * spinner on whichever was pressed.
 */
describe("the screen handles two rows of one shoe", () => {
  const SCREEN = "app/admin/factory/add-work/ReadyToPost.tsx";

  it("keys rows by the group, not the item", async () => {
    const screen = await readFile(SCREEN, "utf8");
    const code = screen.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Two rows sharing a React key is a rendering bug; two rows sharing a draft
    // box means typing 60 into one fills the other.
    expect(code, "no item-keyed rows").not.toMatch(/key=\{item\.itemId\}/);
    expect(code, "no item-keyed drafts").not.toMatch(/drafts\[item\.itemId\]/);
    expect(code).toContain("groupKeyOf(item)");
  });

  it("shows which colour and size each row is", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // Otherwise the owner is asked to press a button on two rows that look
    // identical.
    expect(screen).toMatch(/\{item\.colour\}/);
    expect(screen).toMatch(/\{item\.sizeRun\}/);
  });

  it("sends the size run with the pairs", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toMatch(/size_run:\s*item\.sizeRun/);
  });
});

describe("stock lands under the run it was made in", () => {
  it("no longer files everything as Mixed", async () => {
    const route = await readFile(ROUTE, "utf8");
    const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The Stock screen joins finished_stock to stock_locations on design *and*
    // size run. A 36/41 run filed as "Mixed" lands in a row nothing matches:
    // the pairs count, but the screen cannot say where they are — which is
    // exactly the "No place" the owner hit with the purchased pairs.
    expect(code, "sizeRun must come from the request").not.toMatch(/sizeRun:\s*"Mixed"/);
    expect(code).toMatch(/body\.size_run/);
    // Still "Mixed" for callers that send none, so nothing older breaks.
    expect(code).toMatch(/:\s*"Mixed"/);
  });
});
