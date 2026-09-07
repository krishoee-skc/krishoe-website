import { expect, test } from "@playwright/test";

test("a shopper can select a pair, add it to the cart, and reach checkout", async ({ page }) => {
  await page.goto("/product/ladies-sandals");

  await expect(page.getByRole("heading", { name: "Signature Ladies Sandals" })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.getByRole("button", { name: "Added to cart", exact: true })).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Signature Ladies Sandals" })).toBeVisible();
  await page.getByRole("link", { name: "Continue checkout", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole("heading", { name: "Confirm your order." })).toBeVisible();
});

test("a visitor cannot open the admin workspace without signing in", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();
});
