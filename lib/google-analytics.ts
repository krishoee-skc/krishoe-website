import crypto from "node:crypto";

/**
 * Reads the shop's Google Analytics numbers so they can be shown inside admin.
 *
 * The owner asked to see the numbers without leaving the app. Google Analytics
 * itself cannot be embedded — it refuses to be framed — so the only way is to
 * ask Google's API for the figures and render them ourselves.
 *
 * Talking to that API needs an OAuth token, which is obtained by signing a
 * short-lived assertion with a service account's private key. That is done here
 * with `node:crypto` rather than by adding `@google-analytics/data`: the
 * official package pulls in a gRPC stack for what is, in the end, two HTTPS
 * POSTs, and gRPC is the part most likely to misbehave on a serverless host.
 *
 * Nothing here throws at the caller. A dashboard that crashes the admin area
 * because Google had a bad minute is worse than one that says it could not
 * reach Google, so every failure comes back as a value.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

/**
 * Just the two values this reads. A plain record rather than NodeJS.ProcessEnv,
 * which this project declares with required keys — a test would otherwise have
 * to satisfy every one of them to pass in two strings.
 */
export type AnalyticsEnv = Record<string, string | undefined>;

export type AnalyticsConfig = {
  propertyId: string;
  clientEmail: string;
  privateKey: string;
};

export type ConfigResult =
  | { ok: true; config: AnalyticsConfig }
  | { ok: false; reason: string };

/**
 * Turns the two environment variables into a usable config, or explains why it
 * cannot.
 *
 * The reasons are written to be read by the owner, not by me — "key not set" is
 * something they can act on, a stack trace is not.
 *
 * The private key needs the most care. A PEM is multi-line, and pasting one
 * into a hosting dashboard commonly stores the newlines as the two characters
 * backslash-n. Signing with that fails deep inside OpenSSL with a message that
 * says nothing about newlines, so it is repaired here instead.
 */
export function readAnalyticsConfig(env: AnalyticsEnv = process.env): ConfigResult {
  const propertyId = (env.GA4_PROPERTY_ID ?? "").trim();
  const rawKey = (env.GA_SERVICE_ACCOUNT_KEY ?? "").trim();

  if (!propertyId && !rawKey) {
    return { ok: false, reason: "GA4_PROPERTY_ID र GA_SERVICE_ACCOUNT_KEY दुवै राखिएका छैनन्।" };
  }
  if (!propertyId) {
    return { ok: false, reason: "GA4_PROPERTY_ID राखिएको छैन।" };
  }
  if (!/^\d+$/.test(propertyId)) {
    // A very common mix-up: the G- measurement id is the one on every page and
    // the one the owner has seen; the Data API wants the numeric property id,
    // which lives in GA's admin screen and looks nothing like it.
    return {
      ok: false,
      reason: `GA4_PROPERTY_ID अंकमात्र हुनुपर्छ (जस्तै 512345678) — अहिले "${propertyId}" छ। G- वाला ID होइन।`,
    };
  }
  if (!rawKey) {
    return { ok: false, reason: "GA_SERVICE_ACCOUNT_KEY राखिएको छैन।" };
  }

  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(rawKey) as typeof parsed;
  } catch {
    return {
      ok: false,
      reason: "GA_SERVICE_ACCOUNT_KEY पढ्न सकिएन — Google ले दिएको JSON file को पूरै भित्री भाग टाँस्नुहोस्।",
    };
  }

  const clientEmail = (parsed.client_email ?? "").trim();
  const privateKey = (parsed.private_key ?? "").replace(/\\n/g, "\n").trim();

  if (!clientEmail || !privateKey) {
    return {
      ok: false,
      reason: "JSON मा client_email वा private_key भेटिएन — अधुरो file टाँसिएको हुनसक्छ।",
    };
  }

  return { ok: true, config: { propertyId, clientEmail, privateKey } };
}

/** Whether the dashboard has everything it needs to try. */
export function analyticsConfigured(env: AnalyticsEnv = process.env) {
  return readAnalyticsConfig(env).ok;
}

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Builds the signed assertion Google exchanges for an access token.
 *
 * Exported for its test: this is the one piece here that is pure, and the one
 * where a mistake produces an authentication error rather than a wrong number —
 * the kind of failure that is easy to blame on the key instead of the code.
 */
export function buildAssertion(config: AnalyticsConfig, nowSeconds: number) {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );

  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(config.privateKey);

  return `${header}.${claims}.${base64url(signature)}`;
}

// One token serves every request for an hour, and this module is reused across
// requests on a warm server, so it is kept rather than re-minted per page view.
// Keyed by client email so a rotated key is never served a stale token.
let cachedToken: { key: string; token: string; expiresAt: number } | null = null;

/** Exposed so tests start from a known state. */
export function resetAnalyticsTokenCache() {
  cachedToken = null;
}

async function getAccessToken(config: AnalyticsConfig) {
  const now = Math.floor(Date.now() / 1000);
  // Sixty seconds of headroom: a token that expires while in flight reads as an
  // authentication failure, which is the least informative error available.
  if (cachedToken && cachedToken.key === config.clientEmail && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: buildAssertion(config, now),
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  } | null;

  if (!response.ok || !payload?.access_token) {
    const detail = payload?.error_description ?? payload?.error ?? `HTTP ${response.status}`;
    throw new Error(`Google ले token दिएन — ${detail}`);
  }

  cachedToken = {
    key: config.clientEmail,
    token: payload.access_token,
    expiresAt: now + (payload.expires_in ?? 3600),
  };
  return cachedToken.token;
}

type ReportRow = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
type ReportResponse = { rows?: ReportRow[] };

async function runReport(config: AnalyticsConfig, body: unknown): Promise<ReportResponse> {
  const token = await getAccessToken(config);

  const response = await fetch(`${DATA_API}/properties/${config.propertyId}:runReport`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    // GA numbers move slowly and this page is opened by hand; a minute of
    // caching keeps a refresh from spending a Google quota unit each time.
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    if (response.status === 403) {
      throw new Error(
        `Google ले अनुमति दिएन — service account लाई GA property मा Viewer बनाउनुहोस्। (${detail})`,
      );
    }
    throw new Error(`Google बाट तथ्याङ्क आएन — HTTP ${response.status}. ${detail}`);
  }

  return (await response.json()) as ReportResponse;
}

const num = (row: ReportRow, index: number) => Number(row.metricValues?.[index]?.value ?? 0) || 0;
const dim = (row: ReportRow, index: number) => row.dimensionValues?.[index]?.value ?? "";

export type AnalyticsOverview = {
  users: number;
  pageViews: number;
  sessions: number;
  /** Whole seconds; GA returns a fractional average. */
  avgSeconds: number;
};

export type NamedCount = { label: string; count: number };

export type AnalyticsSnapshot = {
  days: number;
  overview: AnalyticsOverview;
  topPages: NamedCount[];
  channels: NamedCount[];
};

export type SnapshotResult =
  | { ok: true; snapshot: AnalyticsSnapshot }
  | { ok: false; reason: string; configured: boolean };

/**
 * Everything the dashboard shows, in one call.
 *
 * The three reports are requested together because they are independent and the
 * page cannot render until all three are in; run in series they would stack
 * three round trips to Google onto a page load.
 */
export async function fetchAnalyticsSnapshot(
  days = 28,
  env: AnalyticsEnv = process.env,
): Promise<SnapshotResult> {
  const configResult = readAnalyticsConfig(env);
  if (!configResult.ok) {
    return { ok: false, reason: configResult.reason, configured: false };
  }

  const { config } = configResult;
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];

  try {
    const [totals, pages, channels] = await Promise.all([
      runReport(config, {
        dateRanges,
        metrics: [
          { name: "activeUsers" },
          { name: "screenPageViews" },
          { name: "sessions" },
          { name: "averageSessionDuration" },
        ],
      }),
      runReport(config, {
        dateRanges,
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 10,
      }),
      runReport(config, {
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 8,
      }),
    ]);

    const totalRow = totals.rows?.[0] ?? {};

    return {
      ok: true,
      snapshot: {
        days,
        overview: {
          users: num(totalRow, 0),
          pageViews: num(totalRow, 1),
          sessions: num(totalRow, 2),
          avgSeconds: Math.round(num(totalRow, 3)),
        },
        topPages: (pages.rows ?? []).map((row) => ({
          label: dim(row, 0) || "/",
          count: num(row, 0),
        })),
        channels: (channels.rows ?? []).map((row) => ({
          label: dim(row, 0) || "Unknown",
          count: num(row, 0),
        })),
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Google सँग जोडिन सकिएन।",
      configured: true,
    };
  }
}
