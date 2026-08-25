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

/**
 * Names, which are not English so much as spelling.
 *
 * The count exists to measure work left to do, and these are not work: the
 * brand and its motto are printed on the box, WhatsApp and Facebook are what
 * those apps are called in every language, and the "English" on the language
 * button has to say English or the reader who needs it cannot find it. Counting
 * them meant the number could never reach zero, which makes a ceiling test into
 * noise nobody acts on.
 */
const NAMES = new Set([
  "KRISHOE",
  "KRISHOE shop",
  "Walk with Authority",
  "WhatsApp",
  "Facebook",
  "Instagram",
  "TikTok",
  "English",
  "Viber",
]);

/** Visible English a Nepali reader would be shown, excluding names. */
function englishCount(source: string) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const between = (clean.match(/>[\s]*[A-Z][A-Za-z ,.'’!?&/-]{5,70}[\s]*</g) ?? []).filter(
    (match) => !NAMES.has(match.slice(1, -1).trim()),
  );
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

  it("shows the chosen language on the first paint, not the second", async () => {
    const provider = await readFile("components/LanguageProvider.tsx", "utf8");

    // The server sends English, because the pages are prerendered and it cannot
    // know one reader from another. Restoring the saved Nepali in useEffect
    // behind a setTimeout put it two frames away, so a shopper who had chosen
    // Nepali watched every page arrive in English and turn over in front of
    // them. A layout effect runs before the browser paints, so it is drawn
    // once, in the right language.
    expect(provider).toContain("useIsomorphicLayoutEffect(() => {");
    expect(provider).toContain('typeof window === "undefined" ? useEffect : useLayoutEffect');
    expect(provider).not.toContain("setTimeout(() => setLanguage");
  });

  it("is reachable from the navbar", async () => {
    const controls = await readFile("components/NavbarControls.tsx", "utf8");
    const shared = await readFile("components/LanguageSwitch.tsx", "utf8");

    // The shop uses the same control as the admin, factory and worker screens,
    // so one switch cannot end up spelled five ways across the app.
    expect(controls).toContain("LanguageSwitch");
    expect(shared).toContain('setLanguage("ne")');
    expect(shared).toContain('setLanguage("en")');
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

    // 227 when this was first measured. The ceiling is set to exactly what is
    // left, with no slack — slack is how a screen written in English only slips
    // in unnoticed, and at 115 against an actual 95 there was room for twenty
    // more before anything complained.
    //
    // What is left is largely what should stay: a bank's name and an account
    // name, which have to match letter for letter or money goes astray; "Ctrl
    // K", which is a key on a keyboard; and alt text on server components,
    // which cannot be translated without reading the language on the server and
    // costing every shopper the prerendered HTML.
    //
    // Lower it whenever a batch lands. Never raise it.
    expect(count).toBeLessThanOrEqual(23);
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

    expect(bar).toContain("<LanguageSwitch");
  });

  it("says the language rather than abbreviating it to two letters", async () => {
    const shared = await readFile("components/LanguageSwitch.tsx", "utf8");

    // "ने" asks a reader who does not read Devanagari to work out that it is a
    // button and then guess what it does — and that reader is the whole reason
    // the button exists. Both languages are named, and a tick marks the one
    // that is running, so neither half has to be guessed at.
    // The comment above the component names the old label, so read the code.
    const code = shared.replace(/\/\*[\s\S]*?\*\//g, "");

    expect(code).toContain("नेपाली");
    expect(code).toContain("ENGLISH");
    expect(code).not.toContain('"ने"');
    expect(code).toContain("aria-pressed");
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

/**
 * The switch in the other direction.
 *
 * Everything above counts English shown to a Nepali reader. Nothing counted the
 * reverse, and the reverse was worse: the terms, the privacy policy, the FAQ,
 * the wholesale page and order tracking were written in Devanagari with no
 * English half at all, so pressing EN changed the navbar and left the page it
 * framed unreadable. The owner found it before any test did.
 *
 * Devanagari is fine in a `text()` pair, in a `ne=` prop, or beside its own
 * English in one deliberate line. What is counted here is Devanagari standing
 * alone as the only thing an English reader is given.
 */

/** Nepali with no English half, on a screen a shopper walks through. */
function unpairedNepali(source: string) {
  const clean = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    // text("…", "…") — including the ones written across several lines
    .replace(/\btext\(\s*(["'`])[\s\S]*?\1\s*,\s*(["'`])[\s\S]*?\2\s*,?\s*\)/g, "")
    // ne="…" / ne={"…"} / ne={`…`}
    .replace(/\bne=\{?\s*(["'`])[\s\S]*?\1\s*\}?/g, "")
    // ne: "…", detailNe: "…", and the rest of that family
    .replace(/\b\w*[Nn]e:\s*(["'`])[\s\S]*?\1/g, "");

  return clean.split("\n").filter((line) => /[\u0900-\u097F]/.test(line)).length;
}

/**
 * The two screens whose whole job is to name the languages.
 *
 * A language switch has to print "ने" in Devanagari, and an invitation to read
 * the shop in Nepali has to be written in Nepali — that is the only form either
 * can take that works for the reader who needs it. Counting them would mean the
 * number could never reach zero, which turns a ceiling into noise nobody acts
 * on. Nothing else belongs on this list.
 */
const NAMES_THE_LANGUAGES = ["components/LanguageSwitch.tsx", "components/LanguageInvite.tsx"];

describe("how much of the shop an English reader cannot read", () => {
  it("is getting shorter, not longer", async () => {
    const files = [...(await screens("app")), ...(await screens("components"))].filter(
      (file) => !NAMES_THE_LANGUAGES.includes(file),
    );

    let count = 0;
    for (const file of files) count += unpairedNepali(await readFile(file, "utf8"));

    // 193 when this was first measured, across the pages a buyer reads before
    // trusting the shop. What is left is largely what should stay: the staff
    // login form, which is for the factory rather than for shoppers; the
    // language invitation, which has to be in Nepali to invite anyone into it;
    // and lines deliberately written in both at once, which the count above
    // cannot tell from a line written in one.
    //
    // Lower it whenever a batch lands. Never raise it.
    expect(count).toBeLessThanOrEqual(87);
  });

  it("leaves nothing unreadable on the pages that earn trust", async () => {
    // These four are where a first-time buyer decides. Each was Devanagari
    // only, top to bottom, with a language switch that did nothing to them.
    for (const file of [
      "app/faq/page.tsx",
      "app/terms/page.tsx",
      "app/privacy/page.tsx",
      "app/wholesale/page.tsx",
    ]) {
      const source = await readFile(file, "utf8");
      expect(unpairedNepali(source), file).toBeLessThanOrEqual(4);
    }
  });
});
