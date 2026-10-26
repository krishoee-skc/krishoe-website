/**
 * An error from a visitor's browser, checked before it is kept (owner,
 * 2026-10-26, security phase 2).
 *
 * Until now only the server's errors reached Admin → Monitoring. React's #418
 * on the admin pages — the page drawn twice — happened in the browser and was
 * seen by nobody until a test went looking. This is what the browser sends
 * now, and what it may say.
 *
 * The endpoint is open (a shopper has no session), so nothing here is trusted:
 * the text is clamped, the page must be one of ours, and the noise every site
 * gets — browser extensions, cross-origin "Script error.", the ResizeObserver
 * warning — is dropped rather than stored.
 */

export type ClientErrorKind = "error" | "rejection";

export type ClientError = {
  kind: ClientErrorKind;
  message: string;
  path: string;
  /** Our own script and line, when the browser gave them. */
  where?: string;
  stack?: string;
};

const MAX_MESSAGE = 300;
const MAX_PATH = 300;
const MAX_STACK = 1500;

/** What every site's browsers report and nobody can act on. */
const NOISE = [
  /^Script error\.?$/i,
  /ResizeObserver loop/i,
  /Non-Error promise rejection captured/i,
  /^Load failed$/i,
  /^Failed to fetch$/i,
  /NetworkError when attempting to fetch/i,
  /^cancell?ed$/i,
  /AbortError/i,
];

const EXTENSION = /(chrome|moz|safari(-web)?|ms-browser)-extension:\/\//i;

function clamp(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** A path on this site, without its query: never someone else's URL or a payload. */
function ourPath(value: unknown) {
  const raw = clamp(value, MAX_PATH * 2);
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return "";
  return raw.split(/[?#]/)[0].slice(0, MAX_PATH);
}

/** Our own script, as /_next/... — an address elsewhere is someone else's code. */
function ourScript(value: unknown, origin: string) {
  const raw = clamp(value, 500);
  if (!raw) return "";
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return null;
    return url.pathname.slice(0, 200);
  } catch {
    return null;
  }
}

export function clientErrorFrom(raw: unknown, origin: string): ClientError | null {
  const body = (raw ?? {}) as Record<string, unknown>;
  const kind: ClientErrorKind = body.kind === "rejection" ? "rejection" : "error";
  const message = clamp(body.message, MAX_MESSAGE);
  const path = ourPath(body.path);
  const stack = typeof body.stack === "string" ? body.stack.slice(0, MAX_STACK) : "";

  if (!message || !path) return null;
  if (NOISE.some((pattern) => pattern.test(message))) return null;
  if (EXTENSION.test(stack) || EXTENSION.test(clamp(body.source, 500))) return null;

  const script = ourScript(body.source, origin);
  // A script from another site (an ad, an extension, a tampered page) is not
  // ours to fix; the CSP report already covers what should not be there.
  if (script === null) return null;

  const line = Number(body.line);
  const column = Number(body.column);
  const at = script && Number.isFinite(line) && line > 0 ? `${script}:${line}${Number.isFinite(column) && column > 0 ? `:${column}` : ""}` : script;

  return {
    kind,
    message,
    path,
    ...(at ? { where: at } : {}),
    ...(stack ? { stack } : {}),
  };
}
