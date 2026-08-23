import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const REPORTER = "components/SpeedReporter.tsx";
const API = "app/api/monitoring/vitals/route.ts";
const LIB = "lib/monitoring.ts";
const DASHBOARD = "components/admin/MonitoringDashboard.tsx";

/** Source with comments removed. */
function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

/**
 * The monitoring screen showed "Avg Response Time" with nothing under it,
 * because nothing had ever written a figure there — and a figure taken on the
 * server would not have been worth much: a prerendered page answers in a few
 * milliseconds while the shopper on a Nepali mobile connection still waits
 * seconds for it to appear. Only the shopper's browser can take the number that
 * matters.
 */
describe("measuring how fast the shop felt", () => {
  it("is taken in the shopper's browser", async () => {
    const reporter = await readFile(REPORTER, "utf8");

    expect(reporter).toContain('"use client"');
    expect(reporter).toContain("useReportWebVitals");
  });

  it("survives the navigation it is measuring", async () => {
    const reporter = await readFile(REPORTER, "utf8");

    // A plain fetch is cancelled by the page unloading; sendBeacon is handed to
    // the browser to deliver afterwards.
    expect(reporter).toContain("navigator.sendBeacon");
    expect(reporter).toContain("keepalive: true");
  });

  it("leaves the owner's own screens out", async () => {
    const reporter = await readFile(REPORTER, "utf8");

    // Admin is used from a desk on wifi and would drag every average towards a
    // speed no customer sees — the same reason it is cut from visitor counts.
    expect(reporter).toContain("INTERNAL_PATH_PREFIXES");
  });

  it("never breaks a page over a measurement", async () => {
    const reporter = await readFile(REPORTER, "utf8");

    expect(reporter).toContain("try {");
    expect(reporter).toContain("catch {");
  });
});

/**
 * The endpoint is open by necessity — the measurement comes from a shopper who
 * has signed in to nothing. Open means anyone can post to it, so nothing that
 * arrives is trusted.
 */
describe("what the endpoint accepts", () => {
  it("takes only the measurements a real page produces", async () => {
    const api = await readFile(API, "utf8");

    expect(api).toContain('const METRICS = new Set(["LCP", "TTFB", "FCP", "INP", "CLS"])');
    expect(api).toContain("METRICS.has(metric)");
  });

  it("refuses a number no page could produce", async () => {
    const api = await readFile(API, "utf8");

    expect(api).toContain("!Number.isFinite(value) || value < 0 || value > MAX_VALUE_MS");
  });

  it("refuses a path that is not ours", async () => {
    const api = await readFile(API, "utf8");

    // Storing an attacker's text would put it on the owner's dashboard.
    expect(api).toContain('!path.startsWith("/") || path.includes("://")');
    expect(api).toContain("path.length > MAX_PATH");
  });

  it("keeps nothing about who was reading", async () => {
    const api = code(await readFile(API, "utf8"));

    // The point is which page is slow, not who found it slow.
    expect(api).not.toContain("userId");
    expect(api).not.toContain("ipAddress");
    expect(api).not.toContain("headers.get");
  });
});

/**
 * LCP runs in seconds and TTFB in tens of milliseconds. One average covering
 * both answers no question anyone has.
 */
describe("keeping the measurements apart", () => {
  it("records which one each row holds", async () => {
    const lib = await readFile(LIB, "utf8");

    expect(lib).toContain("metric.metric ?? null");
    expect(lib).toContain("(id, path, method, metric, duration");
  });

  it("builds the headline from LCP alone", async () => {
    const lib = await readFile(LIB, "utf8");
    const stats = lib.slice(lib.indexOf("export async function getPerformanceStats"));

    // Three of them now: the average and percentiles, the slowest pages, and
    // the count of readings set aside as not-the-shop. Every one has to filter
    // to LCP, or a TTFB in tens of milliseconds is averaged with an LCP in
    // seconds and the figure answers no question anyone has.
    expect([...stats.matchAll(/COALESCE\(metric, 'LCP'\) = 'LCP'/g)]).toHaveLength(3);
  });
});

describe("what the dashboard claims", () => {
  it("no longer calls it a response time", async () => {
    const dashboard = code(await readFile(DASHBOARD, "utf8"));

    // It is what the shopper waited to see, not what the server took.
    expect(dashboard).not.toContain("Avg Response Time");
    expect(dashboard).toContain("पाना देखिन लाग्ने समय");
  });

  it("says so when nobody has visited yet", async () => {
    const dashboard = await readFile(DASHBOARD, "utf8");

    // Zero seconds would read as instant, which is the opposite of the truth.
    expect(dashboard).toContain("अझै कुनै ग्राहक आएका छैनन्");
  });
});

/**
 * The panel said two things the numbers did not.
 *
 * It ranked two readings of one page as "the slowest page", which reads as a
 * fault and was nothing of the kind — 428ms is a good time and it was the only
 * page anybody had measured. And it coloured anything over 1000ms as a warning,
 * so that good time was drawn in yellow. The owner spotted it, which is exactly
 * the reflex a dashboard should never have to survive.
 */
describe("what the speed panel claims", () => {
  it("does not call a single reading a ranking", async () => {
    const dashboard = await readFile(DASHBOARD, "utf8");

    expect(dashboard).toContain("monitoring.performance.samples < 10");
    expect(dashboard).toContain("भरपर्दो क्रम देखाउन कम्तीमा १० चाहिन्छ");
  });

  it("says how many readings it rests on", async () => {
    const dashboard = await readFile(DASHBOARD, "utf8");
    const lib = await readFile(LIB, "utf8");

    expect(lib).toContain("samples: data.total_count");
    expect(dashboard).toContain("नाप`");
  });

  it("judges a time against the bar the shop is actually judged by", async () => {
    const dashboard = code(await readFile(DASHBOARD, "utf8"));

    // Google's own Largest Contentful Paint thresholds — 2.5s good, 4s needs
    // work. The old rule called everything over one second a warning.
    expect(dashboard).toContain("endpoint.avgTime <= 2500");
    expect(dashboard).toContain("endpoint.avgTime <= 4000");
    expect(dashboard).not.toContain("endpoint.avgTime > 1000");
  });

  it("keeps the rating out of the page address", async () => {
    const dashboard = code(await readFile(DASHBOARD, "utf8"));

    // It was printed against the path — "good /account/reset-password" — where
    // it read as part of the address.
    expect(dashboard).not.toContain("{endpoint.method} {endpoint.path}");
    expect(dashboard).toContain("endpoint.rating");
  });

  it("says nothing rather than a ranking of nothing", async () => {
    const dashboard = await readFile(DASHBOARD, "utf8");

    expect(dashboard).toContain("अझै कुनै ग्राहक आएका छैनन् — नाप्ने कुरा भएपछि");
  });
});

/**
 * Every metric was being recorded twice.
 *
 * useReportWebVitals registers its listeners inside an effect keyed on the
 * function it is handed, and never removes the ones already added:
 *
 *   useEffect(() => { onCLS(fn); onLCP(fn); ... }, [reportWebVitalsFn])
 *
 * An inline arrow is a new function every render, so every render added a
 * second set of listeners on top of the first. A shopper who landed on the home
 * page and tapped through to Contact changed the pathname, re-rendered the
 * reporter, and reported that page's metrics twice — identical values,
 * identical timestamps. Six rows in the table were three visits, and the
 * average counted the slow page twice over.
 */
describe("counting each measurement once", () => {
  it("hands the hook one function that never changes", async () => {
    const reporter = await readFile(REPORTER, "utf8");

    expect(reporter).toContain("useReportWebVitals(useCallback((metric)");
    expect(reporter).toContain("}, []));");
  });

  it("reads the path without making the function change", async () => {
    const reporter = await readFile(REPORTER, "utf8");

    // A stable callback cannot close over pathname, or it would change with it
    // and register a second time — the bug it is written to avoid.
    expect(reporter).toContain("const pathRef = useRef(pathname)");
    expect(reporter).toContain("const path = pathRef.current");
  });
});

/**
 * The functions ran in iad1 (Washington) against a Neon database in
 * ap-southeast-1 (Singapore), so every request that touched data crossed the
 * Pacific twice before a shopper in Narayangadh saw anything.
 */
describe("where the shop runs", () => {
  it("runs beside its database", async () => {
    const vercel = JSON.parse(await readFile("vercel.json", "utf8"));

    // The database round trip happens on every request; the shopper round trip
    // happens once. Putting the function beside the data wins, and Singapore is
    // far nearer Nepal than Washington besides.
    expect(vercel.regions).toEqual(["sin1"]);
  });

  it("still keeps its scheduled jobs", async () => {
    const vercel = JSON.parse(await readFile("vercel.json", "utf8"));

    expect(vercel.crons).toHaveLength(3);
  });
});

/**
 * A dev server and the shop were writing into the same table.
 *
 * `npm run dev` compiles a page the first time it is asked for, which takes ten
 * to twenty seconds. Those readings landed against the same paths as the live
 * shop's with nothing to tell them apart, so the dashboard reported /contact at
 * 20.6s and filed "Slow API: poor /contact took 20648ms" as an error — on a day
 * the live page answered the same request in 1.1s. The owner read it as an
 * outage, which is exactly what it looked like.
 */
describe("telling the shop from a laptop", () => {
  it("decides on the server, never from the browser", async () => {
    const lib = await readFile(LIB, "utf8");

    // A browser can say anything. VERCEL_ENV is set by the platform.
    expect(lib).toContain("export function metricEnvironment()");
    expect(lib).toContain("process.env.VERCEL_ENV");
  });

  it("catches a preview deployment, which NODE_ENV alone does not", async () => {
    const lib = await readFile(LIB, "utf8");
    const fn = lib.slice(lib.indexOf("export function metricEnvironment"));

    // A Vercel preview runs with NODE_ENV=production, so the browser-side guard
    // would wave it through as though it were the shop.
    expect(fn).toContain('if (vercelEnv === "preview") return "preview"');
  });

  it("also refuses to send from a dev server at all", async () => {
    const reporter = await readFile(REPORTER, "utf8");

    // Belt and braces: the browser does not send it, and the server would not
    // have counted it if it had.
    expect(reporter).toContain('if (process.env.NODE_ENV !== "production") return;');
  });

  it("counts only the shop", async () => {
    const lib = await readFile(LIB, "utf8");
    const stats = lib.slice(lib.indexOf("export async function getPerformanceStats"));

    // Twice: the headline figures, and the per-page list.
    expect([...stats.matchAll(/AND environment = 'production'/g)]).toHaveLength(2);
  });

  it("sets the rest aside rather than deleting them", async () => {
    const lib = await readFile(LIB, "utf8");
    const dashboard = await readFile(DASHBOARD, "utf8");

    // A reading from a laptop is real and is sometimes the only way to tell
    // whether a change helped. It is kept, counted, and named on screen — a
    // number quietly removed is its own kind of dishonesty.
    expect(lib).toContain("AND environment <> 'production'");
    expect(lib).toContain("setAside: Number(aside[0]?.n) || 0");
    expect(dashboard).toContain("monitoring.performance.setAside > 0");
    expect(dashboard).toContain("माथिको हिसाबमा गनिएको छैन");
  });

  it("does not raise a slow-page warning about a laptop", async () => {
    const lib = await readFile(LIB, "utf8");

    // This is what filled the owner's error log with a page that was never slow.
    expect(lib).toContain('if (metric.duration > 5000 && environment === "production")');
  });

  it("stamps every row, so nothing arrives unlabelled", async () => {
    const lib = await readFile(LIB, "utf8");
    const sql = await readFile("scripts/migrations/20260823_metric_environment.sql", "utf8");

    expect(lib).toContain("const environment = metricEnvironment();");
    expect(lib).toContain("user_id, environment, created_at)");
    expect(sql).toContain("environment text NOT NULL DEFAULT 'production'");
  });
});
