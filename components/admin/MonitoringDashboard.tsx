"use client";

import { useEffect, useState } from "react";

interface MonitoringData {
  errors: {
    totalErrors: number;
    errorsByLevel: Record<string, number>;
    topErrors: Array<{ message: string; count: number }>;
    recentErrors: any[];
  };
  performance: {
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
  };
  uptime: number;
  health: {
    database: boolean;
    cache: boolean;
    api: boolean;
    email: boolean;
    sms: boolean;
    storage: boolean;
  };
}

export default function MonitoringDashboard() {
  const [monitoring, setMonitoring] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadMonitoring();
    if (autoRefresh) {
      const interval = setInterval(loadMonitoring, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadMonitoring = async () => {
    try {
      const res = await fetch("/api/admin/monitoring");
      if (res.ok) {
        const data = await res.json();
        setMonitoring(data.monitoring);
      }
    } catch (error) {
      console.error("Failed to load monitoring:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading monitoring data...
      </div>
    );
  }

  if (!monitoring) {
    return (
      <div className="p-6 text-center text-red-500">
        Failed to load monitoring data
      </div>
    );
  }

  const getHealthColor = (healthy: boolean) =>
    healthy ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              🔍 Production Monitoring
            </h1>
            <p className="text-gray-600">
              Real-time system health, performance, and error tracking
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadMonitoring}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              🔄 Refresh Now
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                autoRefresh
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-900"
              }`}
            >
              {autoRefresh ? "✓ Auto-Refresh" : "○ Manual"}
            </button>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          💚 System Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: "Database", status: monitoring.health.database, icon: "🗄️" },
            { name: "API", status: monitoring.health.api, icon: "🔌" },
            { name: "Email", status: monitoring.health.email, icon: "📧" },
            { name: "SMS", status: monitoring.health.sms, icon: "📱" },
            { name: "Storage", status: monitoring.health.storage, icon: "💾" },
            { name: "Cache", status: monitoring.health.cache, icon: "⚡" },
          ].map((service) => (
            <div
              key={service.name}
              className={`p-4 rounded-lg ${getHealthColor(service.status)}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{service.icon}</span>
                <span className="font-semibold">{service.name}</span>
              </div>
              <span className="text-sm">
                {service.status ? "🟢 Healthy" : "🔴 Down"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Uptime (30 days)</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {monitoring.uptime.toFixed(2)}%
          </div>
          <div
            className={`mt-2 text-xs font-medium px-2 py-1 rounded ${
              monitoring.uptime >= 99.9
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {monitoring.uptime >= 99.9 ? "Excellent" : "Good"}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Avg Response Time</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {monitoring.performance.avgResponseTime}ms
          </div>
          <div className="text-xs text-gray-500 mt-2">
            P95: {monitoring.performance.p95ResponseTime}ms
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Error Rate</div>
          <div
            className={`text-3xl font-bold mt-2 ${
              monitoring.performance.errorRate > 1
                ? "text-red-600"
                : "text-green-600"
            }`}
          >
            {monitoring.performance.errorRate.toFixed(2)}%
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Total Errors</div>
          <div
            className={`text-3xl font-bold mt-2 ${
              monitoring.errors.totalErrors > 10 ? "text-red-600" : "text-blue-600"
            }`}
          >
            {monitoring.errors.totalErrors}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Last 24 hours
          </div>
        </div>
      </div>

      {/* Top Errors */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          🚨 Top Errors
        </h2>
        {monitoring.errors.topErrors.length === 0 ? (
          <div className="text-center py-8 text-green-600">
            ✨ No errors detected! System is healthy.
          </div>
        ) : (
          <div className="space-y-3">
            {monitoring.errors.topErrors.map((error, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">
                    {error.message}
                  </p>
                </div>
                <span className="px-3 py-1 bg-red-200 text-red-700 rounded-full text-sm font-medium">
                  {error.count}x
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slowest Endpoints */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          🐢 Slowest Endpoints
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-900">
                  Endpoint
                </th>
                <th className="px-4 py-2 text-left font-semibold text-gray-900">
                  Avg Time
                </th>
                <th className="px-4 py-2 text-left font-semibold text-gray-900">
                  Calls
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {monitoring.performance.slowestEndpoints.map((endpoint, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                      {endpoint.method} {endpoint.path}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`font-medium ${
                        endpoint.avgTime > 1000
                          ? "text-red-600"
                          : "text-yellow-600"
                      }`}
                    >
                      {endpoint.avgTime}ms
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{endpoint.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Recommendations</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          {monitoring.performance.errorRate > 1 && (
            <li>✓ Error rate is high - check recent deployments</li>
          )}
          {monitoring.performance.avgResponseTime > 1000 && (
            <li>✓ Average response time is slow - optimize slow endpoints</li>
          )}
          {monitoring.errors.totalErrors > 50 && (
            <li>✓ Many errors in last 24h - urgent investigation needed</li>
          )}
          {monitoring.uptime < 99.9 && (
            <li>✓ Uptime below 99.9% - review system stability</li>
          )}
          {Object.values(monitoring.health).some((v) => !v) && (
            <li>✓ Some services unhealthy - check system status</li>
          )}
        </ul>
      </div>
    </div>
  );
}
