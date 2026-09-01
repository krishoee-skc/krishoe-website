import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The pages a shopper checks before trusting a shop they have never visited.
 *
 * /faq, /privacy, /terms and /track-order were all 404. For a shop where almost
 * every order is cash on delivery — the customer commits before any money moves
 * — that absence is a reason not to order. Meta and Google also want a privacy
 * policy before they trust an advertising account, so it blocked the campaigns
 * the pixel was installed for.
 */

const PAGES = ["faq", "privacy", "terms", "track-order"] as const;

describe("the trust pages", () => {
  it("all exist", async () => {
    for (const page of PAGES) {
      const source = await readFile(`app/${page}/page.tsx`, "utf8");
      expect(source, page).toContain("export default");
    }
  });

  it("are all reachable from the footer", async () => {
    const footer = await readFile("components/Footer.tsx", "utf8");
    // A page nobody links to is a page nobody finds. The footer builds its links
    // from a data list (href: "/faq") rendered as <Link href={link.href}>, so the
    // path is what proves it is linked — either quoting shape carries it.
    for (const page of PAGES) {
      expect(footer, page).toContain(`"/${page}"`);
    }
  });

  it("are all in the sitemap", async () => {
    const sitemap = await readFile("app/sitemap.ts", "utf8");
    for (const page of PAGES) {
      expect(sitemap, page).toContain(`/${page}\``);
    }
  });
});

describe("the FAQ", () => {
  it("carries FAQPage structured data", async () => {
    const faq = await readFile("app/faq/page.tsx", "utf8");

    // This is what lets Google show an answer to someone who has not clicked
    // anything — worth more to an unknown shop than any keyword tuning.
    expect(faq).toContain('"@type": "FAQPage"');
    expect(faq).toContain('"@type": "Question"');
    expect(faq).toContain('"@type": "Answer"');
  });

  it("answers what a cash-on-delivery shopper actually asks", async () => {
    const faq = await readFile("app/faq/page.tsx", "utf8");

    expect(faq).toContain("कति दिनमा");
    expect(faq).toContain("सामान पाएपछि पैसा");
    expect(faq).toContain("साइज मिलेन");
  });
});

/** Source with comments removed — a comment explaining a fix is not the fix. */
function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

describe("contact details on the policy pages", () => {
  it("never names an address that cannot receive mail", async () => {
    // The return policy told customers to write to a mailbox on a domain nobody
    // has registered. Someone asking to exchange a pair was writing to nowhere,
    // at the worst possible moment to be unreachable.
    for (const page of ["return-policy", "privacy", "terms", "faq"]) {
      const source = code(await readFile(`app/${page}/page.tsx`, "utf8"));
      expect(source, page).not.toContain("@krishoe.com");
    }
  });

  it("reads the real contact details from one place", async () => {
    for (const page of ["return-policy", "privacy", "terms"]) {
      const source = await readFile(`app/${page}/page.tsx`, "utf8");
      expect(source, page).toContain("businessContact");
    }
  });
});
