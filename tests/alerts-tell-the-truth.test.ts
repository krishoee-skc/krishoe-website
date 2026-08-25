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

/**
 * An alert nobody at the counter can read is an alert nobody acts on.
 *
 * The warnings are computed on the server, where the language is unknowable —
 * the choice lives in the reader's own browser. So each alert carries both
 * halves and the screen picks, exactly as the storefront does with its
 * hand-written pairs. The English keeps its old field names and old values, so
 * the dashboard, the digest e-mail and the notification records are untouched.
 */
describe("the language an alert speaks", () => {
  it("carries both halves, because the server cannot know which is wanted", async () => {
    const notifications = await readFile("lib/notifications.ts", "utf8");
    const shape = notifications.slice(
      notifications.indexOf("export type OperationalAlert = {"),
      notifications.indexOf("export type OperationalAlertCenter"),
    );

    for (const field of ["title:", "titleNe:", "detail:", "detailNe:", "action:", "actionNe:"]) {
      expect(shape, field).toContain(field);
    }
  });

  it("gives every alert its Nepali, with none left behind", async () => {
    const notifications = await readFile("lib/notifications.ts", "utf8");
    const centre = notifications.slice(notifications.indexOf("export async function getOperationalAlertCenter"));
    const body = centre.slice(0, centre.indexOf("const sortedAlerts"));

    // Eight places raise an alert. A ninth added without its Nepali half would
    // not fail to compile — the type would catch a missing field, but not a
    // field filled with the English string — so count them.
    const raised = (body.match(/alerts\.push\(\{/g) ?? []).length;
    expect(raised).toBeGreaterThanOrEqual(8);
    expect((body.match(/titleNe:/g) ?? []).length).toBe(raised);
    expect((body.match(/actionNe:/g) ?? []).length).toBe(raised);
  });

  it("says what the shop says, not a word-for-word translation", async () => {
    const notifications = await readFile("lib/notifications.ts", "utf8");

    // From the glossary: उधारो rather than "credit", जोडी rather than "pairs",
    // साहु rather than "supplier". A machine rendering of "catalog stock low"
    // is the kind of sentence a reader skims past without acting on.
    for (const word of ["उधारो", "जोडी", "साहु", "पसलमा सकियो"]) {
      expect(notifications, word).toContain(word);
    }
  });

  it("does not print a debt as zero days old", async () => {
    const notifications = await readFile("lib/notifications.ts", "utf8");

    // "0 days outstanding" is nonsense for money lent this morning.
    expect(notifications).toContain("ledger.daysOutstanding > 0");
    expect(notifications).toContain("आजै दिएको उधारो हो");
  });

  it("picks the language in the browser, without making the page client-side", async () => {
    const picker = await readFile("components/admin/AlertText.tsx", "utf8");
    const page = await readFile(PAGE, "utf8");

    expect(picker).toContain('"use client"');
    expect(page).toContain("<AlertText");
    // The page itself stays a server component; only the words are an island.
    expect(page.slice(0, 200)).not.toContain('"use client"');
  });
});
