import { NextRequest, NextResponse } from "next/server";
import { logPerformanceMetric } from "@/lib/monitoring";

/**
 * Where the shopper's browser posts how fast the page felt.
 *
 * Open by necessity: the measurement comes from a shopper who has not signed in
 * to anything, and asking them to would mean measuring only the owner. Open
 * also means anyone on the internet can post here, so nothing is trusted —
 * every field is checked against what a real page can produce, and anything
 * outside is dropped rather than stored.
 *
 * Nothing personal is kept. A path, a metric name, a number. No visitor id, no
 * address, nothing that says who was reading — the point is which page is slow,
 * not who found it slow.
 */

/** The measurements a page reports. Everything else is noise or mischief. */
const METRICS = new Set(["LCP", "TTFB", "FCP", "INP", "CLS"]);

/** Ten minutes. No real page takes longer, and no honest number is negative. */
const MAX_VALUE_MS = 600_000;

/** Long enough for a product URL with its id, short enough not to be a payload. */
const MAX_PATH = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const metric = typeof body?.metric === "string" ? body.metric.trim().toUpperCase() : "";
    const value = Number(body?.value);
    const path = typeof body?.path === "string" ? body.path.trim() : "";
    const rating = typeof body?.rating === "string" ? body.rating.trim().slice(0, 20) : "";

    if (!METRICS.has(metric)) {
      return NextResponse.json({ ok: false }, { status: 204 });
    }
    if (!Number.isFinite(value) || value < 0 || value > MAX_VALUE_MS) {
      return NextResponse.json({ ok: false }, { status: 204 });
    }
    // A path of ours, not a URL to somewhere else and not a payload dressed as
    // one. Storing an attacker's text would put it on the owner's dashboard.
    if (!path.startsWith("/") || path.includes("://") || path.length > MAX_PATH) {
      return NextResponse.json({ ok: false }, { status: 204 });
    }

    await logPerformanceMetric({
      path,
      // Not an HTTP verb here. The column holds what the row is about, and for
      // these rows that is the rating the browser gave — good, needs
      // improvement, poor — which is what the dashboard shows beside the path.
      method: rating || metric,
      metric,
      duration: Math.round(value),
      // Nothing failed; the page was drawn. The column is not null-able and 200
      // is the honest answer for a page that rendered.
      statusCode: 200,
    });

    // Nothing to say back. sendBeacon ignores the body, and a 204 keeps the
    // response off the wire on a connection the shopper is paying for.
    return new NextResponse(null, { status: 204 });
  } catch {
    // A malformed post is not worth an error page or a log line — it is the
    // internet. logPerformanceMetric swallows its own failures already.
    return new NextResponse(null, { status: 204 });
  }
}
