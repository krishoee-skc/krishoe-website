"use client";

import { useEffect } from "react";

/**
 * Tells Admin → Monitoring when a page breaks in someone's browser (owner,
 * 2026-10-26). Uncaught errors, failed promises, and React's own recoverable
 * errors (a page drawn twice, like the #418 found on Dashboard and Stock) all
 * reach window as an "error" event.
 *
 * Quiet on purpose: production only, at most five reports from one page load,
 * each message once, and sent with sendBeacon so it never holds up the page.
 * What is sent is checked again on the server (lib/client-error-report.ts).
 */

const MAX_PER_PAGE_LOAD = 5;
const ENDPOINT = "/api/monitoring/client-error";

export default function ClientErrorReporter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    const seen = new Set<string>();
    let sent = 0;

    const send = (report: Record<string, unknown>) => {
      const message = String(report.message ?? "").slice(0, 300);
      if (!message || seen.has(message) || sent >= MAX_PER_PAGE_LOAD) return;
      seen.add(message);
      sent += 1;
      const body = JSON.stringify({ ...report, message, path: window.location.pathname });
      try {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
      } catch {
        // fall through to fetch
      }
      fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    };

    const onError = (event: ErrorEvent) => {
      const error = event.error as { message?: string; stack?: string } | undefined;
      send({
        kind: "error",
        message: error?.message || event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: error?.stack,
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { message?: string; stack?: string } | string | undefined;
      send({
        kind: "rejection",
        message: typeof reason === "string" ? reason : reason?.message,
        stack: typeof reason === "string" ? undefined : reason?.stack,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
