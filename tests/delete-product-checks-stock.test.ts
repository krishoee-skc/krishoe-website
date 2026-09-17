import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Deleting a shoe that still has pairs behind it.
 *
 * The delete action checked one thing — that an id was supplied — and then
 * removed the row. Nothing asked whether those shoes exist. A product with 48
 * pairs in finished_stock could be deleted by a mis-click, and the pairs would
 * stay in the godown with nothing in the catalog pointing at them: the Stock
 * screen still counts them, the shop cannot sell them, and the only way back is
 * to re-create the product under exactly the same spelling.
 *
 * This matters right now because the owner is about to tidy the catalog. Four
 * Draft products are genuine leftovers with no stock and no sales — those
 * should go. Two others, halka fom and hill panja, carry 48 and 50 pairs. They
 * sit next to each other in the same list, behind the same delete button.
 *
 * The rule is only about stock, not about tidiness: a product with nothing
 * behind it deletes exactly as before.
 */
const ACTIONS = "app/admin/actions.ts";

describe("deleting a product", () => {
  it("looks up what it is about to delete", async () => {
    const source = await readFile(ACTIONS, "utf8");
    const del = source.slice(
      source.indexOf("export async function deleteProductAction"),
      source.indexOf("export async function setViewingBranchAction"),
    );

    expect(del.length, "the delete action moved").toBeGreaterThan(0);
    // Drafts are deletable too, so the read has to include them or tidying the
    // catalog would fail on exactly the rows it is meant to remove.
    expect(del).toMatch(/getProductById\([\s\S]{0,80}?includeDrafts:\s*true/);
  });

  it("refuses while pairs are still behind it", async () => {
    const source = await readFile(ACTIONS, "utf8");
    const del = source.slice(
      source.indexOf("export async function deleteProductAction"),
      source.indexOf("export async function setViewingBranchAction"),
    );

    expect(del, "the stock check").toMatch(/stock\s*>\s*0/);
    // And says the number, so the owner knows this is a real shelf rather than
    // a system that refuses for its own reasons.
    expect(del).toMatch(/\$\{[^}]*stock[^}]*\}/);
  });

  it("still deletes a product with nothing behind it", async () => {
    const source = await readFile(ACTIONS, "utf8");
    const del = source.slice(
      source.indexOf("export async function deleteProductAction"),
      source.indexOf("export async function setViewingBranchAction"),
    );

    // The guard must be conditional. A blanket refusal would strand the four
    // empty Drafts the owner is trying to clear.
    expect(del).toContain("removeProduct(id)");
    expect(del, "the refusal is conditional").toMatch(/if\s*\([^)]*stock\s*>\s*0[^)]*\)/);
  });
});
