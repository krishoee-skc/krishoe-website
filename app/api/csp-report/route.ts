import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/monitoring";

/**
 * Where the browser reports a blocked resource.
 *
 * The Content-Security-Policy now enforces — a script the page did not ship
 * simply does not run. This is where the browser says it stopped one, which is
 * the first sign that someone got content onto a page that should not be there
 * (an injected script, a tampered ad, a compromised extension). Each report
 * becomes a warning in the monitoring log the owner already reads, rather than
 * vanishing into a console nobody sees.
 *
 * Open by necessity — the browser posts here without a session — so nothing is
 * trusted: only the few fields a real report carries are kept, each clamped, and
 * anything else is dropped. A flood of them cannot fill the log because only the
 * offending directive and the blocked address (minus its query) are stored, and
 * a malformed post is answered with a quiet 204.
 */

const MAX_FIELD = 300;

function clamp(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_FIELD) : "";
}

/** A blocked address without its query string — the path is the signal, the query is noise (and could be an attacker's payload we would rather not store). */
function safeUri(value: unknown): string {
  const raw = clamp(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.slice(0, MAX_FIELD);
  } catch {
    return raw.split("?")[0].slice(0, MAX_FIELD);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { "csp-report"?: Record<string, unknown> }
      | Record<string, unknown>[]
      | null;

    // Browsers send either the classic `{ "csp-report": {...} }` (report-uri) or
    // an array of reports (report-to). Read whichever arrived.
    const report =
      (body && !Array.isArray(body) && (body["csp-report"] as Record<string, unknown>)) ||
      (Array.isArray(body) && (body[0] as { body?: Record<string, unknown> })?.body) ||
      null;

    if (!report || typeof report !== "object") {
      return new NextResponse(null, { status: 204 });
    }

    const directive = clamp(report["violated-directive"] ?? report["effectiveDirective"]);
    const blocked = safeUri(report["blocked-uri"] ?? report["blockedURL"]);
    const documentUri = safeUri(report["document-uri"] ?? report["documentURL"]);

    // A report with nothing recognisable is noise, not a signal.
    if (!directive && !blocked) {
      return new NextResponse(null, { status: 204 });
    }

    await logError({
      level: "warning",
      message: `CSP blocked ${blocked || "a resource"}${directive ? ` (${directive})` : ""}`,
      context: "Security",
      path: documentUri || undefined,
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    // The internet posting nonsense is not an error worth an error of our own.
    return new NextResponse(null, { status: 204 });
  }
}
