import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The AI is allowed to write words. It is not allowed to do anything else.
 *
 * Google's free tier trains on what is sent to it. That is an acceptable price
 * for a shoe's name and its price — both are already printed on the public
 * website — and an unacceptable one for a customer's phone number, a supplier's
 * cost, or a worker's wage. The line between those two is not a policy anybody
 * remembers under pressure; it has to be a thing the code cannot cross.
 *
 * These tests are that line. They check the two directions separately, because
 * they fail in different ways:
 *
 *   Outward — what leaves the server. A leak here is permanent: sent is sent,
 *   and no later fix un-trains a model.
 *
 *   Inward — what comes back. A model that invents a warranty writes a claim a
 *   customer can hold the shop to, into a box the owner may not read closely.
 */

vi.mock("@/lib/ai/gemini", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/gemini")>("@/lib/ai/gemini");
  return { ...actual, askGemini: vi.fn() };
});

const { askGemini } = await import("@/lib/ai/gemini");
const { draftProductCopy, draftableFields } = await import("@/lib/ai/product-copy");
const asked = vi.mocked(askGemini);

/** A product with a secret in every field the drafter is not supposed to read. */
function shoe(overrides: Record<string, unknown> = {}) {
  return {
    id: "p-1",
    sku: "SKU-9",
    name: "T bag open",
    category: "Ladies Sandals",
    categorySlug: "ladies-sandals",
    price: "Rs. 650",
    priceValue: 65000,
    wholesalePriceValue: 41000,
    minWholesaleQty: 12,
    image: "/uploads/secret-photo.jpg",
    gallery: ["/uploads/another.jpg"],
    badge: "Limited",
    rating: "4.8",
    description: "",
    descriptionNe: "",
    longDescription: "",
    longDescriptionNe: "",
    material: "Synthetic",
    fit: "Regular",
    colors: ["Black"],
    sizes: ["36", "37"],
    stock: 54,
    highlights: [],
    care: [],
    reviews: [{ id: "r1", name: "Sita Gurung", rating: 5, comment: "9845000000" }],
    status: "Active",
    featured: false,
    bestSeller: false,
    newArrival: false,
    ...overrides,
  } as never;
}

function answers(draft: Record<string, string>) {
  asked.mockResolvedValue({
    ok: true,
    text: JSON.stringify(draft),
    model: "test-model",
    tookMs: 10,
    tokensIn: 1,
    tokensOut: 1,
  });
}

/** The prompt as it was actually sent to Google on the last call. */
function sentPrompt() {
  return asked.mock.calls.at(-1)?.[0] ?? "";
}

beforeEach(() => {
  asked.mockReset();
});

describe("what leaves the server", () => {
  it("sends the shoe facts that are already on the public website", async () => {
    answers({ description: "A sandal." });
    await draftProductCopy(shoe(), ["description"]);

    const prompt = sentPrompt();
    expect(prompt).toContain("T bag open");
    expect(prompt).toContain("Ladies Sandals");
    expect(prompt).toContain("Rs. 650");
    expect(prompt).toContain("Synthetic");
  });

  it("never sends the wholesale price, the stock count or the cost side", async () => {
    answers({ description: "A sandal." });
    await draftProductCopy(shoe(), ["description"]);

    const prompt = sentPrompt();
    // What a competitor would want and a customer never sees.
    expect(prompt).not.toContain("41000");
    expect(prompt).not.toContain("wholesale");
    expect(prompt).not.toContain("54");
    expect(prompt).not.toContain("SKU-9");
  });

  it("never sends a customer's name or number, even from a review", async () => {
    answers({ description: "A sandal." });
    await draftProductCopy(shoe(), ["description"]);

    const prompt = sentPrompt();
    expect(prompt).not.toContain("Sita Gurung");
    expect(prompt).not.toContain("9845000000");
  });

  /**
   * The one that matters in a year's time.
   *
   * Every leak above is a field somebody thought about. This is the field
   * nobody thought about — a column added to Product long after this file was
   * written, by someone who never read it. `describe()` lists what it sends
   * rather than subtracting what it must not, so a new column is absent by
   * default instead of present by default.
   */
  it("says nothing about a field invented after this was written", async () => {
    answers({ description: "A sandal." });
    await draftProductCopy(
      shoe({ supplierCostPaisa: 31000, ownerNote: "borrowed from Ram dai" }),
      ["description"],
    );

    const prompt = sentPrompt();
    expect(prompt).not.toContain("31000");
    expect(prompt).not.toContain("Ram dai");
  });

  it("builds the payload by listing, not by subtracting", () => {
    const source = readFileSync("lib/ai/product-copy.ts", "utf8");
    const describe = source.slice(source.indexOf("function describe("), source.indexOf("const ASKS"));

    // A spread would carry every future column with it. This is the shape the
    // test above depends on, checked directly so the reason survives a rewrite.
    expect(describe).not.toContain("...product");
    expect(describe).not.toContain("Object.entries(product)");
    expect(describe).not.toContain("JSON.stringify(product");
  });
});

describe("what comes back", () => {
  const promises: [string, string][] = [
    ["a warranty", "Comes with a 1 year warranty."],
    ["a guarantee", "Quality guaranteed for every pair."],
    ["a refund", "Full refund if you do not like them."],
    ["free delivery", "Free delivery anywhere in Nepal."],
    ["next-day delivery", "Next-day delivery in Bharatpur."],
    ["waterproofing", "Fully waterproof in the monsoon."],
    ["leather it is not", "Made from genuine leather."],
    ["a discount", "Now at a 20% discount."],
    ["a Nepali guarantee", "एक वर्षको ग्यारेन्टी सहित।"],
    ["a Nepali refund", "मन नपरे पैसा फिर्ता गरिन्छ।"],
    ["Nepali free delivery", "नेपालभरि नि:शुल्क ढुवानी।"],
  ];

  for (const [what, sentence] of promises) {
    it(`throws away a draft promising ${what}`, async () => {
      answers({ description: sentence, longDescription: "A plain black sandal." });
      const result = await draftProductCopy(shoe(), ["description", "longDescription"]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.draft.description).toBeUndefined();
      expect(result.dropped).toContain("description");
      // The clean one beside it is kept — one bad sentence is not a failed run.
      expect(result.draft.longDescription).toBe("A plain black sandal.");
    });
  }

  /**
   * A wrong price is obvious. A wrong name is not.
   *
   * The first real draft against the live catalog came back calling the shop
   * कृसु — a plausible Nepali transliteration of KRISHOE, which reads perfectly
   * well and is a different business.
   */
  it("throws away a draft that spells the shop's name in Nepali script", async () => {
    answers({ descriptionNe: "कृसुको आफ्नै कारखानामा बनेको कालो स्याण्डल।" });
    const result = await draftProductCopy(shoe(), ["descriptionNe"]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason.ne).toContain("वाचा");
    expect(result.reason.en).toContain("promised");
  });

  it("keeps the name in Latin letters inside Nepali prose", async () => {
    answers({ descriptionNe: "KRISHOE को आफ्नै कारखानामा बनेको कालो स्याण्डल।" });
    const result = await draftProductCopy(shoe(), ["descriptionNe"]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.descriptionNe).toContain("KRISHOE");
  });

  it("ignores a field it was not asked for, however confidently offered", async () => {
    answers({ description: "A sandal.", price: "Rs. 100", stock: "999" });
    const result = await draftProductCopy(shoe(), ["description"]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.draft)).toEqual(["description"]);
  });

  it("says so plainly when the model answers with something that is not JSON", async () => {
    asked.mockResolvedValue({
      ok: true,
      text: "Sure! Here is your description:",
      model: "test-model",
      tookMs: 5,
      tokensIn: 1,
      tokensOut: 1,
    });

    const result = await draftProductCopy(shoe(), ["description"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason.ne).toContain("पढ्न सकिएन");
  });
});

describe("words already written are never replaced", () => {
  it("asks only for the fields standing empty", async () => {
    answers({ descriptionNe: "नयाँ।" });

    await draftProductCopy(
      shoe({ description: "Already written by the owner.", material: "Synthetic" }),
    );

    const prompt = sentPrompt();
    // Both are non-empty on this product, so neither is up for drafting.
    expect(prompt).not.toContain(`"description":`);
    expect(prompt).not.toContain(`"material":`);
    expect(prompt).toContain(`"descriptionNe":`);
  });

  it("refuses the whole run when there is nothing left to fill", async () => {
    const full = Object.fromEntries(draftableFields.map((field) => [field, "written"]));
    const result = await draftProductCopy(shoe({ ...full, highlights: ["a"], care: ["b"] }));

    expect(result.ok).toBe(false);
    expect(asked).not.toHaveBeenCalled();
  });

  it("fills only empty boxes in the browser too, checked after the round trip", () => {
    const button = readFileSync("app/admin/AiDraftButton.tsx", "utf8");

    // The gap that matters is the ten seconds the model is thinking, during
    // which the owner can start typing into the very box about to be filled.
    expect(button).toContain("if (!input || input.value.trim()) continue;");
    expect(button).toContain("before.current.set(field, input.value)");
  });
});

describe("the shop works with the AI absent", () => {
  it("answers rather than throwing when there is no key", async () => {
    const actual = await vi.importActual<typeof import("@/lib/ai/gemini")>("@/lib/ai/gemini");
    const key = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      expect(actual.isAiConfigured()).toBe(false);
      const result = await actual.askGemini("anything");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      // The sentence a person reads has to say it is fine, not that it broke.
      expect(result.detail).toContain("The app works fully without it");
    } finally {
      if (key) process.env.GEMINI_API_KEY = key;
    }
  });

  it("writes nothing to the database from anywhere under lib/ai", () => {
    const source = [
      readFileSync("lib/ai/gemini.ts", "utf8"),
      readFileSync("lib/ai/product-copy.ts", "utf8"),
    ].join("\n");

    for (const verb of ["INSERT INTO", "UPDATE ", "DELETE FROM", "queryPostgres", "transactionPostgres"]) {
      expect(source, `lib/ai must not ${verb.trim()}`).not.toContain(verb);
    }
  });

  it("keeps the draft out of the catalog — the owner's Save is still the only writer", () => {
    const action = readFileSync("app/admin/ai-copy-action.ts", "utf8");

    expect(action).not.toContain("upsertProduct");
    expect(action).not.toContain("saveProduct");
    expect(action).not.toContain("revalidatePath");
  });

  it("needs the same permission as editing the catalog", () => {
    const action = readFileSync("app/admin/ai-copy-action.ts", "utf8");
    expect(action).toContain('requireAdminPermission("products:write")');
  });

  it("records every draft, including the ones that produced nothing", () => {
    const action = readFileSync("app/admin/ai-copy-action.ts", "utf8");

    expect(action).toContain("recordAdminAuditEvent");
    expect(action).toContain("product_ai_draft");
    // Named in the log so it cannot be read later as a save.
    expect(action).toContain("Not saved.");
  });
});
