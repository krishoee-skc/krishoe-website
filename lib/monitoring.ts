import { fingerprintFailure } from "@/lib/error-fingerprint";
import { queryPostgres } from "@/lib/postgres/client";
import { getSiteUrl } from "@/lib/seo";

const STORE = "krishoe";

export interface ErrorLog {
  id: string;
  timestamp: string;
  level: "error" | "warning" | "info";
  message: string;
  stack?: string;
  context?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
}

export interface PerformanceMetric {
  id: string;
  timestamp: string;
  path: string;
  method: string;
  /**
   * Which measurement this row holds — LCP, TTFB, INP and friends.
   *
   * Without it an average over the table mixes a paint time with a byte time
   * and means nothing: LCP runs in seconds, TTFB in tens of milliseconds, and
   * one figure covering both answers no question anyone has.
   */
  metric?: string;
  duration: number; // milliseconds
  statusCode: number;
  dbTime?: number;
  renderTime?: number;
  userId?: string;
}

export interface UptimeStatus {
  timestamp: string;
  status: "up" | "down";
  responseTime: number;
  statusCode: number;
  region: string;
}

/**
 * Three states, because a boolean could not tell the truth here.
 *
 * The dashboard reported Email, SMS and Cache as "Down" in alarming red, and
 * none of them was broken. Email was working the whole time — the check simply
 * read the wrong variable. SMS and Cache have never been set up, because the
 * shop does not use them; calling that an outage teaches the owner to ignore
 * red, which is the one thing a health screen must never do.
 *
 * - "up"        — checked just now, and it answered.
 * - "off"       — deliberately not set up. Nothing is wrong.
 * - "down"      — configured, and it failed. This is the only red.
 */
export type ServiceStatus = "up" | "off" | "down";

/**
 * What "Cache" means for this shop, and why the check has to go and ask.
 *
 * The field was hard-coded to "off" and had never looked at anything, which
 * read on the dashboard as a service the shop had failed to buy. There is no
 * such service, and none is wanted. The shop's pages are prerendered and served
 * from Vercel's edge cache — /shop, the category pages and the home page all
 * answer from it — so the cache is not merely set up, it is the fastest part of
 * the site. Putting a cache server in front of that would buy a second thing
 * that can go down in exchange for pages that are already being served from
 * memory at the edge.
 *
 * So ask the cache itself. Every response Vercel serves carries x-vercel-cache
 * saying how it was answered; a HEAD request to a shopper's page reads it
 * without pulling the page down.
 */
export function cacheStatusFromHeader(header: string | null | undefined): ServiceStatus {
  const state = header?.trim().toUpperCase();

  // No header at all means nothing is in front of the app: local development,
  // or a host that does not cache. Not a fault, and not something to fix.
  if (!state) return "off";

  // Caching deliberately switched off for this route.
  if (state === "BYPASS") return "off";

  // HIT and STALE are the cache answering. PRERENDER and MISS are the cache
  // filling — the first request after every deploy is a MISS, and calling that
  // an outage would put the card in red several times a week for nothing.
  return "up";
}

export const CACHE_PROBE_PATH = "/shop";

/**
 * Which machine the env-derived checks are describing.
 *
 * Storage, Email and SMS are read off environment variables, and environment
 * variables belong to whatever machine is rendering the page. Run the dashboard
 * on the owner's laptop and it reports the laptop: Storage came up "Not set up"
 * while the live shop had a Blob store with four product photos in it, serving
 * them fine. The screen exists to say whether the shop is well, so it has to say
 * which machine it is actually looking at.
 */
export type HealthScope = "live" | "local";

/** Vercel sets VERCEL=1 on its own servers and nowhere else. */
export function healthScope(): HealthScope {
  return process.env.VERCEL ? "live" : "local";
}

export interface HealthCheck {
  scope: HealthScope;
  database: ServiceStatus;
  cache: ServiceStatus;
  api: ServiceStatus;
  email: ServiceStatus;
  sms: ServiceStatus;
  storage: ServiceStatus;
  timestamp: string;
}

const MESSAGE_MAX = 500;
const STACK_MAX = 4000;

/**
 * Writing a failure down must never itself become the failure.
 *
 * When the database is what broke, every request that fails then tries to
 * record that failure in the database that is failing. The shop spends the
 * capacity it has left on writes that cannot land, each one waiting out its own
 * connection timeout, and the outage gets worse for being logged. After a few
 * refusals in a row this stops trying and comes back in a minute. Nothing is
 * lost that was not already lost: reportError writes its console line either
 * way, and a database that is down is exactly the thing the health check and
 * the uptime monitor are watching for.
 */
const WRITE_FAILURE_LIMIT = 3;
const WRITE_PAUSE_MS = 60_000;
let consecutiveWriteFailures = 0;
let writesPausedUntil = 0;

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Record a failure so /admin/monitoring can show it. Never throws. */
export async function logError(error: Omit<ErrorLog, "id" | "timestamp">) {
  if (Date.now() < writesPausedUntil) {
    return;
  }

  try {
    const id = `err-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    await queryPostgres(
      STORE,
      `INSERT INTO monitoring_errors
       (id, level, message, fingerprint, stack, context, user_id, path, method, status_code, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        id,
        error.level,
        // A message is a sentence for a person to read. A stack that arrives in
        // this field unbounded is a row the dashboard cannot render and a table
        // that grows without limit; the full text goes in `stack`.
        truncate(error.message, MESSAGE_MAX),
        fingerprintFailure(error.message),
        error.stack ? truncate(error.stack, STACK_MAX) : null,
        error.context || null,
        error.userId || null,
        error.path || null,
        error.method || null,
        error.statusCode || null,
      ]
    );

    consecutiveWriteFailures = 0;
    return id;
  } catch (err) {
    consecutiveWriteFailures += 1;

    if (consecutiveWriteFailures >= WRITE_FAILURE_LIMIT) {
      writesPausedUntil = Date.now() + WRITE_PAUSE_MS;
      consecutiveWriteFailures = 0;
    }

    // Deliberately console, not reportError. reportError calls this function,
    // so reporting from here would turn one failed write into an unbounded
    // chain of them.
    console.error("Failed to log error:", err);
  }
}

// Log performance metric
export async function logPerformanceMetric(
  metric: Omit<PerformanceMetric, "id" | "timestamp">
) {
  try {
    const id = `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await queryPostgres(
      STORE,
      `INSERT INTO monitoring_performance
       (id, path, method, metric, duration, status_code, db_time, render_time, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        id,
        metric.path,
        metric.method,
        metric.metric ?? null,
        metric.duration,
        metric.statusCode,
        metric.dbTime || null,
        metric.renderTime || null,
        metric.userId || null,
      ]
    );

    // Alert if slow
    if (metric.duration > 5000) {
      // 5 seconds
      await logError({
        level: "warning",
        message: `Slow API: ${metric.method} ${metric.path} took ${metric.duration}ms`,
        context: "Performance",
        path: metric.path,
      });
    }

    return id;
  } catch (err) {
    console.error("Failed to log performance metric:", err);
  }
}

// Record uptime check
export async function recordUptimeCheck(status: Omit<UptimeStatus, "timestamp">) {
  try {
    await queryPostgres(
      STORE,
      `INSERT INTO monitoring_uptime
       (status, response_time, status_code, region, checked_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [status.status, status.responseTime, status.statusCode, status.region]
    );
  } catch (err) {
    console.error("Failed to record uptime check:", err);
  }
}

export const MONITORING_RETENTION_DAYS = 90;

/**
 * Drop monitoring rows older than the window the dashboard can show.
 *
 * Nothing writes to these tables on purpose — they fill up when things go
 * wrong — so an unbounded table is a slow leak that only widens on the shop's
 * worst days, and the screen never looks back further than thirty days anyway.
 * Called once a day from the sales cron, which already runs and already has no
 * other reason to fail. Never throws: a prune that could not run is not a
 * reason to fail a night's summaries.
 */
export async function pruneOldMonitoringRows() {
  try {
    await queryPostgres(
      STORE,
      `DELETE FROM monitoring_errors WHERE created_at < NOW() - ($1 * INTERVAL '1 day')`,
      [MONITORING_RETENTION_DAYS]
    );
    await queryPostgres(
      STORE,
      `DELETE FROM monitoring_performance WHERE created_at < NOW() - ($1 * INTERVAL '1 day')`,
      [MONITORING_RETENTION_DAYS]
    );
    await queryPostgres(
      STORE,
      `DELETE FROM monitoring_uptime WHERE checked_at < NOW() - ($1 * INTERVAL '1 day')`,
      [MONITORING_RETENTION_DAYS]
    );
  } catch (err) {
    console.error("Failed to prune monitoring rows:", err);
  }
}

// Get error statistics
export async function getErrorStats(hours: number = 24): Promise<{
  totalErrors: number;
  errorsByLevel: Record<string, number>;
  topErrors: Array<{ message: string; count: number }>;
  recentErrors: ErrorLog[];
}> {
  try {
    const normalizedHours = Number.isFinite(hours) ? Math.trunc(hours) : 24;
    const safeHours = Math.min(Math.max(normalizedHours, 1), 24 * 30);
    const results = await queryPostgres<{
      total: number | string;
      level: string;
      message: string;
    }>(
      STORE,
      // Grouped on the fingerprint, so one fault that struck fifty orders is
      // one row reading 50x instead of fifty rows each reading 1x. The message
      // shown is the most recent of the group, which is the one whose ids and
      // amounts are still worth looking up.
      `SELECT
        COUNT(*)::integer as total,
        level,
        (array_agg(message ORDER BY created_at DESC))[1] as message
      FROM monitoring_errors
      WHERE created_at > NOW() - ($1 * INTERVAL '1 hour')
      GROUP BY level, COALESCE(fingerprint, message)
      ORDER BY COUNT(*) DESC
      LIMIT 50`,
      [safeHours]
    );

    const totalErrors = results.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    const errorsByLevel: Record<string, number> = {};
    const topErrors: Array<{ message: string; count: number }> = [];

    results.forEach((r) => {
      if (!errorsByLevel[r.level]) {
        errorsByLevel[r.level] = 0;
      }
      const count = Number(r.total) || 0;
      errorsByLevel[r.level] += count;
      topErrors.push({ message: r.message, count });
    });

    const recent = await queryPostgres<ErrorLog>(
      STORE,
      `SELECT * FROM monitoring_errors
       WHERE created_at > NOW() - ($1 * INTERVAL '1 hour')
       ORDER BY created_at DESC
       LIMIT 20`,
      [safeHours]
    );

    return {
      totalErrors,
      errorsByLevel,
      topErrors: topErrors.slice(0, 10),
      recentErrors: recent,
    };
  } catch (err) {
    console.error("Failed to get error stats:", err);
    return {
      totalErrors: 0,
      errorsByLevel: {},
      topErrors: [],
      recentErrors: [],
    };
  }
}

// Get performance statistics
export async function getPerformanceStats(hours: number = 24): Promise<{
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  slowestEndpoints: Array<{
    path: string;
    /** good, needs-improvement or poor — the browser's own verdict. */
    rating: string;
    avgTime: number;
    count: number;
  }>;
  errorRate: number;
  /**
   * How many measurements the figures above rest on.
   *
   * Two readings of one page were being shown as "the slowest page", which
   * reads as a fault and was nothing of the kind — 428ms is a good time, and it
   * was the only page anyone had measured. A ranking has to say how much of one
   * it is, or the first entry looks like a finding.
   */
  samples: number;
}> {
  try {
    const normalizedHours = Number.isFinite(hours) ? Math.trunc(hours) : 24;
    const safeHours = Math.min(Math.max(normalizedHours, 1), 24 * 30);
    const stats = await queryPostgres<{
      avg_time: number;
      p95_time: number;
      p99_time: number;
      error_count: number;
      total_count: number;
    }>(
      STORE,
      `SELECT
        ROUND(AVG(duration))::integer as avg_time,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration)::integer as p95_time,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration)::integer as p99_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END)::integer as error_count,
        COUNT(*)::integer as total_count
      FROM monitoring_performance
      WHERE created_at > NOW() - ($1 * INTERVAL '1 hour')
        AND COALESCE(metric, 'LCP') = 'LCP'`,
      [safeHours]
    );

    const data = stats[0] || {
      avg_time: 0,
      p95_time: 0,
      p99_time: 0,
      error_count: 0,
      total_count: 0,
    };

    const slowest = await queryPostgres<{
      path: string;
      method: string;
      avg_time: number;
      count: number;
    }>(
      STORE,
      `SELECT
        path,
        method,
        ROUND(AVG(duration))::integer as avg_time,
        COUNT(*)::integer as count
      FROM monitoring_performance
      WHERE created_at > NOW() - ($1 * INTERVAL '1 hour')
        AND COALESCE(metric, 'LCP') = 'LCP'
      GROUP BY path, method
      ORDER BY avg_time DESC
      LIMIT 10`,
      [safeHours]
    );

    return {
      avgResponseTime: data.avg_time,
      p95ResponseTime: data.p95_time,
      p99ResponseTime: data.p99_time,
      slowestEndpoints: slowest.map((s) => ({
        path: s.path,
        // The column holds the browser's rating for these rows, not an HTTP
        // verb. It was being drawn glued to the path — "good /account/reset-
        // password" — which reads as part of the address.
        rating: s.method,
        avgTime: s.avg_time,
        count: s.count,
      })),
      errorRate:
        data.total_count > 0
          ? (data.error_count / data.total_count) * 100
          : 0,
      samples: data.total_count,
    };
  } catch (err) {
    console.error("Failed to get performance stats:", err);
    return {
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      slowestEndpoints: [],
      samples: 0,
      errorRate: 0,
    };
  }
}

// Check system health
export async function checkSystemHealth(): Promise<HealthCheck> {
  const checks: HealthCheck = {
    scope: healthScope(),
    database: "down",
    cache: "off",
    api: "down",
    email: "off",
    sms: "off",
    storage: "off",
    timestamp: new Date().toISOString(),
  };

  // Database check
  try {
    await queryPostgres(STORE, "SELECT 1", []);
    checks.database = "up";
  } catch {
    checks.database = "down";
  }

  // API check
  try {
    const response = await fetch(
      `${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"}/api/health`,
      { method: "GET" }
    );
    checks.api = response.ok ? "up" : "down";
  } catch {
    checks.api = "down";
  }

  // Cache. Read from the page a shopper actually loads, over the public
  // address — VERCEL_URL points at the deployment itself, which answers from
  // the function and never carries a cache header at all.
  try {
    const response = await fetch(`${getSiteUrl()}${CACHE_PROBE_PATH}`, {
      method: "HEAD",
      cache: "no-store",
    });
    checks.cache = response.ok
      ? cacheStatusFromHeader(response.headers.get("x-vercel-cache"))
      : "down";
  } catch {
    checks.cache = "down";
  }

  // Email. This read BREVO_API_KEY, which is the key for reading delivery
  // statistics — not the one that sends anything. Mail has been going out
  // through EMAIL_PROVIDER_URL the whole time, and the dashboard called it
  // Down because it was looking at the wrong variable.
  checks.email = process.env.EMAIL_PROVIDER_URL?.trim() ? "up" : "off";

  // Twilio was never bought. "Not set up" is the honest word for that.
  checks.sms = process.env.TWILIO_ACCOUNT_SID?.trim() ? "up" : "off";

  checks.storage = process.env.BLOB_READ_WRITE_TOKEN?.trim() ? "up" : "off";

  return checks;
}

// Get uptime percentage
export async function getUptimePercentage(days: number = 30): Promise<number> {
  try {
    const normalizedDays = Number.isFinite(days) ? Math.trunc(days) : 30;
    const safeDays = Math.min(Math.max(normalizedDays, 1), 366);
    const result = await queryPostgres<{ uptime: number }>(
      STORE,
      `SELECT
        (COUNT(CASE WHEN status = 'up' THEN 1 END)::float / COUNT(*) * 100)::numeric(5,2) as uptime
      FROM monitoring_uptime
      WHERE checked_at > NOW() - ($1 * INTERVAL '1 day')`,
      [safeDays]
    );

    return result[0]?.uptime ? parseFloat(String(result[0].uptime)) : 0;
  } catch (err) {
    console.error("Failed to get uptime percentage:", err);
    return 0;
  }
}
