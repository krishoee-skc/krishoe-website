"use client";

import { useEffect, useState } from "react";

interface SMSRecord {
  id: string;
  phone_number: string;
  message_text: string;
  message_type: string;
  event_type: string;
  status: string;
  order_id?: string;
  worker_id?: string;
  created_at: string;
}

interface SMSStats {
  total_sent: number;
  total_failed: number;
  success_rate: number;
  by_type: Array<{ type: string; count: number }>;
  by_event: Array<{ event: string; count: number }>;
}

export default function SMSManagementPanel() {
  const [messages, setMessages] = useState<SMSRecord[]>([]);
  const [stats, setStats] = useState<SMSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "customer" | "worker" | "admin">(
    "all"
  );
  const [selectedMessage, setSelectedMessage] = useState<SMSRecord | null>(null);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [messagesRes, statsRes] = await Promise.all([
        fetch(
          `/api/admin/sms-logs?limit=100${
            filter !== "all" ? `&type=${filter}` : ""
          }`
        ),
        fetch("/api/admin/sms-logs?stats=true&days=7"),
      ]);

      if (messagesRes.ok) {
        const data = await messagesRes.json();
        setMessages(data.messages || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to load SMS data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "customer":
        return "👥";
      case "worker":
        return "👤";
      case "admin":
        return "🚨";
      default:
        return "📱";
    }
  };

  const getEventEmoji = (event: string) => {
    const emojis: Record<string, string> = {
      order_confirmed: "✅",
      payment_link_sent: "💳",
      shipped: "📦",
      out_for_delivery: "🚚",
      delivered: "✔️",
      payment_ready: "💰",
      payment_confirmed: "✅",
      admin_alert: "⚠️",
    };
    return emojis[event] || "📨";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("default", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading && !messages.length) {
    return (
      <div className="p-6 text-center text-gray-500">Loading SMS data...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">📱 SMS Management</h1>
        <p className="text-gray-600">
          Manage and monitor all SMS notifications sent to customers and workers
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">Total Sent</div>
            <div className="text-2xl font-bold text-blue-900">
              {stats.total_sent}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">Success Rate</div>
            <div className="text-2xl font-bold text-green-900">
              {stats.success_rate}%
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-600 font-medium">Failed</div>
            <div className="text-2xl font-bold text-red-900">
              {stats.total_failed}
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-purple-600 font-medium">Period</div>
            <div className="text-sm font-bold text-purple-900">Last 7 days</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(["all", "customer", "worker", "admin"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              filter === type
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Messages List */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No SMS messages found
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => setSelectedMessage(msg)}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span>{getTypeIcon(msg.message_type)}</span>
                    <span>{getEventEmoji(msg.event_type)}</span>
                    <span className="font-semibold text-gray-900">
                      {msg.phone_number}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                        msg.status
                      )}`}
                    >
                      {msg.status}
                    </span>
                  </div>

                  <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded mb-2">
                    {msg.message_text.substring(0, 150)}
                    {msg.message_text.length > 150 ? "..." : ""}
                  </div>

                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>📍 {msg.event_type}</span>
                    {msg.order_id && <span>📦 Order: {msg.order_id}</span>}
                    {msg.worker_id && <span>👤 Worker: {msg.worker_id}</span>}
                    <span>{formatDate(msg.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  📱 SMS Details
                </h2>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      To Number
                    </label>
                    <div className="text-lg font-mono text-gray-900">
                      {selectedMessage.phone_number}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Status
                    </label>
                    <div
                      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                        selectedMessage.status
                      )}`}
                    >
                      {selectedMessage.status}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Type
                    </label>
                    <div className="text-gray-900">
                      {selectedMessage.message_type}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Event
                    </label>
                    <div className="text-gray-900">
                      {selectedMessage.event_type}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Message ID
                    </label>
                    <div className="text-xs font-mono text-gray-600 break-all">
                      {selectedMessage.id}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Sent At
                    </label>
                    <div className="text-gray-900">
                      {formatDate(selectedMessage.created_at)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Message
                  </label>
                  <div className="bg-gray-50 p-4 rounded-lg text-gray-900 whitespace-pre-wrap">
                    {selectedMessage.message_text}
                  </div>
                </div>

                {selectedMessage.order_id && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Associated Order
                    </label>
                    <div className="text-gray-900">
                      {selectedMessage.order_id}
                    </div>
                  </div>
                )}

                {selectedMessage.worker_id && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Associated Worker
                    </label>
                    <div className="text-gray-900">
                      {selectedMessage.worker_id}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
