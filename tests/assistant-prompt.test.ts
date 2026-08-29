import { describe, expect, it } from "vitest";
import { assistantCatalog, buildAssistantPrompt } from "@/lib/ai/assistant-prompt";
import type { Product } from "@/lib/products";

// Same rule as tests/ai-stays-in-its-lane.test.ts, applied to the shopfront
// assistant: only facts already on the public website may cross to Google.
const product = {
  id: "ladies-flat",
  sku: "SKU-9-SECRET",
  name: "Ladies Flat",
  category: "Ladies Sandals",
  price: "Rs. 650",
  priceValue: 65000,
  wholesalePriceValue: 41000, // the trade price a customer never sees
  stock: 54, // the exact count the assistant must never quote
  sizes: ["36", "37", "38"],
  description: "Soft everyday sandal",
} as Product;

describe("the assistant catalog carries only public shoe facts", () => {
  const line = assistantCatalog([product]);

  it("includes the name, category, retail price, sizes and availability", () => {
    expect(line).toContain("Ladies Flat");
    expect(line).toContain("Ladies Sandals");
    expect(line).toContain("Rs. 650");
    expect(line).toContain("36, 37, 38");
    expect(line).toContain("in stock");
  });

  it("never leaks the wholesale price, the exact stock count or the SKU", () => {
    expect(line).not.toContain("41000");
    expect(line).not.toContain("54");
    expect(line).not.toContain("SKU-9-SECRET");
  });

  it("says 'sold out' without printing a zero stock number", () => {
    const soldOut = assistantCatalog([{ ...product, stock: 0 } as Product]);
    expect(soldOut).toContain("sold out");
    expect(soldOut).not.toContain(", 0,");
  });
});

describe("the assistant prompt is bounded to what it was handed", () => {
  const prompt = buildAssistantPrompt(
    assistantCatalog([product]),
    [{ role: "user", text: "hi" }],
    "Do you have size 38 in stock?",
  );

  it("carries the guardrails and the customer's question", () => {
    expect(prompt).toContain("Answer ONLY from the information given below");
    expect(prompt).toContain("Never invent or guess a price");
    expect(prompt).toContain("Do you have size 38 in stock?");
    expect(prompt).toContain("WhatsApp");
  });

  it("contains no personal data it was not given", () => {
    // A name/number from a review or an order must never appear — nothing here
    // passed one in, so nothing should surface.
    expect(prompt).not.toContain("9845000000");
    expect(prompt).not.toContain("Sita Gurung");
  });
});
