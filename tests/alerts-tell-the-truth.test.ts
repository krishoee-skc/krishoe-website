import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The one lie an alert screen must never tell.
 *
 * /admin/alerts read a table called admin_alerts. The table was written into
 * docs/schema.sql and never created in any live database, and nothing in the
 * app had ever called createAlert() — scaffolding with no building attached.
 * Every query threw, every throw was swallowed by a catch returning an empty
 * list, and the page reported four cheerful zeros and "No alerts found".
 *
 * So "all clear" and "I could not check" looked identical, on the single screen
 * where that distinction is the entire point. The owner opened it and asked
 * whether they had broken something. They had not — it had never worked once.
 *
 * The shop already computed real warnings from orders, ledgers, stock,
 * payments and production. They were on two other screens and not on the one
 * called Alerts.
 */
const PAGE = "app/admin/alerts/page.tsx";

describe("what the alert screen reads", () => {
  it("computes from live data instead of a store nobody writes to", async () => {
    const page = await readFile(PAGE, "utf8");
    // The comment above the component names the table it stopped reading.
    const code = page.replace(/\/\*[\s\S]*?\*\//g, "");

    expect(code).toContain("getOperationalAlertCenter");
    expect(code).not.toContain("admin_alerts");
  });

  it("has no dead alert store left to mislead the next reader", async () => {
    const libFiles = await readdir("lib");
    const adminComponents = await readdir("components/admin");

    expect(libFiles).not.toContain("admin-alerts.ts");
    expect(adminComponents).not.toContain("AdminAlertCenter.tsx");

    // The table definition goes with it: a schema entry for a table nothing
    // uses is how the next person concludes the feature exists.
    const schema = await readFile("docs/schema.sql", "utf8");
    expect(schema).not.toContain("CREATE TABLE IF NOT EXISTS admin_alerts");
  });

  it("says out loud when it could not check", async () => {
    const page = await readFile(PAGE, "utf8");

    // A swallowed error here reads as good news. The failure has to reach the
    // screen, and the message has to say what the silence does not mean.
    expect(page).toContain("<LoadFailure");
    expect(page).toContain("सबै ठीक छ भन्ने होइन");
    expect(page).not.toContain("return [];");
  });
});

describe("what an empty alert screen says", () => {
  it("never says No alerts found", async () => {
    const page = (await readFile(PAGE, "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

    expect(page).not.toContain("No alerts found");
  });

  it("names what was checked, so quiet reads as evidence", async () => {
    const page = await readFile(PAGE, "utf8");

    // "Nothing here" is indistinguishable from a broken screen. Listing the
    // seven things that were looked at turns an empty page into a report.
    expect(page).toContain("अर्डर, उधारो, साहु, स्टक, भुक्तानी, हिसाब र उत्पादन");
  });

  it("gives every alert something to do, not only something to worry about", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("alert.action");
  });
});
