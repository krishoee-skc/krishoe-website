"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatAdminDate } from "@/lib/format-date";

interface AdminAlert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  icon: string;
  data?: Record<string, unknown>;
  read: boolean;
  read_at?: string;
  action_url?: string;
  action_label?: string;
  created_at: string;
}

interface AlertStats {
  unread_count: number;
  total_today: number;
  by_type: Array<{ type: string; count: number }>;
  by_severity: Array<{ severity: string; count: number }>;
}

export default function AdminAlertCenter() {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | string>("unread");
  const [selectedAlert, setSelectedAlert] = useState<AdminAlert | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/admin/alerts?limit=100";

      if (filter === "unread") {
        url += "&action=unread";
      } else if (filter !== "all") {
        url += `&type=${filter}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error("Failed to load alerts:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/alerts?action=stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadAlerts();
      void loadStats();
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadAlerts, loadStats]);

  const handleMarkAsRead = async (alertId: string) => {
    try {
      await fetch("/api/admin/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", alertId }),
      });
      loadAlerts();
      loadStats();
    } catch (error) {
      console.error("Failed to mark alert as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch("/api/admin/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      loadAlerts();
      loadStats();
    } catch (error) {
      console.error("Failed to mark all alerts as read:", error);
    }
  };

  const handleDelete = async (alertId: string) => {
    try {
      await fetch("/api/admin/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", alertId }),
      });
      loadAlerts();
      loadStats();
    } catch (error) {
      console.error("Failed to delete alert:", error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 border-red-300 text-red-900";
      case "high":
        return "bg-orange-100 border-orange-300 text-orange-900";
      case "medium":
        return "bg-yellow-100 border-yellow-300 text-yellow-900";
      case "low":
        return "bg-blue-100 border-blue-300 text-blue-900";
      default:
        return "bg-gray-100 border-gray-300 text-gray-900";
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500 text-white",
      high: "bg-orange-500 text-white",
      medium: "bg-yellow-500 text-white",
      low: "bg-blue-500 text-white",
    };
    return colors[severity] || "bg-gray-500 text-white";
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatAdminDate(date);
  };

  const filterOptions = [
    { key: "unread", label: "🔴 Unread" },
    { key: "all", label: "📋 All Alerts" },
    { key: "manual_payment", label: "💳 Manual Payment" },
    { key: "low_stock", label: "📦 Low Stock" },
    { key: "quality_issue", label: "⚠️ Quality Issues" },
    { key: "attendance_alert", label: "📅 Attendance" },
    { key: "payroll_ready", label: "💰 Payroll" },
    { key: "system_alert", label: "🔔 System" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              🔔 Alert Center
            </h1>
            <p className="text-gray-600">
              Manage and monitor all system alerts and notifications
            </p>
          </div>
          {stats && stats.unread_count > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-600 font-medium">🔴 Unread</div>
            <div className="text-3xl font-bold text-red-900">
              {stats.unread_count}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">📊 Today</div>
            <div className="text-3xl font-bold text-blue-900">
              {stats.total_today}
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-purple-600 font-medium">🎯 Critical</div>
            <div className="text-3xl font-bold text-purple-900">
              {stats.by_severity.find((s) => s.severity === "critical")?.count || 0}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">✅ Resolved</div>
            <div className="text-3xl font-bold text-green-900">
              {stats.by_type.find((t) => t.type === "system_alert")?.count || 0}
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="overflow-x-auto border-b border-gray-200">
        <div className="flex gap-1">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => setFilter(option.key)}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                filter === option.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-8 text-gray-500">
            Loading alerts...
          </div>
        )}

        {!loading && alerts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">✨</div>
            No alerts found
          </div>
        )}

        {!loading &&
          alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => setSelectedAlert(alert)}
              className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                alert.read
                  ? "bg-gray-50 border-gray-200"
                  : getSeverityColor(alert.severity)
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{alert.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {alert.title}
                      </h3>
                      <p className="text-sm text-gray-700 mt-1">
                        {alert.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 flex-wrap">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium text-white ${getSeverityBadge(
                        alert.severity
                      )}`}
                    >
                      {alert.severity.toUpperCase()}
                    </span>
                    {!alert.read && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-red-500 text-white">
                        UNREAD
                      </span>
                    )}
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-500 text-white">
                      {formatTime(alert.created_at)}
                    </span>
                  </div>

                  {alert.action_url && (
                    <Link
                      href={alert.action_url}
                      className="inline-block mt-3 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      {alert.action_label || "View"}
                    </Link>
                  )}
                </div>

                <div className="flex gap-2">
                  {!alert.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(alert.id);
                      }}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(alert.id);
                    }}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedAlert.icon} {selectedAlert.title}
                </h2>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Message
                  </label>
                  <div className="text-gray-900 mt-1">
                    {selectedAlert.message}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Type
                    </label>
                    <div className="text-gray-900">
                      {selectedAlert.type.replace(/_/g, " ")}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Severity
                    </label>
                    <div>
                      <span
                        className={`px-3 py-1 rounded text-sm font-medium text-white ${getSeverityBadge(
                          selectedAlert.severity
                        )}`}
                      >
                        {selectedAlert.severity.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Status
                    </label>
                    <div className="text-gray-900">
                      {selectedAlert.read ? "Read" : "Unread"}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Created
                    </label>
                    <div className="text-gray-900">
                      {formatAdminDate(selectedAlert.created_at, { time: true })}
                    </div>
                  </div>
                </div>

                {Object.keys(selectedAlert.data || {}).length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Details
                    </label>
                    <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto mt-1">
                      {JSON.stringify(selectedAlert.data, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedAlert.action_url && (
                  <Link
                    href={selectedAlert.action_url}
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {selectedAlert.action_label || "Take Action"}
                  </Link>
                )}

                <div className="flex gap-2 pt-4">
                  {!selectedAlert.read && (
                    <button
                      onClick={() => {
                        handleMarkAsRead(selectedAlert.id);
                        setSelectedAlert(null);
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Mark as Read
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleDelete(selectedAlert.id);
                      setSelectedAlert(null);
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
