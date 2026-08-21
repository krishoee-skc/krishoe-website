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
    //
    // Scoped to this image rather than the whole page: the logo above the form
    // is 150KB, is the first thing the owner looks at, and should load first.
    // A page-wide ban would have read as "never prioritise anything here",
    // which was never the point.
    const banner = page.slice(page.indexOf("/images/hero-banner.png"), page.indexOf("/>", page.indexOf("/images/hero-banner.png")));
    expect(banner).not.toContain("priority");
    expect(banner).toContain('loading="lazy"');
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

describe("caching the bootstrap check", () => {
  it("remembers only that the recovery login is closed", async () => {
    const source = code(await readFile("lib/admin-bootstrap-login.ts", "utf8"));

    // One-sided on purpose. Caching "closed" costs a few minutes of waiting
    // during first-time setup; caching "open" would leave a shared environment
    // password accepted for minutes after the first real Owner exists, which is
    // the window this check was written to shut.
    expect(source).toContain("unstable_cache");
    expect(source).toContain("(await activeOwnerCount()) > 0");
    expect(source).toContain("if (await rememberBootstrapClosed()) return false;");
  });

  it("re-checks the database before ever offering the recovery password", async () => {
    const source = code(await readFile("lib/admin-bootstrap-login.ts", "utf8"));
    const permissive = source.slice(source.indexOf("rememberBootstrapClosed()) return false"));

    // The permissive answer is the one that must not be stale.
    expect(permissive).toContain("activeOwnerCount: await activeOwnerCount()");
  });
});
