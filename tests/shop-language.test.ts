import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The shop already had a language switch — LanguageProvider, a text() helper, a
 * <T> island for server components, and an EN/Ne button in the navbar — and it
 * reached about a tenth of the customer-facing screens. Pressing Ne turned half
 * a page Nepali and left the other half English, which reads worse than either
 * language alone: it looks like a shop that was abandoned halfway.
 *
 * These count what is left rather than trusting the eye, and hold the line so
 * new screens do not arrive in English only.
 */

async function screens(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (path.includes("/admin") || path.includes("/worker")) continue;
    if (entry.isDirectory()) await screens(path, out);
    else if (entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/** Visible English: text between tags, plus the attributes a reader sees. */
function englishCount(source: string) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const between = clean.match(/>[\s]*[A-Z][A-Za-z ,.'’!?&/-]{5,70}[\s]*</g) ?? [];
  const attrs = clean.match(/(?:placeholder|title|aria-label|alt)="[A-Z][^"]{5,70}"/g) ?? [];
  return between.length + attrs.length;
}

describe("the switch itself", () => {
  it("offers both languages and remembers the choice", async () => {
    const provider = await readFile("components/LanguageProvider.tsx", "utf8");

    expect(provider).toContain('type Language = "en" | "ne"');
    expect(provider).toContain('window.localStorage.setItem("krishoe-language"');
    // Screen readers and Google both read this attribute.
    expect(provider).toContain("document.documentElement.lang = language");
  });

  it("is reachable from the navbar", async () => {
    const controls = await readFile("components/NavbarControls.tsx", "utf8");

    expect(controls).toContain('setLanguage("ne")');
    expect(controls).toContain('setLanguage("en")');
  });

  it("can translate a server-rendered page without making it dynamic", async () => {
    const island = await readFile("components/T.tsx", "utf8");

    // Reading the language from a cookie would translate on the server and cost
    // every shopper the prerendered HTML the category pages serve today.
    expect(island).toContain('"use client"');
    expect(island).toContain("export default function T({ en, ne }");
  });
});

describe("how much of the shop the switch actually reaches", () => {
  it("covers the screens a shopper walks through", async () => {
    const walked = [
      "app/page.tsx",
      "app/shop/ShopCatalogControls.tsx",
      "app/order/[id]/page.tsx",
      "components/ContactForm.tsx",
      "components/account/AccountLoginForm.tsx",
      "components/About.tsx",
      "app/account/page.tsx",
      "components/NavbarControls.tsx",
      "components/account/AccountRegisterForm.tsx",
      "components/FeedbackForm.tsx",
      "components/PaymentInstructions.tsx",
    ];

    for (const file of walked) {
      const source = await readFile(file, "utf8");
      expect(source, file).toMatch(/<T\s|text\(/);
    }
  });

  it("is getting shorter, not longer", async () => {
    const files = [...(await screens("app")), ...(await screens("components"))];

    let count = 0;
    for (const file of files) count += englishCount(await readFile(file, "utf8"));

    // It was 227 when this was first measured. The number only ever comes
    // down; a new screen written in English only pushes it up and fails here.
    // Lower the ceiling whenever a batch lands, never raise it.
    expect(count).toBeLessThanOrEqual(175);
  });
});

/**
 * Not everything should translate. The brand is the brand.
 */
describe("what stays English on purpose", () => {
  it("keeps the name and the motto", async () => {
    const home = await readFile("app/page.tsx", "utf8");

    // Printed on the box and the signboard. A mark that changes with a toggle
    // is not a mark.
    expect(home).toContain("KRISHOE");
    expect(home).toContain("Walk with Authority");
    expect(home).not.toContain('ne="क्रिशू"');
  });

  it("keeps the words the phone owns", async () => {
    const share = await readFile("components/ShareProduct.tsx", "utf8");

    // Share, Install, Add to Home Screen are what the device says. Translating
    // them sends the reader looking for a Nepali button that is not there.
    expect(share).toMatch(/Share|share/);
  });
});
