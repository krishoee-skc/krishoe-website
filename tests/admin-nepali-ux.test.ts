import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { adminNavLinks } from "@/app/admin/nav-links";

const NEPALI = /[ऀ-ॿ]/;

/**
 * The owner reads Nepali and the admin was written in English. A full
 * translation was the wrong fix: they have already learned where "Factory
 * Entry" and "Operations" live, and renaming everything would cost them that.
 *
 * So the English names stay as the headings, and Nepali is added where it
 * actually earns its place — under each menu name, and in the sentences the app
 * says back after a save or a refusal, which is where not understanding costs
 * money.
 */
describe("menu names", () => {
  it("carry a Nepali name as well as the English one", () => {
    for (const link of adminNavLinks) {
      expect(link.nepali, link.label).toMatch(NEPALI);
      expect(link.label, link.href).toBeTruthy();
    }
  });

  // The menus used to print both names stacked, always. That put Devanagari on
  // every screen for a reader who had pressed ENGLISH, so each menu now asks
  // the language first — what matters is that the Nepali name still reaches the
  // Nepali reader, not the exact shape of the expression that draws it.
  it("are drawn in all three menus, on the Nepali side", async () => {
    for (const file of [
      "app/admin/AdminNav.tsx",
      "app/admin/AdminMobileNav.tsx",
      "app/admin/components/AdminDrawer.tsx",
    ]) {
      const source = await readFile(file, "utf8");
      expect(source, file).toContain("nepali");
      expect(source, file).toContain(`language === "ne" ? nepali : label`);
    }
  });
});

describe("what the app says back", () => {
  it("confirms an operations save in Nepali", async () => {
    const source = await readFile("app/admin/operations/actions.ts", "utf8");
    const messages = [...source.matchAll(/refreshOperationsPage\("([^"]+)"/g)].map((m) => m[1]);

    expect(messages.length).toBeGreaterThan(15);
    for (const message of messages) {
      expect(message, message).toMatch(NEPALI);
    }
  });

  it("refuses a staff account in Nepali", async () => {
    const source = await readFile("app/admin/settings/actions.ts", "utf8");
    expect(source).toContain("Email वा मोबाइल नम्बर — कम्तीमा एउटा चाहिन्छ।");
    expect(source).toContain("यो मोबाइल नम्बर भएको खाता पहिले नै छ।");
  });
});

describe("operations quick entry", () => {
  it("shows the three daily forms and folds the other seven away", async () => {
    const source = await readFile(
      "app/admin/operations/_components/OperationsQuickEntry.tsx",
      "utf8",
    );

    // <details>, not a client component: the seven forms stay in the page and
    // keep working with JavaScript off.
    expect(source).toContain("<details");
    expect(source).toContain("अरू विकल्प (7)");

    // From the first grid, not the file start — the imports at the top name
    // every action including the folded ones.
    const open = source.slice(
      source.indexOf('<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">'),
      source.indexOf("<details"),
    );
    for (const daily of [
      "createStockMovementAction",
      "createFinishedStockAction",
      "createProductionBatchAction",
    ]) {
      expect(open, daily).toContain(daily);
    }
    for (const folded of ["createVehicleDispatchAction", "createCustomerLedgerAction"]) {
      expect(open, folded).not.toContain(folded);
    }
  });
});

describe("dashboard", () => {
  it("opens with what needs doing, above the reporting", async () => {
    const page = await readFile("app/admin/page.tsx", "utf8");
    const body = page.slice(page.indexOf('<section className="p-6 space-y-6">'));

    // What needs doing comes first; the shop-health zone — the only reporting
    // left on the home — comes after it. The cluttered wall of tiles that used
    // to sit between them is gone.
    expect(body.indexOf("<TodayBoard")).toBeGreaterThan(-1);
    expect(body.indexOf("<TodayBoard")).toBeLessThan(body.indexOf('data-zone="health"'));

    const board = await readFile("app/admin/TodayBoard.tsx", "utf8");
    expect(board).toContain("आजको काम");
    // A quiet day should say so rather than showing three green ticks to read.
    expect(board).toContain("अहिले केही अड्किएको छैन।");
  });
});
