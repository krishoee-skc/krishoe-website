import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { attentionByHref, type AttentionLevel } from "@/app/admin/nav-attention";

/**
 * The menu says which screen wants looking at.
 *
 * The shop already checks itself — eight checks, each with a severity and the
 * screen that puts it right — and the answers sit on /admin/alerts. That is a
 * screen you have to think to visit, so an unpriced product or an unanswered
 * customer waits there until somebody wonders. The owner's whole reason for
 * opening the admin is to find out what needs doing, and the app knows, and
 * says nothing until asked.
 *
 * So the menu carries a dot: the checks are grouped by the screen they point
 * at, and that screen's link is marked. Nothing new is computed and no new
 * question is asked of the database — the same eight answers, shown where the
 * choice is made rather than one click away.
 *
 * A dot, not a count. "3" beside Products reads as three products; the number
 * that matters is on the screen itself, and a badge that means something
 * different from what it looks like is worse than no badge.
 */

const CRITICAL = { severity: "critical" as const, href: "/admin/products" };
const WARNING = { severity: "warning" as const, href: "/admin/inbox" };
const INFO = { severity: "info" as const, href: "/admin/inbox" };

describe("which links get marked", () => {
  it("marks the screen a check points at", () => {
    const marks = attentionByHref([CRITICAL]);

    expect(marks.get("/admin/products")).toBe<AttentionLevel>("critical");
  });

  it("marks nothing when the shop is clean", () => {
    expect(attentionByHref([]).size).toBe(0);
  });

  it("keeps the worst level when a screen has several", () => {
    // Inbox can hold an unanswered review (warning) and a new message (info)
    // at once. The dot has one colour, and it has to be the one that matters:
    // showing the gentler of the two hides the reason to go.
    const marks = attentionByHref([INFO, WARNING]);

    expect(marks.get("/admin/inbox")).toBe<AttentionLevel>("warning");
  });

  it("lets critical beat warning, whichever order they arrive in", () => {
    const products = { severity: "critical" as const, href: "/admin/products" };
    const alsoProducts = { severity: "warning" as const, href: "/admin/products" };

    expect(attentionByHref([products, alsoProducts]).get("/admin/products")).toBe("critical");
    expect(attentionByHref([alsoProducts, products]).get("/admin/products")).toBe("critical");
  });

  it("marks a parent when the check points deeper", () => {
    // A lot waiting for QC points at
    // /admin/operations/production-accounts/lots, and no menu link goes that
    // deep. The dot belongs on "Operations", which is the link that leads
    // there — otherwise the one check nobody sees is the one furthest in.
    const marks = attentionByHref([
      { severity: "warning", href: "/admin/operations/production-accounts/lots" },
    ]);

    expect(marks.get("/admin/operations")).toBe<AttentionLevel>("warning");
  });

  it("does not mark a link that merely starts with the same letters", () => {
    // /admin/products must not be marked by a check on /admin/products-labels:
    // a prefix match on strings would, and the owner would be sent to the
    // wrong screen looking for something that is not there.
    const marks = attentionByHref([{ severity: "critical", href: "/admin/products-labels" }]);

    expect(marks.get("/admin/products")).toBeUndefined();
  });

  it("ignores a check with no screen to send anyone to", () => {
    const marks = attentionByHref([{ severity: "critical", href: "" }]);

    expect(marks.size).toBe(0);
  });

  it("never invents an admin link from a path outside the admin", () => {
    // The checks also describe the storefront. Without the guard, a shop path
    // is walked as though its segments were admin sections — "/shop/sandals"
    // becomes a mark on "/admin/sandals", a link that does not exist, and the
    // dot lands on whichever real link happens to share the name.
    expect(attentionByHref([{ severity: "critical", href: "/shop/sandals" }]).size).toBe(0);
    expect(attentionByHref([{ severity: "warning", href: "/product/abc" }]).size).toBe(0);
  });
});

describe("what the dot does not do", () => {
  it("never carries a number", async () => {
    const code = await readFile("app/admin/AdminNav.tsx", "utf8");
    const clean = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // "3" beside Products reads as three products. The count belongs on the
    // screen, where it has a sentence around it saying what was counted.
    const dot = clean.slice(clean.indexOf("attention"));
    expect(dot.length, "the dot is missing from the menu").toBeGreaterThan(0);
    expect(dot.slice(0, 1200), "the dot must not render a count").not.toMatch(
      /\{\s*(count|attention\.count|marks\.get\([^)]*\)\.count)\s*\}/,
    );
  });

  it("says in words what the dot means, for a screen reader", async () => {
    const code = await readFile("app/admin/AdminNav.tsx", "utf8");

    // A coloured circle is invisible to someone not looking at colour, and
    // this one is the app's only prompt to act.
    expect(code).toMatch(/Needs attention|ध्यान/);
  });
});
