import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const INVITE = "components/admin/PasskeyInvite.tsx";
const LOGIN = "components/AdminLoginForm.tsx";
const BUTTON = "components/PasskeySignInButton.tsx";
const LAYOUT = "app/admin/layout.tsx";

/**
 * The owner opened the admin on their iPhone and could not get in easily.
 *
 * Two things were in the way. The sign-in page told them "आफ्नै email … मालिकको
 * होइन" — do not use the owner's account — which they read on their own phone,
 * as the owner. And the passkey button said only that this device had none
 * registered, with no way to learn that registration happens on a screen called
 * Login devices, which they had no reason to have visited.
 *
 * The shop had zero passkeys registered on any device at the time. Not a bug —
 * a passkey has to be created on each device separately — but nothing ever
 * offered to create the first one.
 */
describe("what the sign-in page tells the owner", () => {
  it("no longer says the account they are using is the wrong one", async () => {
    const form = await readFile(LOGIN, "utf8");
    // Comments stripped: the removed line is quoted in one, explaining why it
    // went. Searching the raw file finds that quote and fails on the record of
    // the fix rather than on the fix.
    const shown = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    // The line was written to stop staff borrowing a login. It should not
    // confuse the person the login belongs to.
    expect(shown).not.toContain("मालिकको होइन");
    expect(shown).toContain("तपाईंलाई दिइएको email र password हाल्नुहोस्");
  });

  it("still tells a worker to set a password of their own", async () => {
    const form = await readFile(LOGIN, "utf8");

    // The instruction that matters — change it on the first visit — stays. What
    // went is "the password the owner gave you": a worker knows who gave it to
    // them, and naming the owner on a sign-in screen is what confused the owner
    // on the admin side.
    expect(form).toContain("पहिलो पटकमै आफ्नो नयाँ password राख्नुहोस्");
    expect(form).not.toContain("मालिकले दिएको");
  });

  it("says what to do next when this device has no passkey", async () => {
    const button = await readFile(BUTTON, "utf8");

    // "Not registered" alone leaves the reader stuck. Say why, and what
    // happens next.
    //
    // And say it in the reader's words: दर्ता is what happens at a government
    // counter, and it describes the filing rather than the thing the person
    // gains, which is that they stop typing a password. The owner asked whether
    // a good app would write it that way. It would not — Apple says "you can
    // now use Face ID to sign in", never "registered".
    // "यन्त्र" alone read as a phone to a reader holding a computer, so it
    // now names both. The promise is unchanged: say it is per-device, and say
    // where switching it on happens.
    expect(button).toContain("हरेक फोन वा computer मा एक पटक मिलाउनुपर्छ");
    expect(button).toContain("चालु गर्ने बाटो देखिन्छ");
    expect(button).not.toContain("दर्ता");
  });
});

describe("the offer to register this device", () => {
  it("comes after signing in, on the device being held", async () => {
    const layout = await readFile(LAYOUT, "utf8");

    expect(layout).toContain("<PasskeyInvite />");
  });

  it("does not appear where passkeys cannot work", async () => {
    const invite = await readFile(INVITE, "utf8");

    // An older browser, or a device with no authenticator at all.
    expect(invite).toContain("const supported = usePasskeySupport()");
    expect(invite).toContain("if (!supported) return;");
  });

  it("does not ask someone who already has one", async () => {
    const invite = await readFile(INVITE, "utf8");

    expect(invite).toContain("listPasskeysAction()");
    expect(invite).toContain("existing.length > 0) return;");
  });

  it("takes no for an answer", async () => {
    const invite = await readFile(INVITE, "utf8");

    // A card that returns after being dismissed is an advert.
    expect(invite).toContain('const ASKED_KEY = "krishoe-passkey-asked"');
    expect(invite).toContain("window.localStorage.setItem(ASKED_KEY");
  });

  it("names the unlock the way the device names it", async () => {
    const invite = await readFile(INVITE, "utf8");

    // Telling an iPhone owner about "Windows Hello" sends them looking for a
    // button that is not there.
    expect(invite).toContain("Face ID वा Touch ID");
    expect(invite).toContain("औंलाको छाप");
    expect(invite).toContain("Windows Hello");
  });

  it("says the password still works", async () => {
    const invite = await readFile(INVITE, "utf8");

    // This adds a way in. It does not replace one, and a reader deciding
    // whether to tap should not have to wonder.
    expect(invite).toContain("password पहिलेकै जस्तै चल्छ");
  });

  it("treats a cancelled prompt as a change of mind, not a failure", async () => {
    const invite = await readFile(INVITE, "utf8");

    expect(invite).toContain("} catch {");
    expect(invite).toContain("Settings → Login devices मा जानुहोस्");
  });
});

/**
 * The owner watched the card say "यो iPhone दर्ता भयो" and asked whether a good
 * app would write it that way.
 *
 * It would not. दर्ता is what happens at a government counter — it names the
 * filing, not the thing the person gained, and what they gained is the whole
 * point: they stop typing a password. Apple says "you can now use Face ID to
 * sign in". Nobody writes "registered".
 */
describe("the words on the passkey screens", () => {
  it("leads with what the person gets, not what was filed", async () => {
    const invite = await readFile(INVITE, "utf8");
    const shown = invite.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    // The headline after success, and the one asking — now bilingual, so the
    // benefit leads in whichever language the reader chose.
    expect(shown).toContain("ले खुल्छ");
    expect(shown).toContain("Now it opens with");
    expect(shown).toContain("password टाइप गर्नु पर्दैन");
  });

  it("keeps the filing-counter word out of every passkey screen", async () => {
    for (const file of [INVITE, BUTTON]) {
      const source = await readFile(file, "utf8");
      const shown = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

      expect(shown, file).not.toContain("दर्ता");
    }
  });

  it("leaves the device's own words in the device's own language", async () => {
    const invite = await readFile(INVITE, "utf8");

    // Face ID and Touch ID are what Apple prints on the phone. Translating them
    // sends the reader hunting for a Nepali label that does not exist — the
    // same rule the shop follows for Share and Install.
    expect(invite).toContain("Face ID वा Touch ID");
    expect(invite).toContain("Windows Hello");
  });
});
