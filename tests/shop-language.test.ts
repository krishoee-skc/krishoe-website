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
      // The pages a shopper reads before deciding to trust the shop at all.
      "app/return-policy/page.tsx",
      "app/about/page.tsx",
      "app/account/login/page.tsx",
      "app/wishlist/page.tsx",
      "app/error.tsx",
      "components/account/PasswordChangeForm.tsx",
      "components/account/ProfileEditForm.tsx",
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
    expect(count).toBeLessThanOrEqual(115);
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

/**
 * The translation existed and almost nobody saw it.
 *
 * The shop opened in English and the switch lived inside the menu drawer,
 * below the fold — several taps and a scroll from a shopper who did not know a
 * Nepali version existed in the first place. The work was done and hidden.
 */
describe("finding the Nepali", () => {
  it("is on the bar, not buried in a drawer", async () => {
    const controls = await readFile("components/NavbarControls.tsx", "utf8");
    const bar = controls.slice(0, controls.indexOf("Premium menu"));

    // Two characters wide, on every screen size — no lg: guard hiding it from
    // the phones most shoppers arrive on.
    expect(bar).toContain('setLanguage(language === "ne" ? "en" : "ne")');
    expect(bar).toContain('{language === "ne" ? "EN" : "ने"}');
  });

  it("asks once rather than guessing", async () => {
    const invite = await readFile("components/LanguageInvite.tsx", "utf8");

    // Most Nepali phones are set to English while their owners would rather
    // read Nepali: the phone reports the setting, not the preference. A
    // question is never wrong the way a guess can be.
    expect(invite).toContain("नेपालीमा हेर्नुहुन्छ?");
    expect(invite).toContain("Read this shop in Nepali?");
  });

  it("never asks a second time, whichever way it was answered", async () => {
    const invite = await readFile("components/LanguageInvite.tsx", "utf8");

    // Dismissing counts as answering: a card that returns is an advert.
    expect(invite).toContain('const ASKED_KEY = "krishoe-language-asked"');
    expect(invite).toContain("window.localStorage.setItem(ASKED_KEY");
    expect(invite).toContain("onClick={() => answer(null)}");
  });

  it("waits, and does not block the page", async () => {
    const invite = await readFile("components/LanguageInvite.tsx", "utf8");

    // Not a modal. A foreign or wholesale visitor ignores it and keeps
    // shopping in English, which is what they wanted anyway.
    expect(invite).toContain("const DELAY_MS = 2500");
    expect(invite).toContain("fixed inset-x-3 bottom-3");
  });

  it("survives a browser that refuses to store anything", async () => {
    const invite = await readFile("components/LanguageInvite.tsx", "utf8");

    expect(invite).toContain("} catch {");
  });

  it("is mounted where it can reach the language", async () => {
    const layout = await readFile("app/layout.tsx", "utf8");

    expect(layout).toContain("<LanguageInvite />");
    expect(layout.indexOf("<LanguageInvite />")).toBeGreaterThan(
      layout.indexOf("<LanguageProvider>"),
    );
  });
});

/**
 * global-error replaces the entire application — LanguageProvider included —
 * when everything else has failed. There is no context to read a preference
 * from, so it carries both languages at once.
 */
describe("the screen shown when everything breaks", () => {
  it("speaks both languages, because it cannot ask", async () => {
    const globalError = await readFile("app/global-error.tsx", "utf8");

    expect(globalError).toContain("केही अड्कियो");
    expect(globalError).toContain("We need a quick retry.");
    expect(globalError).toContain("फेरि प्रयास · Try again");
  });
});
