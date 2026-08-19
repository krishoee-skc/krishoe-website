import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * How long the sign-in page takes to appear on a phone.
 *
 * It is the first KRISHOE screen anyone reaches on mobile, and it was the
 * slowest page on the site — one and a half to three seconds, against under
 * half a second for the shop. Two causes, both of them work done before the
 * form could be shown.
 */

/** Source with comments stripped: these checks are about code, not prose. */
function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

describe("counting Owners", () => {
  it("asks the database for the number instead of loading everything", async () => {
    const source = code(await readFile("lib/admin-bootstrap-login.ts", "utf8"));

    // This runs on every render of the sign-in page and needs one integer. It
    // used to get it by loading the entire settings snapshot — every staff
    // account, every branch, every preference — and taking a length.
    expect(source).toContain("count(*)::int AS owners");
    expect(source).toContain("status = 'Active' AND role = 'Owner'");
  });

  it("still falls back to the full read rather than to a locked door", async () => {
    const source = code(await readFile("lib/admin-bootstrap-login.ts", "utf8"));
    // A schema this does not expect should cost speed, never access.
    expect(source).toContain("getAdminSettings()");
  });

  it("keeps the rule itself unchanged", async () => {
    const { shouldAllowAdminBootstrapLogin } = await import("@/lib/admin-bootstrap-login");

    // The recovery password is only available when no Owner exists to use
    // instead. Making the count cheaper must not make it looser.
    expect(
      shouldAllowAdminBootstrapLogin({ activeOwnerCount: 0, explicitRecoveryOverride: false }),
    ).toBe(true);
    expect(
      shouldAllowAdminBootstrapLogin({ activeOwnerCount: 1, explicitRecoveryOverride: false }),
    ).toBe(false);
    expect(
      shouldAllowAdminBootstrapLogin({ activeOwnerCount: 3, explicitRecoveryOverride: false }),
    ).toBe(false);
  });
});

describe("the photograph behind the form", () => {
  it("does not make the sign-in fields wait for it", async () => {
    const page = code(await readFile("app/(admin-auth)/admin/login/page.tsx", "utf8"));

    // 909KB, shown at 35% opacity under a near-opaque gradient. `priority`
    // told the browser to fetch it before the things people came for.
    expect(page).not.toContain("priority");
    expect(page).toContain('loading="lazy"');
  });

  it("is not announced to someone who cannot see it", async () => {
    const page = code(await readFile("app/(admin-auth)/admin/login/page.tsx", "utf8"));
    expect(page).toContain("aria-hidden");
    expect(page).toContain('alt=""');
  });
});

describe("text on the dark install prompt", () => {
  it("names its own colour instead of inheriting one", async () => {
    const prompt = await readFile("components/PwaInstallHelp.tsx", "utf8");

    // globals.css sets `p { color: var(--ink-body) }`. A rule matching the
    // element directly beats a colour inherited from a parent, so this heading
    // rendered in dark ink on a dark green card and could not be read at all —
    // while the line under it, which names its own colour, was fine.
    const paragraphs = [...prompt.matchAll(/<p className="([^"]*)"/g)].map((m) => m[1]);

    expect(paragraphs.length).toBeGreaterThan(1);
    for (const className of paragraphs) {
      expect(className, className).toMatch(/text-white/);
    }
  });
});
