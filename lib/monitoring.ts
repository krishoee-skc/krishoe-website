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

export interface HealthCheck {
  database: boolean;
  cache: boolean;
  api: boolean;
  email: boolean;
  sms: boolean;
  storage: boolean;
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
    const results = await queryPostgres<any>(
      STORE,
      `SELECT
        COUNT(*) as total,
        level,
        message
      FROM monitoring_errors
      WHERE created_at > NOW() - INTERVAL '${hours} hours'
      GROUP BY level, message
      ORDER BY COUNT(*) DESC
      LIMIT 50`,
      []
    );

    const totalErrors = results.reduce((sum, r) => sum + r.total, 0);
    const errorsByLevel: Record<string, number> = {};
    const topErrors: Array<{ message: string; count: number }> = [];

    results.forEach((r) => {
      if (!errorsByLevel[r.level]) {
        errorsByLevel[r.level] = 0;
      }
      errorsByLevel[r.level] += r.total;
      topErrors.push({ message: r.message, count: r.total });
    });

    const recent = await queryPostgres<ErrorLog>(
      STORE,
      `SELECT * FROM monitoring_errors
       WHERE created_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY created_at DESC
       LIMIT 20`,
      []
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
      WHERE created_at > NOW() - INTERVAL '${hours} hours'`,
      []
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
      WHERE created_at > NOW() - INTERVAL '${hours} hours'
      GROUP BY path, method
      ORDER BY avg_time DESC
      LIMIT 10`,
      []
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
    database: false,
    cache: false,
    api: false,
    email: false,
    sms: false,
    storage: false,
    timestamp: new Date().toISOString(),
  };

  // Database check
  try {
    await queryPostgres(STORE, "SELECT 1", []);
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // API check
  try {
    const response = await fetch(
      `${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"}/api/health`,
      { method: "GET" }
    );
    checks.api = response.ok;
  } catch {
    checks.api = false;
  }

  // Email check (Brevo)
  checks.email = !!process.env.BREVO_API_KEY;

  // SMS check (Twilio)
  checks.sms = !!process.env.TWILIO_ACCOUNT_SID;

  // Storage check
  checks.storage = !!process.env.BLOB_READ_WRITE_TOKEN;

  return checks;
}

// Send critical alert
async function sendCriticalAlert(error: Omit<ErrorLog, "id" | "timestamp">) {
  try {
    const adminEmail = "design.cad.tsa@gmail.com";
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
    const result = await queryPostgres<{ uptime: number }>(
      STORE,
      `SELECT
        (COUNT(CASE WHEN status = 'up' THEN 1 END)::float / COUNT(*) * 100)::numeric(5,2) as uptime
      FROM monitoring_uptime
      WHERE checked_at > NOW() - INTERVAL '${days} days'`,
      []
    );

    return result[0]?.uptime ? parseFloat(String(result[0].uptime)) : 0;
  } catch (err) {
    console.error("Failed to get uptime percentage:", err);
    return 0;
  }
}
