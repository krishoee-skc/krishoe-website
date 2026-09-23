import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { canonicalOrderText, priceLockedCheckoutItems } from "@/lib/checkout-order";

describe("trusted checkout pricing", () => {
  it("captures catalog unit and line prices beside each structured item", () => {
    const priced = priceLockedCheckoutItems(
      [{ productId: "runner", quantity: 2, size: "41", color: "Black" }],
      [
        {
          id: "runner",
          name: "Daily Runner",
          price_value: 199_900,
          stock: 10,
          status: "Active",
        },
      ],
    );

    expect(priced.subtotalPaisa).toBe(399_800);
    expect(priced.orderItems).toEqual([
      {
        productId: "runner",
        productName: "Daily Runner",
        size: "41",
        color: "Black",
        quantity: 2,
        unitPricePaisa: 199_900,
        lineTotalPaisa: 399_800,
      },
    ]);
    expect(canonicalOrderText(priced.orderItems)).toContain("Line total: Rs. 3,998");
  });

  it("does not accept the browser's order description or total as accounting input", async () => {
    const action = await readFile("app/actions.ts", "utf8");
    expect(action).not.toContain('textValue(formData, "order")');
    expect(action).not.toContain('textValue(formData, "total")');
    expect(action).toContain("placeCheckoutOrder({");
  });
});

describe("atomic checkout boundaries", () => {
  it("locks the retry key and catalog rows before checking reserved stock", async () => {
    const checkout = await readFile("lib/checkout-order.ts", "utf8");
    expect(checkout).toContain("pg_advisory_xact_lock");
    expect(checkout).toContain("FOR UPDATE");
    expect(checkout).toContain("o.status = 'Contacted'");
    expect(checkout).toContain("o.status = 'New' AND o.created_at > now() - make_interval(hours => $2::int)");
    expect(checkout).toContain("transactionPostgres(STORE");
  });

  it("locks, evaluates and redeems a coupon through that same executor", async () => {
    const checkout = await readFile("lib/checkout-order.ts", "utf8");
    const coupons = await readFile("lib/coupons.ts", "utf8");
    expect(checkout).toContain("getCouponForUpdate(db, input.submittedCode)");
    expect(checkout).toContain("redeemCouponWithExecutor(db, couponCheck.coupon.code)");
    expect(coupons).toContain("LIMIT 1 FOR UPDATE");
  });

  it("enforces one committed order per browser retry key in the database", async () => {
    const migration = await readFile(
      "scripts/migrations/20260914_checkout_order_integrity.sql",
      "utf8",
    );
    const client = await readFile("components/CheckoutClient.tsx", "utf8");
    expect(migration).toContain("orders_checkout_submission_key_unique_idx");
    expect(client).toContain("crypto.randomUUID()");
    expect(client).toContain('formData.set("checkoutSubmissionKey"');
  });
});
