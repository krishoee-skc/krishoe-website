import { getOrders, type OrderStatus, type OrderSubmission } from "@/lib/submissions";
import { checkAndRecordRateLimit } from "@/lib/rate-limit-store";
import { normalizeStaffPhone } from "@/lib/staff-phone";

/**
 * Letting a customer see where their order is, without letting anyone else.
 *
 * Most orders here are cash on delivery, so the question a Nepali shopper is
 * really asking before they buy is "will it actually turn up?". Until now the
 * only way to find out was to telephone the shop, which is a cost to the
 * customer and to the owner, and a reason not to order at all.
 *
 * The rule this file exists to enforce is that a reference number alone opens
 * nothing. An order carries a name, a full delivery address and a phone number;
 * if the reference were enough, anyone holding a screenshot of someone else's
 * receipt — or working through ids — could read all of it. So the phone number
 * on the order must be given too, and even then only a deliberately small view
 * comes back: what was ordered, what it costs, and where it has got to. The
 * address is never returned, because the person entitled to it already knows it
 * and nobody else should learn it here.
 */

export type TrackedOrder = {
  reference: string;
  placedAt: string;
  status: OrderStatus;
  /** What the customer pays, already formatted by the shop. */
  total: string;
  itemCount: number;
  /** Product names only — no sizes, no address, no name. */
  items: string[];
};

export type TrackingResult =
  | { ok: true; order: TrackedOrder }
  | { ok: false; reason: "not-found" | "rate-limited" | "incomplete" };

/** Digits only, so 977-98… and 098… and "098 5501 9351" all compare equal. */
function comparablePhone(value: string) {
  return normalizeStaffPhone(value).replace(/\D+/g, "");
}

function matchesPhone(order: OrderSubmission, typed: string) {
  const wanted = comparablePhone(typed);
  if (wanted.length < 7) return false;

  const stored = comparablePhone(order.phone ?? "");
  if (!stored) return false;

  // Compare the last nine digits. Numbers get saved with and without the 977
  // country code and with assorted spacing, and a customer typing their own
  // number from memory should not have to reproduce the shop's formatting.
  const tail = (value: string) => value.slice(-9);
  return tail(stored) === tail(wanted);
}

function toTracked(order: OrderSubmission): TrackedOrder {
  return {
    reference: order.id,
    placedAt: order.createdAt,
    status: order.status,
    total: order.total,
    itemCount: order.items.reduce((count, item) => count + (item.quantity || 1), 0),
    items: order.items.map((item) => item.productName).filter(Boolean),
  };
}

/**
 * Finds one order for a customer who can prove it is theirs.
 *
 * Rate limited per phone number: without that, the phone requirement only
 * slows an attacker down rather than stopping them, since a known reference
 * plus a run through plausible numbers would eventually match. Ten tries an
 * hour is far more than a real customer mistyping their own number needs.
 */
export async function trackOrder(
  referenceInput: string,
  phoneInput: string,
): Promise<TrackingResult> {
  const reference = referenceInput.trim();
  const phone = phoneInput.trim();

  if (!reference || !phone) return { ok: false, reason: "incomplete" };

  const limit = await checkAndRecordRateLimit({
    bucket: "order-tracking",
    key: comparablePhone(phone) || reference.toLowerCase(),
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000,
  });

  if (limit.limited) return { ok: false, reason: "rate-limited" };

  const orders = await getOrders();
  const order = orders.find(
    (candidate) => candidate.id.toLowerCase() === reference.toLowerCase(),
  );

  // One answer for "no such order" and for "that is not your order". Telling
  // them apart would confirm which references exist, which is the thing the
  // phone check is here to protect.
  if (!order || !matchesPhone(order, phone)) return { ok: false, reason: "not-found" };

  return { ok: true, order: toTracked(order) };
}

export { trackingStage } from "@/lib/order-stages";
