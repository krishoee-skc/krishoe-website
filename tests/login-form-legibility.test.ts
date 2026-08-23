import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A new Viewer could not sign in, and reported two things: the password box
 * looked dark, and the page appeared to be asking for the Owner's Gmail.
 *
 * Both were true. The card was `bg-white`, which globals.css repaints in dark
 * mode — while the inputs inside carried no background and no text colour at
 * all, so they took whatever the theme handed them. And the placeholder
 * literally read "owner@krishoe.com", which is exactly what a new member would
 * take it to mean.
 *
 * The sign-in screen is a fixed composition — a dark green hero with a
 * photograph and a white card on top — not a themed surface, so it states its
 * own colours.
 */
describe("the sign-in card", () => {
  it("keeps its own colours in either theme", async () => {
    const form = await readFile("components/AdminLoginForm.tsx", "utf8");

    // Not bg-white: globals.css rewrites that class under .dark, which turned
    // the card dark while the inputs stayed unstyled.
    expect(form).not.toMatch(/border-white\/15 bg-white/);
    expect(form).toContain("bg-[#FFFFFF]");
  });

  it("gives every input a background and an ink colour", async () => {
    const form = await readFile("components/AdminLoginForm.tsx", "utf8");
    const inputs = [...form.matchAll(/className="h-1[24][^"]*"/g)].map((match) => match[0]);

    expect(inputs.length).toBeGreaterThanOrEqual(3);
    for (const input of inputs) {
      expect(input, input).toContain("bg-[#FFFFFF]");
      expect(input, input).toContain("text-[#16211C]");
      expect(input, input).toContain("placeholder:text-");
    }
  });
});

describe("what the sign-in page asks for", () => {
  it("never names the Owner's address", async () => {
    const form = await readFile("components/AdminLoginForm.tsx", "utf8");
    // A new member read "owner@krishoe.com" as being asked for the Owner's
    // login rather than their own, and stopped.
    expect(form).not.toContain("owner@krishoe.com");
  });

  it("says whose details are wanted, in Nepali", async () => {
    const form = await readFile("components/AdminLoginForm.tsx", "utf8");

    // This used to require "मालिकको होइन" — do not use the owner's account —
    // because a new member had read an example address as being asked for the
    // owner's login. It fixed that and created the opposite problem: the owner
    // opened the admin on their iPhone, read that the account they were about
    // to use was the wrong one, and stopped.
    //
    // Saying whose details are wanted is still the point. Saying whose are not
    // is what went wrong, in both directions.
    expect(form).toContain("तपाईंलाई दिइएको email र password हाल्नुहोस्");
    expect(form).toContain("आफ्नै खाता चलाउनुहोस्");
    expect(form).not.toContain("मालिकको होइन");
  });

  it("does not tell a worker whose password they are holding", async () => {
    const form = await readFile("components/AdminLoginForm.tsx", "utf8");
    const qr = await readFile("app/admin/hr/worker-portal-qr/page.tsx", "utf8");

    // Same fix, same reason. A worker signing in does not need to be told the
    // owner handed the password over — they were there. What they need is to
    // change it, which is what these say now.
    expect(form).not.toContain("मालिकले दिएको password");
    expect(qr).not.toContain("मालिकले दिएको पुरानो");
  });
});
