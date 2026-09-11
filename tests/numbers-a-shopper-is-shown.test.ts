import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A promise printed beside the price has to be the promise the shop keeps.
 *
 * The product page used to carry three reassurances — "Cash on delivery
 * available", "WhatsApp support for sizing" — all true and none of them a
 * number. A shopper deciding on a pair wants the number: how many days until
 * it arrives, how many days to send it back. Both numbers already existed, in
 * the FAQ and the return policy, just not at the moment of deciding.
 *
 * Moving them next to the price means the same fact is now written in two
 * places, and two places drift. This test is what stops that: change the return
 * window in the policy and this fails until the strip is changed too.
 */
const STRIP = "components/TrustStrip.tsx";
const FAQ = "app/faq/page.tsx";
const RETURNS = "app/return-policy/page.tsx";

describe("the four facts beside the price", () => {
  it("promises the delivery time the FAQ promises", async () => {
    const strip = await readFile(STRIP, "utf8");
    const faq = await readFile(FAQ, "utf8");

    // "Usually 1–2 days inside Narayangadh and Bharatpur, and 3–5 days
    // elsewhere in Nepal."
    expect(faq).toContain("1–2 days");
    expect(faq).toContain("3–5 days");
    expect(strip).toContain("1-2 days");
    expect(strip).toContain("3-5");
  });

  it("promises the return window the return policy promises", async () => {
    const strip = await readFile(STRIP, "utf8");
    const policy = await readFile(RETURNS, "utf8");

    expect(policy).toContain("within 7 days");
    expect(strip).toContain("7 days");
    expect(strip).toContain("७ दिन");
  });

  it("promises cash on delivery, which checkout really offers", async () => {
    const strip = await readFile(STRIP, "utf8");
    const commerce = await readFile("lib/commerce.ts", "utf8");

    expect(commerce).toContain("Cash on delivery");
    expect(strip).toContain("Pay on delivery");
  });

  it("says where the shoes are made, matching the shop's own address", async () => {
    const strip = await readFile(STRIP, "utf8");
    const seo = await readFile("lib/seo.ts", "utf8");

    expect(seo).toContain("Narayangadh");
    expect(strip).toContain("Narayangadh");
  });

  it("says all four in Nepali too, since the shop is read in both", async () => {
    const strip = await readFile(STRIP, "utf8");

    // A shopper reading Nepali must not meet an English-only reassurance.
    for (const nepali of ["हातले बनेको", "१–२ दिन", "पाएपछि तिर्ने", "७ दिन"]) {
      expect(strip, nepali).toContain(nepali);
    }
  });

  it("replaced the old strip rather than sitting beside it", async () => {
    const page = await readFile("app/product/[id]/page.tsx", "utf8");

    // Two strips of reassurance under one price is noise, not trust.
    expect(page).toContain("<TrustStrip />");
    expect(page).not.toContain("WhatsApp support for sizing");
  });
});
