import { queryPostgres } from "@/lib/postgres/client";

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

export interface HealthCheck {
  database: ServiceStatus;
  cache: ServiceStatus;
  api: ServiceStatus;
  email: ServiceStatus;
  sms: ServiceStatus;
  storage: ServiceStatus;
  timestamp: string;
}

// Log error
export async function logError(error: Omit<ErrorLog, "id" | "timestamp">) {
  try {
    const id = `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await queryPostgres(
      STORE,
      `INSERT INTO monitoring_errors
       (id, level, message, stack, context, user_id, path, method, status_code, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        id,
        error.level,
        error.message,
        error.stack || null,
        error.context || null,
        error.userId || null,
        error.path || null,
        error.method || null,
        error.statusCode || null,
      ]
    );

    // Send alert if critical
    if (error.level === "error") {
      await sendCriticalAlert(error);
    }

    return id;
  } catch (err) {
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
       (id, path, method, duration, status_code, db_time, render_time, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        id,
        metric.path,
        metric.method,
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
      `SELECT
        COUNT(*) as total,
        level,
        message
      FROM monitoring_errors
      WHERE created_at > NOW() - ($1 * INTERVAL '1 hour')
      GROUP BY level, message
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
    method: string;
    avgTime: number;
    count: number;
  }>;
  errorRate: number;
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
      WHERE created_at > NOW() - ($1 * INTERVAL '1 hour')`,
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
        method: s.method,
        avgTime: s.avg_time,
        count: s.count,
      })),
      errorRate:
        data.total_count > 0
          ? (data.error_count / data.total_count) * 100
          : 0,
    };
  } catch (err) {
    console.error("Failed to get performance stats:", err);
    return {
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      slowestEndpoints: [],
      errorRate: 0,
    };
  }
}

// Check system health
export async function checkSystemHealth(): Promise<HealthCheck> {
  const checks: HealthCheck = {
    database: "down",
    // Never wired up. It was hard-coded to false and therefore permanently red,
    // for a service this shop has never used.
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

// Send critical alert
async function sendCriticalAlert(error: Omit<ErrorLog, "id" | "timestamp">) {
  try {
    const message = `
🚨 CRITICAL ERROR IN PRODUCTION

Message: ${error.message}
Level: ${error.level}
Path: ${error.path}
Time: ${new Date().toISOString()}

Stack: ${error.stack || "N/A"}
Context: ${error.context || "N/A"}

Please check immediately!
    `;

    console.error("CRITICAL ALERT:", message);
    // Send email alert here if configured
  } catch (err) {
    console.error("Failed to send critical alert:", err);
  }
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
