import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildAdminAssistantPrompt,
  adminFactsBlock,
  type AdminFacts,
} from "@/lib/ai/admin-assistant-prompt";

/**
 * What the owner's assistant is allowed to do, proven in the prompt itself.
 *
 * The whole safety of this feature rests on two promises: the AI is *given* the
 * true numbers rather than working them out, and the AI can only read and
 * speak — never act. Both are things a future edit could quietly break, so they
 * are pinned here against the pure prompt-builder, no network involved.
 */

const FACTS: AdminFacts = {
  todaySales: 12400,
  todayPairs: 18,
  creditOwed: 3200,
  workerOwed: 45000,
  todayGoodPairs: 60,
  monthProfit: 88000,
  lowStock: [{ name: "bag open", stock: 2 }],
  lowStockCount: 1,
};

describe("the true numbers reach the model already worked out", () => {
  it("puts the real figures into the prompt for the model to read back", () => {
    const prompt = buildAdminAssistantPrompt(FACTS, [], "aaja kati bikri bhayo?");
    // The dashboard's own numbers, formatted, are handed over — the model does
    // not compute them.
    expect(prompt).toContain("Rs. 12,400");
    expect(prompt).toContain("Rs. 45,000");
    expect(prompt).toContain("bag open (2 pairs)");
    expect(prompt).toContain("aaja kati bikri bhayo?");
  });

  it("tells the model, in words, never to change or invent a number", () => {
    const prompt = buildAdminAssistantPrompt(FACTS, [], "hi");
    expect(prompt).toMatch(/never change|do not recompute|already correct/i);
    expect(prompt).toMatch(/never invent|never .*guess|invent a number/i);
  });

  it("tells the model it cannot act — only read and answer", () => {
    const prompt = buildAdminAssistantPrompt(FACTS, [], "hi");
    // The allow-list, spelled out: no order, no wage, no stock edit.
    expect(prompt).toMatch(/cannot (place|change|do)/i);
    expect(prompt).toMatch(/order/i);
    expect(prompt).toMatch(/wage|stock|price/i);
  });

  it("says 'could not read' for a missing figure rather than a zero", () => {
    const down: AdminFacts = { ...FACTS, todaySales: null };
    const block = adminFactsBlock(down);
    expect(block).toContain("could not read right now");
    // The null figure is never rendered as Rs. 0.
    expect(block).not.toContain("Today's sales (net of returns): Rs. 0");
  });
});

describe("the admin assistant route is read-only and guarded", () => {
  const ROUTE = "app/api/admin/assistant/route.ts";

  it("is login-guarded", async () => {
    const source = await readFile(ROUTE, "utf8");
    expect(source).toContain("requireAdminPermission");
    expect(source).toContain("status: 401");
  });

  it("only reads snapshots and never writes", async () => {
    const source = await readFile(ROUTE, "utf8");
    // Reads the shop's numbers through the shared read-only reader — the same
    // one the facts API uses, so the two can never disagree.
    expect(source).toContain("readAdminFacts");
    for (const forbidden of ["INSERT", "UPDATE", "DELETE", "queryPostgres", "savePos"]) {
      expect(source, `admin assistant must not ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("returns the real numbers even when the AI is off, never a blank", async () => {
    const source = await readFile(ROUTE, "utf8");
    // facts are always returned; the AI sentence is layered on top and may be null.
    expect(source).toContain("isAiConfigured");
    expect(source).toContain("facts");
    expect(source).toContain("reply: null");
  });
});
