import { access, readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The admin pages speak to a Nepali reader, and two of them were not speaking
 * Nepali. "जल्दी शुरु", "तेजी को साथ", "अझ ढेर", "दबाऊ" — Hindi words and Hindi
 * grammar in the middle of Nepali sentences, plus "फेरिल्ट", which is not a word
 * in either language. Worse than the vocabulary, "गर" and "दबाऊ" are the
 * disrespectful imperative: the app was ordering its owner about.
 */
/**
 * Source with comments removed.
 *
 * The comment on the page deliberately names each shortcut it took out, and
 * matching prose would fail the moment a removal is explained well.
 */
function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|{\/\*).*$/gm, "");
}
async function adminPages(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...(await adminPages(path)));
    } else if (entry.name.endsWith(".tsx")) {
      found.push(path);
    }
  }

  return found;
}

const HINDI = ["जल्दी", "शुरु", "तेजी", "ढेर", "दबाऊ", "दबाएर", "फेरी", "को साथ", "फेरिल्ट"];

describe("the admin pages speak Nepali", () => {
  it("carries no Hindi in the getting started page", async () => {
    const page = await readFile("app/admin/getting-started/page.tsx", "utf8");

    for (const word of HINDI) {
      expect(page, word).not.toContain(word);
    }
  });

  it("has no Hindi anywhere under admin", async () => {
    const files = await adminPages("app/admin");
    expect(files.length).toBeGreaterThan(10);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const word of HINDI) {
        expect(source, `${word} in ${file}`).not.toContain(word);
      }
    }
  });
});

/**
 * Six shortcuts were documented and not one was built. `K` came closest and was
 * wrong twice: it is Ctrl+K, and the palette it opens is mounted on the
 * storefront navbar, not in admin. Pressing the keys did nothing, which reads
 * to the owner as a broken app rather than an unbuilt feature.
 */
describe("what the admin claims it can do", () => {
  it("does not teach shortcuts that were never built", async () => {
    const page = code(await readFile("app/admin/getting-started/page.tsx", "utf8"));

    expect(page).not.toContain("G then D");
    expect(page).not.toContain("Keyboard Shortcuts");
  });

  it("has no page documenting them either", async () => {
    // The page was reachable by URL and linked from nowhere at all.
    await expect(access("app/admin/keyboard-shortcuts/page.tsx")).rejects.toThrow();
  });
});

/**
 * The checklist was five hard-coded steps for a first week that ended months
 * ago, so every item stayed untickable forever — including "upload your first
 * products" on a shop with four, and a payments step pointing at a settings
 * page that has no such field, because those keys live in the host's
 * environment.
 */
describe("the checklist", () => {
  it("is read from the shop, not written down", async () => {
    const page = await readFile("app/admin/getting-started/page.tsx", "utf8");

    expect(page).toContain("getProducts");
    expect(page).toContain("product.stock > 0");
    // Every step decides its own tick from what the shop actually holds.
    expect(page).toContain("done:");
    expect(page).toContain("steps.filter((step) => !step.done)");
  });

  it("no longer sends the owner to a page that cannot do the job", async () => {
    const page = await readFile("app/admin/getting-started/page.tsx", "utf8");

    // eSewa and Khalti read ESEWA_* and KHALTI_* from the environment; there
    // has never been a field for them in /admin/settings.
    expect(page).not.toContain("eSewa");
    expect(page).not.toContain("Khalti");
  });
});
