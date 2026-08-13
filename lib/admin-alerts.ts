import { queryPostgres } from "@/lib/postgres/client";

const STORE = "krishoe";

export type AlertType =
  | "manual_payment"
  | "low_stock"
  | "quality_issue"
  | "attendance_alert"
  | "payroll_ready"
  | "system_alert";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface AdminAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  icon: string;
  data: Record<string, unknown>;
  read: boolean;
  read_at?: string;
  action_url?: string;
  action_label?: string;
  created_at: string;
  expires_at?: string;
}

export interface AlertRecord {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  icon: string;
  data: unknown;
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  action_label?: string;
  created_at: string;
  expires_at?: string;
}

// Create new alert
export async function createAlert(alert: Omit<AdminAlert, "id" | "created_at">) {
  try {
    const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await queryPostgres(
      STORE,
      `INSERT INTO admin_alerts
       (id, alert_type, severity, title, message, icon, data, is_read, action_url, action_label, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        id,
        alert.type,
        alert.severity,
        alert.title,
        alert.message,
        alert.icon,
        JSON.stringify(alert.data || {}),
        alert.read || false,
        alert.action_url || null,
        alert.action_label || null,
        alert.expires_at || null,
      ]
    );

    return id;
  } catch (error) {
    console.error("Failed to create alert:", error);
    throw error;
  }
}

// Get all unread alerts
export async function getUnreadAlerts(): Promise<AdminAlert[]> {
  try {
    const alerts = await queryPostgres<AlertRecord>(
      STORE,
      `SELECT * FROM admin_alerts
       WHERE is_read = false
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 50`,
      []
    );

    return alerts.map(formatAlert);
  } catch (error) {
    console.error("Failed to fetch unread alerts:", error);
    return [];
  }
}

// Get alert count
export async function getUnreadAlertCount(): Promise<number> {
  try {
    const result = await queryPostgres<{ count: number }>(
      STORE,
      `SELECT COUNT(*) as count FROM admin_alerts
       WHERE is_read = false
       AND (expires_at IS NULL OR expires_at > NOW())`,
      []
    );

    return Number(result[0]?.count) || 0;
  } catch (error) {
    console.error("Failed to get alert count:", error);
    return 0;
  }
}

// Get all alerts (with pagination)
export async function getAllAlerts(
  limit: number = 100,
  offset: number = 0
): Promise<AdminAlert[]> {
  try {
    const alerts = await queryPostgres<AlertRecord>(
      STORE,
      `SELECT * FROM admin_alerts
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return alerts.map(formatAlert);
  } catch (error) {
    console.error("Failed to fetch alerts:", error);
    return [];
  }
}

// Get alerts by type
export async function getAlertsByType(
  type: AlertType,
  limit: number = 50
): Promise<AdminAlert[]> {
  try {
    const alerts = await queryPostgres<AlertRecord>(
      STORE,
      `SELECT * FROM admin_alerts
       WHERE alert_type = $1
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT $2`,
      [type, limit]
    );

    return alerts.map(formatAlert);
  } catch (error) {
    console.error("Failed to fetch alerts by type:", error);
    return [];
  }
}

// Mark alert as read
export async function markAlertAsRead(alertId: string): Promise<void> {
  try {
    await queryPostgres(
      STORE,
      `UPDATE admin_alerts
       SET is_read = true, read_at = NOW()
       WHERE id = $1`,
      [alertId]
    );
  } catch (error) {
    console.error("Failed to mark alert as read:", error);
  }
}

// Mark all alerts as read
export async function markAllAlertsAsRead(): Promise<void> {
  try {
    await queryPostgres(
      STORE,
      `UPDATE admin_alerts
       SET is_read = true, read_at = NOW()
       WHERE is_read = false`,
      []
    );
  } catch (error) {
    console.error("Failed to mark all alerts as read:", error);
  }
}

// Delete alert
export async function deleteAlert(alertId: string): Promise<void> {
  try {
    await queryPostgres(
      STORE,
      `DELETE FROM admin_alerts WHERE id = $1`,
      [alertId]
    );
  } catch (error) {
    console.error("Failed to delete alert:", error);
  }
}

// Get alert statistics
export async function getAlertStats(): Promise<{
  unread_count: number;
  total_today: number;
  by_type: Array<{ type: string; count: number }>;
  by_severity: Array<{ severity: string; count: number }>;
}> {
  try {
    const [summary, typeStats, severityStats] = await Promise.all([
      queryPostgres<{ unread_count: number | string; total_today: number | string }>(
        STORE,
        `SELECT
          COUNT(*) FILTER (WHERE is_read = false) AS unread_count,
          COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) AS total_today
         FROM admin_alerts
         WHERE expires_at IS NULL OR expires_at > NOW()`,
      ),
      queryPostgres<{ type: string; count: number | string }>(
        STORE,
        `SELECT alert_type AS type, COUNT(*) AS count
         FROM admin_alerts
         WHERE (expires_at IS NULL OR expires_at > NOW()) AND alert_type IS NOT NULL
         GROUP BY alert_type
         ORDER BY count DESC`,
      ),
      queryPostgres<{ severity: string; count: number | string }>(
        STORE,
        `SELECT severity, COUNT(*) AS count
         FROM admin_alerts
         WHERE (expires_at IS NULL OR expires_at > NOW()) AND severity IS NOT NULL
         GROUP BY severity
         ORDER BY count DESC`,
      ),
    ]);

    return {
      unread_count: Number(summary[0]?.unread_count) || 0,
      total_today: Number(summary[0]?.total_today) || 0,
      by_type: typeStats.map((item) => ({ type: item.type, count: Number(item.count) || 0 })),
      by_severity: severityStats.map((item) => ({
        severity: item.severity,
        count: Number(item.count) || 0,
      })),
    };
  } catch (error) {
    console.error("Failed to get alert stats:", error);
    return {
      unread_count: 0,
      total_today: 0,
      by_type: [],
      by_severity: [],
    };
  }
}

// Format alert record
function formatAlert(record: AlertRecord): AdminAlert {
  let data: Record<string, unknown> = {};
  try {
    const parsed = typeof record.data === "string" ? JSON.parse(record.data) : record.data;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    data = {};
  }

  return {
    id: record.id,
    type: record.alert_type as AlertType,
    severity: record.severity as AlertSeverity,
    title: record.title,
    message: record.message,
    icon: record.icon,
    data,
    read: record.is_read,
    read_at: record.read_at,
    action_url: record.action_url,
    action_label: record.action_label,
    created_at: record.created_at,
    expires_at: record.expires_at,
  };
}

// ========== ALERT FACTORY FUNCTIONS ==========

export async function createManualPaymentAlert(data: {
  orderId: string;
  customerName: string;
  amount: number;
  method: "cod" | "bank";
}): Promise<string> {
  return createAlert({
    type: "manual_payment",
    severity: "high",
    title: "Manual Payment Needed",
    message: `Order #${data.orderId} - ${data.customerName} needs manual payment confirmation`,
    icon: "💳",
    data,
    read: false,
    action_url: `/admin/orders/${data.orderId}`,
    action_label: "View Order",
  });
}

export async function createLowStockAlert(data: {
  productId: string;
  productName: string;
  currentStock: number;
  threshold: number;
  channel: string;
}): Promise<string> {
  return createAlert({
    type: "low_stock",
    severity: "medium",
    title: "Low Stock Alert",
    message: `${data.productName} (${data.channel}): ${data.currentStock} units remaining`,
    icon: "📦",
    data,
    read: false,
    action_url: `/admin/inventory/${data.productId}`,
    action_label: "Check Inventory",
  });
}

export async function createQualityIssueAlert(data: {
  workerId: string;
  workerName: string;
  defectRate: number;
  pairs: number;
  date: string;
}): Promise<string> {
  return createAlert({
    type: "quality_issue",
    severity: "high",
    title: "Quality Issue Detected",
    message: `${data.workerName}: ${data.defectRate}% defect rate on ${data.pairs} pairs`,
    icon: "⚠️",
    data,
    read: false,
    action_url: `/admin/workers/analytics`,
    action_label: "View Worker",
  });
}

export async function createAttendanceAlert(data: {
  workerId: string;
  workerName: string;
  absentDays: number;
  totalDays: number;
  attendanceRate: number;
}): Promise<string> {
  return createAlert({
    type: "attendance_alert",
    severity: "medium",
    title: "Low Attendance Alert",
    message: `${data.workerName}: ${data.attendanceRate}% attendance (${data.absentDays} absent)`,
    icon: "📅",
    data,
    read: false,
    action_url: `/admin/workers/analytics`,
    action_label: "View Details",
  });
}

export async function createPayrollReadyAlert(data: {
  month: string;
  workerCount: number;
  totalAmount: number;
}): Promise<string> {
  return createAlert({
    type: "payroll_ready",
    severity: "medium",
    title: "Payroll Ready for Processing",
    message: `${data.workerCount} workers, Rs. ${data.totalAmount.toLocaleString()} for ${data.month}`,
    icon: "💰",
    data,
    read: false,
    action_url: `/admin/payroll`,
    action_label: "View Payroll",
  });
}

export async function createSystemAlert(data: {
  title: string;
  message: string;
  severity?: AlertSeverity;
}): Promise<string> {
  return createAlert({
    type: "system_alert",
    severity: data.severity || "medium",
    title: data.title,
    message: data.message,
    icon: "🔔",
    data,
    read: false,
  });
}
