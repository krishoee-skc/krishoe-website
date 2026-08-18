/**
 * Which advertising and analytics tags this shop runs.
 *
 * The ids live here rather than only in the deployment's environment because
 * none of them is a secret — every one ships in the HTML of every page, which
 * is how the vendors' scripts find them. Keeping the shop's own Meta pixel in
 * the code means the shop measures its advertising whether or not someone
 * remembered to set a variable, and an environment variable still overrides it
 * for anyone running a copy of this site who must not report into KRISHOE's
 * account.
 *
 * The private things — the Google service-account key that reads the numbers
 * back out — are the opposite, and stay in the environment only. See
 * lib/google-analytics.ts.
 */

/** KRISHOE's own Meta pixel, from Events Manager. */
const KRISHOE_META_PIXEL_ID = "2120035412198709";

export type TrackingIds = {
  meta: string;
  ga4: string;
  tiktok: string;
};

/**
 * What the shop is set up to use, regardless of where it is running.
 *
 * This is what the measurement admin page reports on: the owner asking "is the
 * pixel installed?" wants to know what production does, not what the machine
 * rendering the answer happens to do.
 */
export function configuredTrackingIds(): TrackingIds {
  // Each variable is named in full and read directly, because Next substitutes
  // NEXT_PUBLIC_* by matching the literal expression. Reading them through an
  // alias would leave the values undefined wherever this runs in the browser.
  return {
    meta: (process.env.NEXT_PUBLIC_META_PIXEL_ID || KRISHOE_META_PIXEL_ID).trim(),
    ga4: (process.env.NEXT_PUBLIC_GA4_ID ?? "").trim(),
    tiktok: (process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? "").trim(),
  };
}

/**
 * What should actually fire, which is nothing outside production.
 *
 * With the pixel id now in the code, a developer opening the shop locally would
 * otherwise send real AddToCart and Purchase events into the live advertising
 * account. Meta does not merely display those — it learns from them and bids on
 * what it learned, so a few afternoons of clicking through the checkout would
 * teach it to chase the wrong buyers with the owner's money.
 */
export function activeTrackingIds(): TrackingIds {
  if (process.env.NODE_ENV !== "production") {
    return { meta: "", ga4: "", tiktok: "" };
  }
  return configuredTrackingIds();
}
