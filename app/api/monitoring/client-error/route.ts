import { NextRequest, NextResponse } from "next/server";
import { clientErrorFrom } from "@/lib/client-error-report";
import { logError } from "@/lib/monitoring";

/**
 * Where a visitor's browser reports an error the page hit (owner, 2026-10-26).
 *
 * Open by necessity, like the CSP report and the speed report beside it: the
 * shopper is signed in to nothing. So every field is checked in
 * lib/client-error-report.ts, the same message is written once (logError keeps
 * repeats out), and one server instance writes at most WRITES_PER_MINUTE rows
 * a minute, so a page stuck in a loop — or someone posting in one — cannot
 * fill the log or keep the database awake. Anything else gets a quiet 204.
 */

const WRITES_PER_MINUTE = 30;
let windowStart = 0;
let writesInWindow = 0;

function underTheLimit(now = Date.now()) {
  if (now - windowStart > 60_000) {
    windowStart = now;
    writesInWindow = 0;
  }
  writesInWindow += 1;
  return writesInWindow <= WRITES_PER_MINUTE;
}

export async function POST(request: NextRequest) {
  try {
    // The local-JSON backend is database-free on purpose (CI, browser checks).
    if (process.env.DATA_BACKEND === "local-json") {
      return new NextResponse(null, { status: 204 });
    }

    const raw = await request.text();
    if (raw.length > 8_000) return new NextResponse(null, { status: 204 });

    const report = clientErrorFrom(JSON.parse(raw), request.nextUrl.origin);
    if (!report || !underTheLimit()) return new NextResponse(null, { status: 204 });

    await logError({
      level: "error",
      message: `Browser: ${report.message}${report.where ? ` (${report.where})` : ""}`,
      context: "Browser",
      path: report.path,
      method: report.kind,
      stack: report.stack,
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    // Nonsense from the internet is not an error worth one of our own.
    return new NextResponse(null, { status: 204 });
  }
}
