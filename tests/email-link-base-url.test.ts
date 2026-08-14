import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { emailLinkBaseUrl } from "@/lib/email-links";

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
});

describe("emailLinkBaseUrl", () => {
  it("strips a trailing newline pasted into the hosting dashboard", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://krishoe-website.vercel.app\n";
    expect(emailLinkBaseUrl()).toBe("https://krishoe-website.vercel.app");
  });

  it("strips surrounding spaces and trailing slashes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "  https://krishoe.com//  ";
    expect(emailLinkBaseUrl()).toBe("https://krishoe.com");
  });

  it("falls back to localhost so reset links work while developing", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(emailLinkBaseUrl()).toBe("http://localhost:3000");
  });

  it("builds a reset link with no whitespace inside it", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://krishoe-website.vercel.app\n";
    const url = `${emailLinkBaseUrl()}/admin/reset-password?token=abc`;
    expect(url).toBe("https://krishoe-website.vercel.app/admin/reset-password?token=abc");
    expect(url).not.toMatch(/\s/);
  });
});

/**
 * The bug was four hand-written copies of the same helper, each of which
 * stripped a trailing slash but not a trailing newline. One copy sent staff
 * password resets; the others sent staff invitations and customer account mail.
 */
describe("server actions that email links", () => {
  const files = [
    "app/admin/access/actions.ts",
    "app/admin/settings/actions.ts",
    "app/account/actions.ts",
    "app/admin/customers/actions.ts",
  ];

  it("all build their base URL through the shared helper", async () => {
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, file).toContain("emailLinkBaseUrl");
      expect(source, file).not.toContain("process.env.NEXT_PUBLIC_SITE_URL");
    }
  });
});
