import { beforeEach, describe, expect, it, vi } from "vitest";

const getProducts = vi.fn();
const reportError = vi.fn();

vi.mock("@/lib/product-store", () => ({
  getProducts: (...args: unknown[]) => getProducts(...args),
}));
vi.mock("@/lib/report-error", () => ({
  reportError: (...args: unknown[]) => reportError(...args),
  reportingErrors: vi.fn(),
}));
vi.mock("@/app/admin/products/actions", () => ({ syncProductCatalogStockAction: vi.fn() }));
vi.mock("@/app/admin/ProductForm", () => ({ default: () => null }));
vi.mock("@/app/admin/ProductsClient", () => ({ default: () => null }));

const { default: AdminProductsPage } = await import("@/app/admin/products/page");

beforeEach(() => {
  getProducts.mockReset().mockResolvedValue([]);
  reportError.mockReset();
});

// The owner has landed on the app's generic retry page from here more than
// once. It is the same screen the shop shows when the shop is down, so a
// momentary cold connection and something serious look identical, and neither
// the form nor any hint of what failed survives.
describe("the admin product list failing to load", () => {
  it("does not throw the whole page away", async () => {
    getProducts.mockRejectedValue(new Error("Connection terminated unexpectedly"));

    await expect(AdminProductsPage({})).resolves.toBeTruthy();
  });

  it("reports the failure so it is not invisible", async () => {
    getProducts.mockRejectedValue(new Error("Connection terminated unexpectedly"));

    await AdminProductsPage({});

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0][0]).toContain("product list");
  });

  it("still renders when the list loads", async () => {
    await expect(AdminProductsPage({})).resolves.toBeTruthy();
    expect(reportError).not.toHaveBeenCalled();
  });

  it("asks for the drafts too, so the admin sees unpublished products", async () => {
    await AdminProductsPage({});

    expect(getProducts).toHaveBeenCalledWith({ includeDrafts: true });
  });
});
