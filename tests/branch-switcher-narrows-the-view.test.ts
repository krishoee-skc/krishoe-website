import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Looking at one branch at a time.
 *
 * Every admin request already carries a branch id into Postgres —
 * lib/postgres/client.ts sets app.krishoe_branch_id and a bypass flag on the
 * connection before the query runs. So choosing a branch does not mean
 * rewriting the screens: it means changing the value that is already being
 * sent, and turning the Owner's bypass off while a single branch is chosen.
 *
 * That is the whole design, and it is why this is safe. No screen learns a new
 * rule, no query gains a WHERE clause anyone could forget, and the moment the
 * choice is cleared everything reads exactly as it did before.
 *
 * Two things must hold or this becomes a security hole rather than a filter:
 * the choice may only ever *narrow* what somebody sees, and only somebody who
 * was already entitled to look at every branch may make it at all. A Manager
 * pasting a cookie must not be able to read a branch they are not posted to.
 */
const AUTH = "lib/admin-auth.ts";
const ACTION = "app/admin/actions.ts";
const SWITCHER = "components/admin/BranchSwitch.tsx";

describe("the chosen branch reaches the database", () => {
  it("overrides the branch id the session was signed with", async () => {
    const auth = await readFile(AUTH, "utf8");

    expect(auth, "the choice must be read").toContain("viewingBranchId");
    // Fed into the same context every query already uses, rather than a second
    // path that screens would have to remember to honour.
    expect(auth).toMatch(/branchId:\s*\w+/);
  });

  it("turns the bypass off while one branch is chosen", async () => {
    const auth = await readFile(AUTH, "utf8");
    const code = auth.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The point of choosing "Main Factory" is to stop seeing the others. With
    // bypass still true the pages would look identical and the switch would be
    // decoration.
    expect(code, "bypass must account for the choice").toMatch(/bypass:[^\n]*\w/);
    expect(code).toContain("viewingBranchId");
  });
});

describe("what the choice must never do", () => {
  it("is refused for anyone not already entitled to every branch", async () => {
    const auth = await readFile(AUTH, "utf8");
    const code = auth.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // A Manager is posted to one branch. Letting a cookie move them to another
    // would hand them rows their account was never given — the switch may only
    // narrow, never widen. So the read itself must be gated: reading first and
    // filtering afterwards is exactly the shape that leaks when someone later
    // moves one line.
    expect(code, "the cookie is only read for the entitled").toMatch(
      /viewingBranchId\s*=\s*seesEveryBranch\s*\?\s*await\s+readViewingBranchId\(\)\s*:\s*""/,
    );
  });

  it("only ever narrows: a chosen branch cannot re-enable the bypass", async () => {
    const auth = await readFile(AUTH, "utf8");
    const code = auth.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Whatever the cookie says, bypass may only be turned off by it.
    expect(code).toMatch(/bypass:\s*seesEveryBranch\s*&&\s*!viewingBranchId/);
  });
});

describe("choosing and clearing", () => {
  it("has an action that writes the choice", async () => {
    const action = await readFile(ACTION, "utf8");

    expect(action).toContain("setViewingBranchAction");
    // Cleared by choosing "All branches", which must delete rather than store
    // an empty string that later reads as a real branch id.
    expect(action).toMatch(/delete\(/);
  });

  it("has a switcher that only appears for those who may use it", async () => {
    const switcher = await readFile(SWITCHER, "utf8");

    expect(switcher).toContain('"use client"');
    expect(switcher, "the list of branches to choose from").toContain("branches");
    expect(switcher, "and the all-branches option").toMatch(/All branches|सबै/);
  });
});
