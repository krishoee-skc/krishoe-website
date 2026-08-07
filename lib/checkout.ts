/**
 * Checkout Flow Management
 * Handles checkout steps, promo codes, and order progression
 */

import { sql } from "@vercel/postgres";

export type CheckoutStep = "cart" | "shipping" | "payment" | "confirmation";

export interface PromoCode {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_discount?: number;
  min_purchase: number;
  usage_limit?: number;
  usage_count: number;
  valid_from: string;
  valid_until?: string;
  active: boolean;
}

export interface ShippingMethod {
  id: string;
  name: string;
  description?: string;
  base_cost: number;
  cost_per_km?: number;
  estimated_days: number;
  active: boolean;
}

/**
 * Update checkout step for an order
 */
export async function updateCheckoutStep(orderId: string, step: CheckoutStep) {
  try {
    const result = await sql`
      UPDATE orders
      SET checkout_step = ${step},
          checkout_started_at = COALESCE(checkout_started_at, CURRENT_TIMESTAMP)
      WHERE id = ${orderId}
      RETURNING *;
    `;
    return result.rows[0];
  } catch (error) {
    console.error("Error updating checkout step:", error);
    throw error;
  }
}

/**
 * Validate and apply promo code
 */
export async function validatePromoCode(code: string, subtotal: number): Promise<PromoCode | null> {
  try {
    const result = await sql`
      SELECT *
      FROM promo_codes
      WHERE UPPER(code) = UPPER(${code})
        AND active = true
        AND (valid_until IS NULL OR valid_until > CURRENT_TIMESTAMP)
        AND (usage_limit IS NULL OR usage_count < usage_limit)
        AND min_purchase <= ${subtotal}
      LIMIT 1;
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as PromoCode;
  } catch (error) {
    console.error("Error validating promo code:", error);
    return null;
  }
}

/**
 * Calculate discount amount
 */
export function calculateDiscount(
  subtotal: number,
  promoCode: PromoCode
): number {
  let discount = 0;

  if (promoCode.discount_type === "percentage") {
    discount = Math.round((subtotal * promoCode.discount_value) / 100);
  } else {
    discount = promoCode.discount_value;
  }

  // Apply max discount if set
  if (promoCode.max_discount && discount > promoCode.max_discount) {
    discount = promoCode.max_discount;
  }

  return Math.min(discount, subtotal); // Can't discount more than subtotal
}

/**
 * Apply promo code to order
 */
export async function applyPromoCode(orderId: string, code: string, subtotal: number) {
  const promoCode = await validatePromoCode(code, subtotal);

  if (!promoCode) {
    throw new Error("Invalid or expired promo code");
  }

  const discount = calculateDiscount(subtotal, promoCode);

  try {
    await sql`
      UPDATE promo_codes
      SET usage_count = usage_count + 1
      WHERE id = ${promoCode.id};
    `;

    const result = await sql`
      UPDATE orders
      SET promo_code = ${code},
          discount_amount = ${discount}
      WHERE id = ${orderId}
      RETURNING *;
    `;

    return {
      success: true,
      discount,
      promoCode: promoCode.code,
    };
  } catch (error) {
    console.error("Error applying promo code:", error);
    throw error;
  }
}

/**
 * Get available shipping methods
 */
export async function getShippingMethods(): Promise<ShippingMethod[]> {
  try {
    const result = await sql`
      SELECT *
      FROM shipping_methods
      WHERE active = true
      ORDER BY base_cost ASC;
    `;
    return result.rows as ShippingMethod[];
  } catch (error) {
    console.error("Error fetching shipping methods:", error);
    return [];
  }
}

/**
 * Calculate shipping cost
 */
export async function calculateShippingCost(
  shippingMethodId: string,
  distance?: number
): Promise<number> {
  try {
    const result = await sql`
      SELECT base_cost, cost_per_km
      FROM shipping_methods
      WHERE id = ${shippingMethodId} AND active = true;
    `;

    if (result.rows.length === 0) {
      return 0;
    }

    const method = result.rows[0];
    let cost = method.base_cost || 0;

    if (distance && method.cost_per_km) {
      cost += distance * method.cost_per_km;
    }

    return Math.round(cost);
  } catch (error) {
    console.error("Error calculating shipping:", error);
    return 0;
  }
}

/**
 * Get checkout funnel analytics
 */
export async function getCheckoutFunnelAnalytics() {
  try {
    const result = await sql`
      SELECT *
      FROM checkout_funnel_analytics
      LIMIT 30;
    `;
    return result.rows;
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return [];
  }
}

/**
 * Mark checkout as abandoned
 */
export async function markCheckoutAbandoned(orderId: string) {
  try {
    const result = await sql`
      UPDATE orders
      SET checkout_abandoned_at = CURRENT_TIMESTAMP
      WHERE id = ${orderId} AND checkout_step != 'confirmation'
      RETURNING *;
    `;
    return result.rows[0];
  } catch (error) {
    console.error("Error marking abandoned:", error);
    throw error;
  }
}

/**
 * Calculate estimated delivery date
 */
export function calculateEstimatedDelivery(estimatedDays: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + estimatedDays);
  return date;
}

/**
 * Format address for display
 */
export function formatAddress(address: string): string {
  try {
    const parsed = JSON.parse(address);
    return `${parsed.street}, ${parsed.city}, ${parsed.district}, ${parsed.postal}`;
  } catch {
    return address;
  }
}
