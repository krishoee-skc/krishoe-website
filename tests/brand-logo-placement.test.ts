import { access, readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const LOGIN = "app/(admin-auth)/admin/login/page.tsx";
const BILL = "app/admin/pos/[id]/page.tsx";
const MAIL = "lib/notifications.ts";

function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

/**
 * KRISHOE's logo is set on black. That is why it looks the way it does, and it
 * is also why it cannot go everywhere: on a white ground it prints as a slab.
 * The full lockup goes where the ground is already dark and there is room for
 * the wordmark to be read; the crest alone goes everywhere else.
 */
describe("the full lockup", () => {
  it("greets the owner on a dark ground, with no heavy image to wait on", async () => {
    const page = await readFile(LOGIN, "utf8");

    // The admin sign-in was rebuilt as a secure-terminal doorway: a CSS gold
    // monogram on a deep-green gradient, no logo-full.webp and no 909KB
    // photograph behind it. So the ground is dark and the fields never wait on
    // an image — the outcome the two old image tests were protecting, reached
    // by removing the images rather than ordering their load.
    expect(page).toContain("#0b2e22");
    expect(page).not.toContain("/images/logo-full.webp");
    expect(page).not.toContain("/images/hero-banner.png");
  });

  it("stays off the printed bill", async () => {
    const bill = code(await readFile(BILL, "utf8"));

    // A black slab at the top of every bill drinks ink and cockles the paper.
    expect(bill).not.toContain("logo-full");
    expect(bill).toContain("/images/logo-mark.png");
  });
});

describe("the bill", () => {
  it("carries the crest small, and a rule instead of a picture", async () => {
    const bill = await readFile(BILL, "utf8");
    const header = bill.slice(bill.indexOf("receipt-print"));

    expect(header).toContain("h-9 w-9");
    // Thin lines and white space are what make a document look expensive.
    expect(header).toContain("border-brand-gold/60");
  });
});

/**
 * Gmail and most webmail block remote images until the reader asks for them, so
 * an HTML-only message arrives as an empty frame.
 */
describe("email", () => {
  it("keeps the plain text it always sent", async () => {
    const mail = await readFile(MAIL, "utf8");

    expect(mail).toContain("textContent: message");
    expect(mail).toContain("htmlContent: brandedEmailHtml");
  });

  it("uses a format every client can draw", async () => {
    const mail = await readFile(MAIL, "utf8");

    // Outlook and several webmail clients still do not render WebP.
    expect(mail).toContain("/images/logo-email.png");
    expect(mail).not.toContain("logo-email.webp");
    await expect(access("public/images/logo-email.png")).resolves.toBeUndefined();
  });

  it("escapes what people typed", async () => {
    const mail = await readFile(MAIL, "utf8");
    const builder = mail.slice(mail.indexOf("function brandedEmailHtml"));

    // An order note carries a customer's name and a design name, from a form
    // anyone on the internet can fill.
    expect(mail).toContain("function escapeHtml");
    expect(builder.slice(0, 1600)).toContain("escapeHtml(title)");
    expect(builder.slice(0, 1600)).toContain("escapeHtml(block)");
  });
});

describe("the files themselves", () => {
  it("stay small enough to send and to load", async () => {
    const full = await stat("public/images/logo-full.webp");
    const email = await stat("public/images/logo-email.png");

    expect(full.size).toBeLessThan(400 * 1024);
    // Downloaded on a mobile connection before the message can be read.
    expect(email.size).toBeLessThan(150 * 1024);
  });
});
