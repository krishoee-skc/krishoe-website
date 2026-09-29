import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * The owner's menu (2026-09-29): the identity card took about 290px — role,
 * name · email, the branch, a chooser and "All 2 branches visible" — so the
 * page list scrolled inside a small box, five of eleven pages in view, in
 * small pale letters. Now: one line for who and which branch, then the list in
 * bigger, darker, closer rows.
 */
describe("who is signed in, on one line", () => {
  it("puts the role and the branch chooser side by side", async () => {
    const card = code(await read("components/admin/AdminIdentityCard.tsx"));
    const row = card.slice(card.indexOf('<div className="flex items-center gap-2">'));
    expect(row.indexOf("{adminRole}")).toBeGreaterThan(-1);
    expect(row.indexOf("{branchSwitch}")).toBeGreaterThan(row.indexOf("{adminRole}"));
  });

  it("does not print the session's branch beside a chooser that names another", async () => {
    const card = code(await read("components/admin/AdminIdentityCard.tsx"));
    expect(card).toContain("{branchSwitch ? (");
    expect(card).toContain(") : branchLabel ? (");
  });

  it("still warns staff below Owner that every branch is on screen", async () => {
    const card = code(await read("components/admin/AdminIdentityCard.tsx"));
    expect(card).toContain("{seesAllBranches && !isOwner ? (");
  });

  it("lets the chooser say how many branches 'all' is", async () => {
    const chooser = await read("components/admin/BranchSwitch.tsx");
    expect(chooser).toContain("सबै ब्रान्च (${branches.length})");
  });
});

describe("the page list", () => {
  it("is 19px, in the ink colour, in rows about 40px apart", async () => {
    const nav = await read("app/admin/AdminNav.tsx");
    expect(nav).toContain('<span className="text-[19px]">{language === "ne" ? nepali : label}</span>');
    expect(nav).toContain("flex min-h-10 items-center gap-3 rounded-md px-2 py-0.5 font-bold");
    expect(nav).toContain('"text-brand-green-ink hover:bg-admin-hover');
    expect(nav).not.toContain('"text-brand-muted hover:text-brand-green-ink');
  });
});
