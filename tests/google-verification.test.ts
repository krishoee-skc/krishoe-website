import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The file that proves to Google this shop is ours.
 *
 * Google gives it a name, we serve it at the root, and Google fetches it to
 * confirm. Delete it or rename it and the verification lapses — Search Console
 * stops reporting, and with it the only way to see which pages Google holds,
 * what people searched to reach them, and whether any of the SEO work here made
 * a difference.
 *
 * It is one line, it looks like nothing, and it is easy to tidy away.
 */
const FILE = "public/googlec4363625c2b98a0d.html";

describe("proving the shop to Google", () => {
  it("keeps the file Google will come looking for", async () => {
    const contents = await readFile(FILE, "utf8");

    // Google checks the body, not only that something is served: the name and
    // the line inside have to agree.
    expect(contents.trim()).toBe("google-site-verification: googlec4363625c2b98a0d.html");
  });

  it("serves it from the root, where Google expects it", async () => {
    // Anything in public/ is served at the site root by Next. A file put
    // anywhere else answers 404 to the one request that matters.
    expect(FILE.startsWith("public/")).toBe(true);
  });

  it("is not blocked by robots", async () => {
    const robots = await readFile("app/robots.ts", "utf8");

    // Disallowing it would stop the crawler fetching the proof it was sent for.
    expect(robots).not.toContain("googlec4363625c2b98a0d");
  });
});
