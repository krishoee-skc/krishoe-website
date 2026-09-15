import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The menu must say which branch this is, and how much of the business is
 * showing.
 *
 * It used to print the raw id — `branch-2c320048-7f5c-45f3-ae52-549b7d575533` —
 * inside a closed <details>. Three problems in one line: it had to be opened to
 * be seen, it named nothing a person recognises, and it said nothing about the
 * larger truth that every branch's rows were on screen anyway.
 *
 * That last part is the one that matters. The app connects as a role with
 * rolbypassrls, so Postgres skips the branch policies entirely and a Manager
 * signed into one branch is reading every branch's stock, wages and sales. That
 * is a real state of affairs nobody could see. A wall with a door in it should
 * be described as a wall with a door.
 */
const CARD = "components/admin/AdminIdentityCard.tsx";
const LAYOUT = "app/admin/layout.tsx";

describe("the branch the person is in", () => {
  it("shows the name, not the id", async () => {
    const card = await readFile(CARD, "utf8");

    expect(card, "the name must be accepted").toMatch(/branchName\??:\s*string/);
    expect(card, "and rendered").toContain("branchName");
  });

  it("falls back to the id when the name is unknown", async () => {
    const card = await readFile(CARD, "utf8");

    // A branch deleted from settings, or a session older than this change,
    // must still identify itself. Showing nothing would be worse than the id.
    expect(card, "the id is the fallback").toMatch(/branchName\s*(\|\||\?\?)/);
  });

  it("is open, not hidden behind a disclosure", async () => {
    const card = await readFile(CARD, "utf8");

    // Comments blanked first. The doc comment explains that this used to be a
    // <details>, and a test that reads prose would fail on the explanation
    // while passing on the markup — the same trap that let an earlier test in
    // this repo "catch" a bug that was only ever mentioned in a comment.
    const code = card.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The whole point is that it is visible without being asked for.
    expect(code, "no <details> around the branch").not.toContain("<details");
    expect(code, "no <summary> either").not.toContain("<summary");
  });

  it("marks a factory differently from a shop", async () => {
    const card = await readFile(CARD, "utf8");

    expect(card, "the type must reach the card").toMatch(/branchType/);
  });
});

describe("how much of the business is on screen", () => {
  it("says when every branch is visible", async () => {
    const card = await readFile(CARD, "utf8");

    expect(card, "the card must be told").toMatch(/seesAllBranches/);
  });

  it("warns staff below Owner, and does not warn the Owner", async () => {
    const card = await readFile(CARD, "utf8");

    // For the Owner this is by design — he owns every branch. For a Manager it
    // is a fact they should know, so the two read differently on purpose.
    expect(card, "the card distinguishes them").toContain("isOwner");
  });

  it("is worked out from the same rule that grants the exemption", async () => {
    const layout = await readFile(LAYOUT, "utf8");

    // allBranchAdminRole is the constant lib/admin-auth.ts uses to decide who
    // bypasses branch scoping. Deciding it a second way here would let the
    // screen keep saying "Owner" on the day the real rule changed.
    expect(layout).toContain("allBranchAdminRole");
  });
});

describe("what the card must not do", () => {
  it("never writes anything", async () => {
    const card = await readFile(CARD, "utf8");

    // Display only. No action, no fetch, no state — it renders what it is given.
    expect(card).not.toContain("useState");
    expect(card).not.toContain("fetch(");
    expect(card).not.toContain('"use client"');
  });
});
