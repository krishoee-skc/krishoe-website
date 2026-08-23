"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useCallback, useEffect, useRef } from "react";
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

  // The path is read through a ref so the reporter below can stay one stable
  // function for the life of the page.
  //
  // useReportWebVitals registers its listeners inside an effect keyed on the
  // function it is given, and never removes the ones it already added:
  //
  //   useEffect(() => { onCLS(fn); onLCP(fn); ... }, [reportWebVitalsFn])
  //
  // An inline arrow is a new function on every render, so every render added a
  // second set of listeners on top of the first. A shopper who landed on the
  // home page and tapped through to Contact changed the pathname, re-rendered
  // this component, and reported every metric on that page twice — identical
  // values, identical timestamps. Six rows in the table were three visits, and
  // an average built on them counted the slow page twice over.
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useReportWebVitals(useCallback((metric) => {
    if (!REPORTED.has(metric.name)) return;

    // Only the real shop. A page served by `npm run dev` is compiled the first
    // time it is asked for, which takes ten to twenty seconds — and those
    // numbers were landing in the same table as the shop's, against the same
    // paths, indistinguishable. The dashboard then reported /contact at 20.6s
    // while the live page was answering the same request in 1.1s.
    //
    // The owner opened localhost because I handed them a localhost link. The
    // reporter should never have accepted the measurement either way:
    // ServiceWorkerRegistration already guards on this and this did not.
    if (process.env.NODE_ENV !== "production") return;

    // The owner's own screens are not the shop. Admin is used from a desk on
    // wifi and would drag every average down towards a speed no customer sees
    // — the same reason these prefixes are cut out of the visitor counts.
    const path = pathRef.current;
    if (INTERNAL_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return;

    const body = JSON.stringify({
      metric: metric.name,
      // CLS is a ratio, not milliseconds. Multiplied so it survives an integer
      // column, and read back the same way.
      value: metric.name === "CLS" ? metric.value * 1000 : metric.value,
      path,
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
  }, []));

  return null;
}
