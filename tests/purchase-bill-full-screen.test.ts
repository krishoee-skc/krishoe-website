import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The purchase bill, after the owner chose 1, 2, 3 and 4 from the sample on
 * 2026-09-27: a plain books mark, the whole screen, one door for material
 * coming in, and the smaller helps (running low, Nepali words, the bill's
 * photo, a supplier's month).
 */

const PAGE = "app/admin/purchasing/page.tsx";

describe("1. the books mark", () => {
  it("says the books match, or what did not, instead of 'Txn 2/2'", async () => {
    const page = await readFile(PAGE, "utf8");
    expect(page).not.toContain("Txn {row.linkedTransactionCount}");
    expect(page).not.toContain("`Txn ${posting?.linkedTransactionCount");
    expect(page).toContain('<T en="✓ Books match" ne="✓ हिसाब मिल्यो" />');
    expect(page).toContain("⚠ साहुको खातामा चढेन — मिलाउनुहोस्");
  });
});

describe("2. the whole screen", () => {
  it("opens on the bill with the counter strip; the figures wait under Accounts", async () => {
    const page = (await readFile(PAGE, "utf8")).replace(/\r\n/g, "\n");
    expect(page).toContain('const showAccounts = params?.view === "accounts";');
    expect(page).toContain('reportsHref="/admin/purchasing?view=accounts"');
    expect(page).toContain("{showAccounts ? null : (\n        <CounterBar");
  });

  it("keeps the phone's Save bar at the foot once the dock is gone", async () => {
    const form = await readFile("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx", "utf8");
    expect(form).toContain('<div data-pos-bar className="sticky');
  });
});

describe("3. one door for material coming in", () => {
  it("never takes 'received' from a form on the Operations screen", async () => {
    const actions = await readFile("app/admin/operations/actions.ts", "utf8");
    expect(actions).not.toContain('received: numberValue(formData, "received")');
    expect(actions).toContain("received: current.received,");
    expect(actions).toContain("received: 0,");
    for (const file of [
      "app/admin/operations/_components/OperationsQuickEntry.tsx",
      "app/admin/operations/_components/OperationsRecords.tsx",
    ]) {
      expect(await readFile(file, "utf8"), file).not.toContain('name="received"');
    }
  });

  it("sends a buyer to the purchase bill instead", async () => {
    const quick = await readFile("app/admin/operations/_components/OperationsQuickEntry.tsx", "utf8");
    expect(quick).toContain('href="/admin/purchasing"');
  });
});

describe("4. the smaller helps", () => {
  it("offers materials running low, one tap onto the bill", async () => {
    const form = await readFile("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx", "utf8");
    expect(form).toContain("material.reorderLevel > 0 && materialStock(material) <= material.reorderLevel");
    expect(form).toContain("onClick={() => buyRunningLow(material)}");
  });

  it("marks a bill that has a photo of the supplier's paper bill", async () => {
    const page = await readFile(PAGE, "utf8");
    expect(page).toContain("const withPhotos = await billIdsWithPhotos();");
    const photos = await readFile("lib/purchase-photos.ts", "utf8");
    expect(photos).toContain("export async function billIdsWithPhotos()");
  });

  it("puts a supplier's month on one card, every line of every bill", async () => {
    const supplier = await readFile("app/admin/purchasing/supplier/[id]/page.tsx", "utf8");
    expect(supplier).toContain('<T en="This month" ne="यो महिना" />');
    expect(supplier).toContain("purchaseLinesOf(invoice).map(");
  });

  it("speaks Nepali where it only spoke English", async () => {
    const page = await readFile(PAGE, "utf8");
    expect(page).not.toContain("Paid {money(supplier.paidAmount)} / Purchase");
    expect(page).toContain("सबैभन्दा पुरानो बाँकी");
  });
});

describe("found on the owner's first bill, 2026-09-28", () => {
  it("clears 'choose a supplier' as soon as one is typed or picked", async () => {
    const form = (await readFile("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx", "utf8")).replace(/\r\n/g, "\n");
    expect(form).toContain("current.message === supplierMissing ? null : current");
    expect(form).toContain("setSupplierQuery(event.target.value);\n                    clearSupplierProblem();");
    const choose = form.slice(form.indexOf("function chooseSupplier"), form.indexOf("function chooseSupplier") + 200);
    expect(choose).toContain("clearSupplierProblem();");
  });
});
