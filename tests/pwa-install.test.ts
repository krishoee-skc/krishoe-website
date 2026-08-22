import { readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

const CARD = "components/PwaInstallHelp.tsx";

/** Source with comments removed — the fix's own comment names what it took out. */
function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|{\/\*).*$/gm, "");
}

/**
 * KRISHOE has been installable since the manifest and service worker were
 * written: standalone display, offline pages, push, its own icons. What it
 * never did was ask. Chrome offers a real one-press install through
 * beforeinstallprompt and the event was going unused, so a shopper who would
 * have tapped a button was told to go hunting in a browser menu — which almost
 * nobody does.
 */
describe("putting KRISHOE on a phone", () => {
  it("takes Chrome's offer instead of leaving it on the floor", async () => {
    const card = await readFile(CARD, "utf8");

    expect(card).toContain('addEventListener("beforeinstallprompt"');
    // Kept, not left to Chrome's own strip at the bottom, which most people
    // close without reading.
    expect(card).toContain("event.preventDefault()");
    expect(card).toContain("installer.prompt()");
  });

  it("offers the button only where the browser has one", async () => {
    const card = await readFile(CARD, "utf8");

    // A button that opens nothing is worse than the sentence it replaced.
    expect(card).toContain("{installer ? (");
    // Safari has no equivalent, so iOS keeps the words.
    expect(card).toContain("Add to Home Screen");
  });

  it("stops offering once it is installed", async () => {
    const card = await readFile(CARD, "utf8");

    expect(card).toContain('addEventListener("appinstalled"');
    expect(card).toContain("display-mode: standalone");
  });

  it("never covers a sign-in form", async () => {
    const card = await readFile(CARD, "utf8");

    // It once landed across the password field and half the Unlock button.
    expect(card).toContain("SIGN_IN_PATHS.includes(pathname)");
  });

  it("leaves the phone's own words in English", async () => {
    const card = await readFile(CARD, "utf8");

    // "Share" and "Install app" are printed on the phone's menu; translating
    // them sends the reader looking for a label that is not there.
    expect(card).toContain("Install app");
    expect(card).toContain("tap Share");
  });
});

/**
 * The owner asked for the crown and the name together. In the artwork the
 * wordmark is a sixth of the height, which at icon size lands two pixels tall
 * and reads as a smudge — so the icon is re-laid out for a square rather than
 * shrunk into one, and the name is given a third of it.
 */
describe("the icon on the home screen", () => {
  it("is square and the size the manifest promises", async () => {
    for (const [file, size] of [
      ["public/icons/icon-192.png", 192],
      ["public/icons/icon-512.png", 512],
      ["public/icons/icon-maskable-512.png", 512],
      ["app/apple-icon.png", 180],
    ] as const) {
      const meta = await sharp(file).metadata();
      expect(meta.width, file).toBe(size);
      expect(meta.height, file).toBe(size);
    }
  });

  it("keeps the maskable one to the crest alone", async () => {
    // A launcher crops this to whatever shape it prefers — a circle on most
    // Android phones — and a circle takes the word off.
    const maskable = await sharp("public/icons/icon-maskable-512.png").stats();
    const square = await sharp("public/icons/icon-512.png").stats();

    // The crest sits on brand green; the lockup sits on the artwork's black.
    expect(maskable.channels[1].mean).toBeGreaterThan(square.channels[1].mean);
  });

  it("stays small enough to fetch before anything else", async () => {
    for (const file of [
      "public/icons/icon-192.png",
      "public/icons/icon-512.png",
      "app/apple-icon.png",
    ]) {
      expect((await stat(file)).size, file).toBeLessThan(120 * 1024);
    }
  });
});

/**
 * The shop is run from a computer at the desk as much as from a phone on the
 * factory floor, and Chrome and Edge on Windows install a PWA exactly the way
 * Android does. The card was hidden there twice over — `lg:hidden` in the
 * markup, and a platform check that returned null for anything that was not a
 * phone — so a computer was never offered the app at all.
 */
describe("installing on a computer", () => {
  it("is offered, not hidden on wide screens", async () => {
    const card = await readFile(CARD, "utf8");

    expect(card).toContain('"desktop"');
    expect(code(card)).not.toContain("lg:hidden");
  });

  it("points at the control a desktop actually has", async () => {
    const card = await readFile(CARD, "utf8");

    // There is no Share sheet on Windows; the install control lives in the
    // address bar.
    expect(card).toContain("Install icon in the address bar");
  });

  it("does not tell a computer it is a phone", async () => {
    const card = await readFile(CARD, "utf8");

    expect(card).toContain('KRISHOE computer मा राख्नुहोस्');
  });
});
