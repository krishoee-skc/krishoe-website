"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { INTERNAL_PATH_PREFIXES } from "@/lib/internal-paths";

/**
 * How fast the shop actually felt, measured on the shopper's own phone.
 *
 * The monitoring screen showed "Avg Response Time" with nothing under it,
 * because nothing had ever written a figure there. What could have been written
 * from the server would not have been worth much either: a prerendered page
 * answers in a few milliseconds, and the shopper on a Nepali mobile connection
 * still waits seconds for it to appear. The number that matters is the one
 * their browser sees, and only their browser can take it.
 *
 * These are the Web Vitals — the same measurements Google ranks on:
 *   LCP   how long until the main thing is on screen
 *   TTFB  how long until the first byte arrives
 *   FCP   how long until anything is drawn
 *   INP   how long a tap takes to answer
 *   CLS   how much the page jumps about while loading
 *
 * Sent with sendBeacon, which hands the browser the payload and lets it deliver
 * after the page is gone. A fetch would be cancelled by the navigation it is
 * trying to measure.
 */

/** Values a real page produces. Anything outside this is noise or mischief. */
const REPORTED = new Set(["LCP", "TTFB", "FCP", "INP", "CLS"]);

export default function SpeedReporter() {
  const pathname = usePathname();

  useReportWebVitals((metric) => {
    if (!REPORTED.has(metric.name)) return;

    // The owner's own screens are not the shop. Admin is used from a desk on
    // wifi and would drag every average down towards a speed no customer sees
    // — the same reason these prefixes are cut out of the visitor counts.
    if (INTERNAL_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

    const body = JSON.stringify({
      metric: metric.name,
      // CLS is a ratio, not milliseconds. Multiplied so it survives an integer
      // column, and read back the same way.
      value: metric.name === "CLS" ? metric.value * 1000 : metric.value,
      path: pathname,
      rating: metric.rating,
    });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/monitoring/vitals", body);
        return;
      }
      // keepalive, so an ordinary fetch also outlives the page it measured.
      void fetch("/api/monitoring/vitals", { method: "POST", body, keepalive: true });
    } catch {
      // A measurement that cannot be sent is not worth a broken page.
    }
  });

  return null;
}
