"use server";

import { trackOrder, type TrackedOrder } from "@/lib/order-tracking";

export type TrackState = {
  status: "idle" | "found" | "not-found" | "rate-limited" | "incomplete";
  order?: TrackedOrder;
};

/**
 * Looks up one order for the person waiting on it.
 *
 * A server action rather than a GET route so the phone number is never put in
 * the address bar, where it would end up in browser history and in the referrer
 * sent to every script on the next page.
 */
export async function trackOrderAction(
  _previous: TrackState,
  formData: FormData,
): Promise<TrackState> {
  const reference = String(formData.get("reference") ?? "");
  const phone = String(formData.get("phone") ?? "");

  const result = await trackOrder(reference, phone);

  if (result.ok) return { status: "found", order: result.order };
  return { status: result.reason };
}
