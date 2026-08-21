import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const API = "app/api/factory/ready/route.ts";
const PANEL = "app/admin/factory/add-work/ReadyToPost.tsx";
const PAGE = "app/admin/factory/add-work/page.tsx";
const POLICY = "lib/factory-api-policy.ts";

function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

/**
 * A day's work lived on four screens: enter the wages here, link the item
 * there, post the stock somewhere else, publish the product somewhere else
 * again. The owner said the system did not fit them, and that was the shape of
 * it — one job, four places.
 */
describe("the day's work on one screen", () => {
  it("shows what is made and what is on the shelf where the work is entered", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("ReadyToPost");
    expect(page).toContain("refreshKey={workSaved}");
  });

  it("recounts after each entry without a reload", async () => {
    const page = await readFile(PAGE, "utf8");
    const panel = await readFile(PANEL, "utf8");

    expect(page).toContain("setWorkSaved((count) => count + 1)");
    expect(panel).toContain("[load, refreshKey]");
  });
});

/**
 * The mistake this panel exists to prevent, and which the owner spotted before
 * writing a single entry: one shoe passes through Upper and Fibermen, so 60
 * finished pairs are recorded as 60 twice. Added together they read as 120.
 */
describe("counting a pair once", () => {
  it("takes the smallest stage total, never the sum", async () => {
    const api = await readFile(API, "utf8");
    const made = api.slice(api.indexOf("const madePairs"));

    expect(made.slice(0, 300)).toContain("Math.min(least, stage.pairs)");
    expect(made.slice(0, 300)).not.toContain("least + stage.pairs");
  });

  it("counts every route stock has already come in by", async () => {
    const api = await readFile(API, "utf8");

    // Posting from here, the Operations form and Packing/QC all land in
    // stock_movements. Missing any of them would show pairs as still pending
    // and invite a second posting of the same shoes.
    expect(api).toContain("type IN ('Production In', 'Adjustment')");
  });
});

/**
 * The owner's standing rule: only the count made in the godown is true. The
 * app may suggest, never decide.
 */
describe("who decides how many pairs go in", () => {
  it("offers a figure and takes a typed one", async () => {
    const panel = await readFile(PANEL, "utf8");

    expect(panel).toContain('type="number"');
    expect(panel).toContain("गोदाममा गनेको सङ्ख्या हाल्नुहोस्");
    expect(panel).toContain("अनुमान मात्र हो");
  });

  it("never posts stock on its own", async () => {
    const api = code(await readFile(API, "utf8"));
    const panel = code(await readFile(PANEL, "utf8"));

    // Every posting comes from the POST handler, and the POST handler is only
    // reached by pressing the button.
    expect(api).toContain("export async function POST");
    expect(panel).toContain('method: "POST"');
    expect(api.slice(api.indexOf("export async function GET"), api.indexOf("export async function POST")))
      .not.toContain("addStockMovement");
  });

  it("refuses a missing or nonsense pair count", async () => {
    const api = await readFile(API, "utf8");

    expect(api).toContain("!Number.isFinite(pairs) || pairs <= 0");
  });
});

/**
 * Pairs posted under a name no product carries become a Draft product, and a
 * Draft never reaches a shopper. Said before the pairs are posted, not after.
 */
describe("where the pairs land", () => {
  it("says whether the shop will show them", async () => {
    const panel = await readFile(PANEL, "utf8");

    expect(panel).toContain("नामको जुत्ता छैन");
    expect(panel).toContain("Draft पसलमा देखिँदैन");
    expect(panel).toContain("जोडी बिक्रीमा");
  });

  it("refreshes the catalog so the shop sees the pairs", async () => {
    const api = await readFile(API, "utf8");

    expect(api).toContain("syncProductCatalogStockWithFinishedStock");
  });
});

/**
 * Factory APIs are private by default — an unlisted handler is denied. Putting
 * pairs on the shelf is a stock decision and is held to the same bar as every
 * other door into stock.
 */
describe("who may use it", () => {
  it("is listed in the policy, or it would be denied", async () => {
    const policy = await readFile(POLICY, "utf8");
    const entry = policy.slice(policy.indexOf('"/api/factory/ready"'));

    expect(entry.slice(0, 300)).toContain("GET: { permissions: productionEntry }");
    expect(entry.slice(0, 300)).toContain('POST: { permissions: ["operations:write"], ownerOnly: true }');
  });
});
