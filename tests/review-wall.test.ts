import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { initialOf, wallReviews, wallShoes, wallSummary } from "@/lib/review-wall";
import { reviewView, reviewWhere, showsWhenPublished, type ShoeOnFile } from "@/app/admin/inbox/ReviewRow";
import type { Product } from "@/lib/products";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Reviews, shown together (owner, 2026-10-01, the namuna's 1 2 3): Customer
 * Voice says where each will show and publishes several at once; the home page
 * and /reviews show the shoes' reviews and the shop's own.
 */
const shoe = (id: string, name: string, reviews: Array<Partial<Product["reviews"][number]>>) =>
  ({
    id,
    name,
    sku: "KR-201",
    price: "Rs. 1,150",
    image: "/a.webp",
    gallery: [],
    reviews: reviews.map((review, index) => ({
      id: `${id}-${index}`,
      name: "Sunil panta",
      comment: "Design and comfort to use.",
      rating: 5,
      createdAt: "2026-09-15T00:00:00.000Z",
      status: "approved",
      ...review,
    })),
  }) as unknown as Product;

describe("the review wall", () => {
  it("joins the shoes' published reviews and the shop's own, verified first then newest", () => {
    const wall = wallReviews(
      [shoe("s1", "bantu hill", [{}, { status: "pending", comment: "not yet" }])],
      [{ id: "h1", name: "Nikesh neupane", comment: "Best slippers", rating: 5, createdAt: "2026-09-01T00:00:00.000Z", verified: false }],
    );
    expect(wall.map((review) => review.id)).toEqual(["s1-0", "h1"]);
    expect(wall[0].shoe).toMatchObject({ name: "bantu hill", href: "/product/bantu-hill-kr-201", price: "Rs. 1,150" });
    expect(wall[1].shoe).toBeNull();
    expect(wallSummary(wall)).toMatchObject({ count: 2, average: 5 });
    expect(wallSummary([])).toBeNull();
    expect(wallShoes(wall)).toMatchObject({ shop: 1 });
    expect(initialOf("sunil")).toBe("S");
  });

  it("is on the home page and the new /reviews page, and in the sitemap", async () => {
    expect(await read("app/page.tsx")).toContain("<Testimonials products={products} shopReviews={shopReviews} />");
    expect(await read("components/Testimonials.tsx")).toContain("const wall = wallReviews(products, shopReviews);");
    expect(await read("app/reviews/page.tsx")).toContain("const wall = wallReviews(products, shopReviews);");
    expect(await read("app/sitemap.ts")).toContain("url: `${baseUrl}/reviews`,");
    expect(await read("lib/customer-voice.ts")).toContain("WHERE kind = 'review' AND published = true AND product_id = ''");
  });
});

describe("deciding a review in Customer Voice", () => {
  const shoes = new Map<string, ShoeOnFile>([
    ["a", { id: "a", name: "bantu hill", active: true }],
    ["d", { id: "d", name: "bag open", active: false }],
  ]);

  it("says where it will show, and why not", () => {
    expect(reviewWhere({ productId: "a", productName: "" }, shoes).tone).toBe("shoe");
    expect(reviewWhere({ productId: "d", productName: "" }, shoes).tone).toBe("draft");
    expect(reviewWhere({ productId: "", productName: "" }, shoes).tone).toBe("home");
    expect(reviewWhere({ productId: "gone", productName: "" }, shoes).tone).toBe("gone");
    expect(showsWhenPublished({ productId: "d", productName: "" }, shoes)).toBe(false);
    expect(showsWhenPublished({ productId: "", productName: "" }, shoes)).toBe(true);
  });

  it("sorts it into to decide, live and kept hidden", () => {
    expect(reviewView({ published: true, status: "answered" })).toBe("live");
    expect(reviewView({ published: false, status: "closed" })).toBe("hidden");
    expect(reviewView({ published: false, status: "answered" })).toBe("decide");
  });

  it("publishes several at once, hides, moves, and deletes only after a tick", async () => {
    const actions = await read("app/admin/inbox/actions.ts");
    expect(actions).toContain("export async function publishManyAction");
    expect(actions).toContain("export async function keepHiddenAction");
    expect(actions).toContain("export async function moveReviewAction");
    expect(actions).toContain('if (String(formData.get("confirmAsked") ?? "") === "1" && String(formData.get("confirm") ?? "") !== "yes") return;');
    expect(actions).toContain('revalidatePath("/reviews");');
    const row = await read("app/admin/inbox/ReviewRow.tsx");
    expect(row).toContain('<input type="hidden" name="confirmAsked" value="1" />');
  });
});
