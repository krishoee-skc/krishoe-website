import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { businessContact } from "@/lib/seo";

/**
 * Every wa.me link has to carry a number.
 *
 * One did not. The menu drawer built its link as
 * `wa.me/${number.replace(/[^d]/g, "")}` — a regex missing its backslash, so it
 * kept only the letter "d" and threw the digits away. The href was `wa.me/`
 * and tapping it went nowhere. The owner found it by trying to message the
 * shop from their own phone.
 *
 * [^d] and [^\d] differ by one character and read the same at a glance, which
 * is exactly why this is checked rather than reviewed.
 */

async function sources(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await sources(path, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

describe("links that open WhatsApp", () => {
  it("never strips the digits out of the number", async () => {
    const broken: string[] = [];

    for (const file of [...(await sources("app")), ...(await sources("components")), ...(await sources("lib"))]) {
      const source = await readFile(file, "utf8");
      for (const line of source.split("\n")) {
        // The one that keeps only the letter d. The correct form is [^\d].
        if (/replace\(\/\[\^d\]\/g/.test(line)) broken.push(`${file} · ${line.trim().slice(0, 70)}`);
      }
    }

    expect(
      broken.join("\n"),
      "This regex keeps the letter d and discards every digit",
    ).toBe("");
  });

  it("sends the shop's number with its country code", async () => {
    // wa.me will not accept a local ten-digit number; it needs 977 in front.
    expect(businessContact.whatsappNumber).toMatch(/^977\d{10}$/);
  });

  it("uses that number as it is stored, in the places that link to the shop", async () => {
    for (const file of ["components/Footer.tsx", "components/NavbarControls.tsx"]) {
      const source = await readFile(file, "utf8");
      expect(source, file).toContain("wa.me/${businessContact.whatsappNumber}");
    }
  });

  it("adds the country code to a customer's own number rather than assuming it", async () => {
    const inbox = await readFile("app/admin/inbox/page.tsx", "utf8");

    // Customers are stored as ten digits. Sending that to wa.me reaches nobody.
    expect(inbox).toContain('digits.length === 10 ? `977${digits}` : digits');
  });
});
