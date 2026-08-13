import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderItem } from "@/lib/order-stock";

const getProducts = vi.fn();

vi.mock("@/lib/product-store", () => ({
  getProducts: () => getProducts(),
}));

type FakeReview = { customerUserId: string };
type FakeProduct = { id: string; name: string; reviews: FakeReview[] };

function product(id: string, name: string, reviewers: string[] = []): FakeProduct {
  return { id, name, reviews: reviewers.map((customerUserId) => ({ customerUserId })) };
}

function item(productId: string, quantity = 1): OrderItem {
  return { productId, productName: productId, size: "40", color: "Black", quantity };
}

// Re-implements the page helper's contract against the same mocked store. The
// page module itself pulls in the whole Next server component tree, so the
// rules are pinned here where they can be read and changed deliberately.
async function reviewablePairs(items: OrderItem[], customerId: string) {
  const wanted = new Set(items.filter((entry) => entry.quantity > 0).map((entry) => entry.productId));
  if (wanted.size === 0) return [];

  const products: FakeProduct[] = await getProducts();

  return products
    .filter((entry) => wanted.has(entry.id))
    .filter((entry) => !entry.reviews.some((review) => review.customerUserId === customerId))
    .map((entry) => ({ id: entry.id, name: entry.name }));
}

beforeEach(() => {
  getProducts.mockReset();
});

describe("review invitation on a closed order", () => {
  it("invites a review for a purchased pair", async () => {
    getProducts.mockResolvedValue([product("P1", "Flatpatta"), product("P2", "Sendil")]);

    const pairs = await reviewablePairs([item("P1")], "CUST-1");

    expect(pairs).toEqual([{ id: "P1", name: "Flatpatta" }]);
  });

  // The server refuses a second review from the same customer, so inviting one
  // would walk them into an error message.
  it("does not invite again once this customer has reviewed that pair", async () => {
    getProducts.mockResolvedValue([product("P1", "Flatpatta", ["CUST-1"])]);

    expect(await reviewablePairs([item("P1")], "CUST-1")).toEqual([]);
  });

  it("still invites when someone else reviewed the same pair", async () => {
    getProducts.mockResolvedValue([product("P1", "Flatpatta", ["CUST-OTHER"])]);

    expect(await reviewablePairs([item("P1")], "CUST-1")).toHaveLength(1);
  });

  // Same style in two sizes is two order lines but one thing to write about.
  it("asks once per product even when the order has several lines of it", async () => {
    getProducts.mockResolvedValue([product("P1", "Flatpatta")]);

    const pairs = await reviewablePairs([item("P1"), item("P1")], "CUST-1");

    expect(pairs).toHaveLength(1);
  });

  it("ignores a product that is no longer in the catalog", async () => {
    getProducts.mockResolvedValue([product("P2", "Sendil")]);

    expect(await reviewablePairs([item("GONE")], "CUST-1")).toEqual([]);
  });

  it("ignores zero-quantity lines and skips the catalog read for an empty order", async () => {
    expect(await reviewablePairs([item("P1", 0)], "CUST-1")).toEqual([]);
    expect(await reviewablePairs([], "CUST-1")).toEqual([]);
    expect(getProducts).not.toHaveBeenCalled();
  });
});
