import { queryPostgres } from "@/lib/postgres/client";

const STORE = "krishoe";

export interface TrendDataPoint {
  date: string;
  label: string;
  value: number;
  target?: number;
}

export interface AnalyticsMetric {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "flat";
}

export interface GoalTracker {
  id: string;
  name: string;
  target: number;
  achieved: number;
  progress: number;
  status: "on_track" | "ahead" | "behind";
  deadline: string;
}

export interface ForcastData {
  period: string;
  predicted: number;
  confidence: number;
  baseline: number;
}

export interface WorkerPerformanceMetric {
  workerId: string;
  workerName: string;
  pairsThisMonth: number;
  earningsThisMonth: number;
  qualityRate: number;
  attendanceRate: number;
  bonusEligible: boolean;
  bonusAmount: number;
}

// Get sales trend (last 30 days)
export async function getSalesTrend(): Promise<TrendDataPoint[]> {
  try {
    const results = await queryPostgres<{
      date: string;
      total_sales: number;
    }>(
      STORE,
      `WITH RECURSIVE date_range AS (
        SELECT CURRENT_DATE - INTERVAL '30 days' as date
        UNION ALL
        SELECT date + INTERVAL '1 day' FROM date_range
        WHERE date < CURRENT_DATE
      )
      SELECT
        date_range.date,
        COALESCE(COUNT(o.id), 0)::integer as total_sales
      FROM date_range
      LEFT JOIN orders o ON o.created_at::date = date_range.date
      GROUP BY date_range.date
      ORDER BY date_range.date`,
      []
    );

    return results.map((r) => ({
      date: r.date,
      label: new Date(r.date).toLocaleDateString("default", {
        month: "short",
        day: "numeric",
      }),
      value: r.total_sales,
    }));
  } catch (error) {
    console.error("Failed to get sales trend:", error);
    return [];
  }
}

// Get production trend (last 30 days)
export async function getProductionTrend(): Promise<TrendDataPoint[]> {
  try {
    const results = await queryPostgres<{
      date: string;
      total_pairs: number;
    }>(
      STORE,
      `WITH RECURSIVE date_range AS (
        SELECT CURRENT_DATE - INTERVAL '30 days' as date
        UNION ALL
        SELECT date + INTERVAL '1 day' FROM date_range
        WHERE date < CURRENT_DATE
      )
      SELECT
        date_range.date,
        COALESCE(SUM(pwe.total_pairs), 0)::integer as total_pairs
      FROM date_range
      LEFT JOIN production_work_entries pwe ON pwe.work_date = date_range.date
      GROUP BY date_range.date
      ORDER BY date_range.date`,
      []
    );

    return results.map((r) => ({
      date: r.date,
      label: new Date(r.date).toLocaleDateString("default", {
        month: "short",
        day: "numeric",
      }),
      value: r.total_pairs,
    }));
  } catch (error) {
    console.error("Failed to get production trend:", error);
    return [];
  }
}

// Get revenue trend (last 30 days)
export async function getRevenueTrend(): Promise<TrendDataPoint[]> {
  try {
    const results = await queryPostgres<{
      date: string;
      total_revenue: number;
    }>(
      STORE,
      `WITH RECURSIVE date_range AS (
        SELECT CURRENT_DATE - INTERVAL '30 days' as date
        UNION ALL
        SELECT date + INTERVAL '1 day' FROM date_range
        WHERE date < CURRENT_DATE
      )
      SELECT
        date_range.date,
        COALESCE(SUM(CAST(SUBSTRING(o.total FROM '[0-9]+') AS INTEGER)), 0)::integer as total_revenue
      FROM date_range
      LEFT JOIN orders o ON o.created_at::date = date_range.date
      WHERE o.status IN ('Closed', 'Contacted')
      GROUP BY date_range.date
      ORDER BY date_range.date`,
      []
    );

    return results.map((r) => ({
      date: r.date,
      label: new Date(r.date).toLocaleDateString("default", {
        month: "short",
        day: "numeric",
      }),
      value: r.total_revenue,
    }));
  } catch (error) {
    console.error("Failed to get revenue trend:", error);
    return [];
  }
}

// Get key metrics comparison (this month vs last month)
export async function getKeyMetrics(): Promise<AnalyticsMetric[]> {
  try {
    const currentMonth = new Date();
    const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);

    const metrics = await queryPostgres<{
      metric: string;
      current_value: number;
      previous_value: number;
    }>(
      STORE,
      `SELECT
        'Orders' as metric,
        COUNT(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE)::date THEN 1 END)::integer as current_value,
        COUNT(CASE WHEN created_at >= $1 AND created_at < date_trunc('month', CURRENT_DATE)::date THEN 1 END)::integer as previous_value
      FROM orders
      UNION ALL
      SELECT
        'Production',
        COALESCE(SUM(CASE WHEN work_date >= date_trunc('month', CURRENT_DATE)::date THEN total_pairs ELSE 0 END), 0)::integer,
        COALESCE(SUM(CASE WHEN work_date >= $1 AND work_date < date_trunc('month', CURRENT_DATE)::date THEN total_pairs ELSE 0 END), 0)::integer
      FROM production_work_entries
      UNION ALL
      SELECT
        'Workers',
        COUNT(DISTINCT CASE WHEN status = 'Active' THEN id END)::integer,
        COUNT(DISTINCT CASE WHEN status = 'Active' THEN id END)::integer
      FROM hr_employees`,
      [lastMonth]
    );

    return metrics.map((m) => {
      const change = m.current_value - m.previous_value;
      const changePercent =
        m.previous_value > 0 ? ((change / m.previous_value) * 100).toFixed(1) : 0;
      return {
        metric: m.metric,
        current: m.current_value,
        previous: m.previous_value,
        change,
        changePercent: Number(changePercent),
        trend:
          change > 0 ? "up" : change < 0 ? "down" : "flat",
      };
    });
  } catch (error) {
    console.error("Failed to get key metrics:", error);
    return [];
  }
}

// Production forecast (next 30 days based on current trend)
export async function getProductionForecast(): Promise<ForcastData[]> {
  try {
    const trend = await getProductionTrend();

    // Calculate average daily production from last 7 days
    const last7Days = trend.slice(-7);
    const avgDaily =
      last7Days.reduce((sum, d) => sum + d.value, 0) / last7Days.length;

    // Generate forecast
    const forecast: ForcastData[] = [];
    for (let i = 1; i <= 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      forecast.push({
        period: date.toLocaleDateString("default", {
          month: "short",
          day: "numeric",
        }),
        predicted: Math.round(avgDaily),
        confidence: 85 - i * 0.5, // Confidence decreases over time
        baseline: Math.round(avgDaily),
      });
    }

    return forecast;
  } catch (error) {
    console.error("Failed to get production forecast:", error);
    return [];
  }
}

// Get monthly revenue forecast
export async function getRevenueForecast(): Promise<ForcastData[]> {
  try {
    const trend = await getRevenueTrend();

    // Calculate average daily revenue from last 7 days
    const last7Days = trend.slice(-7);
    const avgDaily =
      last7Days.reduce((sum, d) => sum + d.value, 0) / last7Days.length;

    // Generate forecast for remaining days of month
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - today.getDate();

    const forecast: ForcastData[] = [];
    for (let i = 1; i <= daysRemaining; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      forecast.push({
        period: date.toLocaleDateString("default", {
          month: "short",
          day: "numeric",
        }),
        predicted: Math.round(avgDaily),
        confidence: 80,
        baseline: Math.round(avgDaily),
      });
    }

    return forecast;
  } catch (error) {
    console.error("Failed to get revenue forecast:", error);
    return [];
  }
}

// Track progress towards goals
export async function getGoalTrackers(): Promise<GoalTracker[]> {
  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get actual values
    const metrics = await queryPostgres<{
      orders: number;
      production: number;
      revenue: number;
    }>(
      STORE,
      `SELECT
        COUNT(DISTINCT o.id)::integer as orders,
        COALESCE(SUM(pwe.total_pairs), 0)::integer as production,
        COALESCE(SUM(CAST(SUBSTRING(o.total FROM '[0-9]+') AS INTEGER)), 0)::integer as revenue
      FROM production_work_entries pwe
      RIGHT OUTER JOIN orders o ON true
      WHERE pwe.work_date >= $1 AND pwe.work_date <= $2
      AND o.created_at >= $1 AND o.created_at <= $2
      AND o.status IN ('Closed', 'Contacted')`,
      [monthStart.toISOString().split("T")[0], monthEnd.toISOString().split("T")[0]]
    );

    const m = metrics[0] || { orders: 0, production: 0, revenue: 0 };

    const goals: GoalTracker[] = [
      {
        id: "orders",
        name: "Monthly Orders Target",
        target: 150,
        achieved: m.orders,
        progress: (m.orders / 150) * 100,
        status: m.orders >= 150 ? "ahead" : m.orders >= 100 ? "on_track" : "behind",
        deadline: monthEnd.toISOString().split("T")[0],
      },
      {
        id: "production",
        name: "Monthly Production",
        target: 5000,
        achieved: m.production,
        progress: (m.production / 5000) * 100,
        status:
          m.production >= 5000 ? "ahead" : m.production >= 3500 ? "on_track" : "behind",
        deadline: monthEnd.toISOString().split("T")[0],
      },
      {
        id: "revenue",
        name: "Monthly Revenue",
        target: 1000000,
        achieved: m.revenue,
        progress: (m.revenue / 1000000) * 100,
        status: m.revenue >= 1000000 ? "ahead" : m.revenue >= 700000 ? "on_track" : "behind",
        deadline: monthEnd.toISOString().split("T")[0],
      },
    ];

    return goals;
  } catch (error) {
    console.error("Failed to get goal trackers:", error);
    return [];
  }
}

// Get worker performance metrics for bonuses
export async function getWorkerPerformanceMetrics(): Promise<WorkerPerformanceMetric[]> {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);

    const workers = await queryPostgres<{
      worker_id: string;
      worker_name: string;
      pairs_count: number;
      earnings: number;
      quality_rate: number;
      attendance_rate: number;
    }>(
      STORE,
      `SELECT
        pwe.employee_id as worker_id,
        pwe.employee_name_snapshot as worker_name,
        SUM(pwe.total_pairs)::integer as pairs_count,
        SUM(pwe.earned_wage)::numeric as earnings,
        (100 - AVG(CASE WHEN pwe.rejected_pairs > 0 THEN (pwe.rejected_pairs::float / pwe.total_pairs::float) * 100 ELSE 0 END))::numeric as quality_rate,
        (COUNT(DISTINCT ha.id)::float / COUNT(DISTINCT d)::float * 100)::numeric as attendance_rate
      FROM production_work_entries pwe
      LEFT JOIN hr_attendance ha ON ha.employee_id = pwe.employee_id
        AND ha.status IN ('Present', 'Half Day')
        AND ha.work_date >= $1
      LEFT JOIN LATERAL (
        SELECT DISTINCT work_date::date as d
        FROM hr_attendance
        WHERE employee_id = pwe.employee_id
        AND work_date >= $1
      ) dates ON true
      WHERE pwe.work_date >= $1
      GROUP BY pwe.employee_id, pwe.employee_name_snapshot
      ORDER BY earnings DESC`,
      [monthStart.toISOString().split("T")[0]]
    );

    return workers.map((w) => {
      const qualityRate = Number(w.quality_rate) || 0;
      const attendanceRate = Number(w.attendance_rate) || 0;

      // Bonus calculation: 5% if quality > 95% AND attendance > 90%
      const bonusEligible = qualityRate > 95 && attendanceRate > 90;
      const bonusAmount = bonusEligible ? Math.round(Number(w.earnings) * 0.05) : 0;

      return {
        workerId: w.worker_id,
        workerName: w.worker_name,
        pairsThisMonth: w.pairs_count,
        earningsThisMonth: Math.round(Number(w.earnings)),
        qualityRate: Math.round(qualityRate * 100) / 100,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        bonusEligible,
        bonusAmount,
      };
    });
  } catch (error) {
    console.error("Failed to get worker performance metrics:", error);
    return [];
  }
}

// Get inventory trend (stock level changes)
export async function getInventoryTrend(): Promise<TrendDataPoint[]> {
  try {
    const results = await queryPostgres<{
      date: string;
      total_stock: number;
    }>(
      STORE,
      `WITH RECURSIVE date_range AS (
        SELECT CURRENT_DATE - INTERVAL '30 days' as date
        UNION ALL
        SELECT date + INTERVAL '1 day' FROM date_range
        WHERE date < CURRENT_DATE
      )
      SELECT
        date_range.date,
        COALESCE(SUM(fs.stock_pairs), 0)::integer as total_stock
      FROM date_range
      LEFT JOIN finished_stock fs ON true
      GROUP BY date_range.date
      ORDER BY date_range.date`,
      []
    );

    return results.map((r) => ({
      date: r.date,
      label: new Date(r.date).toLocaleDateString("default", {
        month: "short",
        day: "numeric",
      }),
      value: r.total_stock,
    }));
  } catch (error) {
    console.error("Failed to get inventory trend:", error);
    return [];
  }
}

// Get customer analytics (order frequency, average value)
export async function getCustomerAnalytics(): Promise<{
  totalCustomers: number;
  returningCustomers: number;
  avgOrderValue: number;
  repeatOrderRate: number;
}> {
  try {
    const results = await queryPostgres<{
      total_customers: number;
      returning_customers: number;
      avg_order_value: number;
      repeat_order_rate: number;
    }>(
      STORE,
      `SELECT
        COUNT(DISTINCT phone)::integer as total_customers,
        COUNT(DISTINCT CASE WHEN customer_count > 1 THEN phone END)::integer as returning_customers,
        ROUND(AVG(CAST(SUBSTRING(total FROM '[0-9]+') AS INTEGER)))::integer as avg_order_value,
        ROUND(COUNT(CASE WHEN customer_count > 1 THEN 1 END)::float / COUNT(DISTINCT phone)::float * 100)::integer as repeat_order_rate
      FROM (
        SELECT phone, total, COUNT(*) OVER (PARTITION BY phone) as customer_count
        FROM orders
      ) subq`,
      []
    );

    const r = results[0] || {
      total_customers: 0,
      returning_customers: 0,
      avg_order_value: 0,
      repeat_order_rate: 0,
    };

    return {
      totalCustomers: r.total_customers,
      returningCustomers: r.returning_customers,
      avgOrderValue: r.avg_order_value,
      repeatOrderRate: r.repeat_order_rate,
    };
  } catch (error) {
    console.error("Failed to get customer analytics:", error);
    return {
      totalCustomers: 0,
      returningCustomers: 0,
      avgOrderValue: 0,
      repeatOrderRate: 0,
    };
  }
}
