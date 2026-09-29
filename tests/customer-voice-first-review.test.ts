import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Customer Voice, 2026-09-29: no reviews, ten counter bills whose customers
 * were never asked, six "0" tabs, a menu dot with no reason on the page, and a
 * checkout offering QR / bank transfer with no account behind it.
 */
describe("an empty Customer Voice shows the ways to the first review", () => {
  it("shows the three ways instead of six zero tabs", async () => {
    const page = await read("app/admin/inbox/page.tsx");
    expect(page).toContain("{counts.total > 0 ? (");
    expect(page).toContain("<ReviewAskWays reviewUrl=");
  });

  it("offers a WhatsApp message with the review link, the bill QR, and the running email", async () => {
    const ways = await read("app/admin/inbox/ReviewAskWays.tsx");
    expect(ways).toContain("https://wa.me/?text=${encodeURIComponent(message)}");
    expect(ways).toContain("${reviewUrl}");
    expect(ways).toContain('src="/api/admin/review-qr"');
    expect(ways).toContain("पहिले नै चलिरहेको");
  });
});

describe("the counter bill asks for a review", () => {
  it("prints the review-page QR at its foot", async () => {
    const bill = await read("app/admin/pos/[id]/page.tsx");
    expect(bill).toContain('src="/api/admin/review-qr"');
    expect(bill).toContain("जुत्ता कस्तो लाग्यो?");
  });

  it("encodes the public review page, for signed-in staff only", async () => {
    const route = await read("app/api/admin/review-qr/route.ts");
    expect(route).toContain("await requireAdminPermission(");
    expect(route).toContain("/review`");
  });
});

describe("a menu dot says why, on the page it points at", () => {
  it("is drawn by the admin layout from the same checks as the dots", async () => {
    const layout = await read("app/admin/layout.tsx");
    expect(layout).toContain("const attention = attentionByHref(checks);");
    expect(layout).toContain("<AttentionReasons checks={reasons} />");
  });

  it("stays off the dashboard and the alerts list", async () => {
    const reasons = code(await read("app/admin/AttentionReasons.tsx"));
    expect(reasons).toContain('if (page === "/admin" || page === "/admin/alerts") return false;');
  });

  it("sends stars with no review to Products, and clears them there in one press", async () => {
    const checks = await read("lib/shop-self-check.ts");
    const rating = checks.slice(checks.indexOf('id: "rating-without-reviews"'));
    expect(rating.slice(0, rating.indexOf("count:"))).toContain('href: "/admin/products"');
    const actions = await read("app/admin/products/actions.ts");
    expect(actions).toContain("export async function clearUnbackedRatingsAction");
    expect(actions).toContain("v.kind = 'review' AND v.published = true");
    expect(await read("app/admin/AttentionReasons.tsx")).toContain("clearUnbackedRatingsAction");
  });

  it("starts a new shoe with no stars", async () => {
    const form = await read("app/admin/ProductForm.tsx");
    expect(form).toContain('defaultValue={product?.rating ?? "0"}');
  });
});

describe("checkout offers QR / bank transfer only with an account to pay into", () => {
  it("hides the option until Settings holds a bank account", async () => {
    const checkout = await read("components/CheckoutClient.tsx");
    expect(checkout).toContain('.filter((option) => option !== "QR / bank transfer confirmation" || hasBankAccount)');
    expect(checkout).toContain('hasBankAccount={bank.bankAccountNumber.trim() !== ""}');
  });
});
