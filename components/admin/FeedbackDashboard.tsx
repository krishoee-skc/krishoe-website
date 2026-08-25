"use client";

import { useCallback, useEffect, useState } from "react";
import { Feedback, FeedbackStatus } from "@/lib/feedback";
import { formatAdminDate } from "@/lib/format-date";

export default function FeedbackDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    byType: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    averageRating: 0,
    unresolved: 0,
  });
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [filter, setFilter] = useState<{ type?: string; status?: string }>({});
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback?action=stats");
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }, []);

  const loadFeedback = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.type) params.append("type", filter.type);
      if (filter.status) params.append("status", filter.status);

      const res = await fetch(`/api/feedback?${params.toString()}`);
      const data = await res.json();
      if (data.success) setFeedback(data.feedback);
    } catch (error) {
      console.error("Failed to load feedback:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadStats();
      void loadFeedback();
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadFeedback, loadStats]);

  async function updateStatus(id: string, status: FeedbackStatus) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        if (selectedFeedback) {
          setSelectedFeedback({ ...selectedFeedback, status });
        }
        loadFeedback();
        loadStats();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdating(false);
    }
  }

  const typeIcons: Record<string, string> = {
    bug: "🐛",
    feature: "✨",
    improvement: "💡",
    rating: "⭐",
  };

  const statusColors: Record<string, string> = {
    new: "bg-red-100 text-red-900",
    acknowledged: "bg-yellow-100 text-yellow-900",
    in_progress: "bg-brand-green-wash text-brand-green",
    resolved: "bg-green-100 text-green-900",
  };

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-brand-paper p-4 rounded-lg border">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-brand-muted text-sm">Total Feedback</div>
        </div>
        <div className="bg-brand-paper p-4 rounded-lg border">
          <div className="text-2xl font-bold text-red-600">
            {stats.byStatus["new"] || 0}
          </div>
          <div className="text-brand-muted text-sm">New</div>
        </div>
        <div className="bg-brand-paper p-4 rounded-lg border">
          <div className="text-2xl font-bold text-yellow-600">
            {stats.unresolved}
          </div>
          <div className="text-brand-muted text-sm">Unresolved</div>
        </div>
        <div className="bg-brand-paper p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">
            {stats.byStatus["resolved"] || 0}
          </div>
          <div className="text-brand-muted text-sm">Resolved</div>
        </div>
        <div className="bg-brand-paper p-4 rounded-lg border">
          <div className="text-2xl font-bold text-orange-600">
            ⭐ {stats.averageRating.toFixed(1)}
          </div>
          <div className="text-brand-muted text-sm">Avg Rating</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filter.type || ""}
          onChange={(e) => setFilter({ ...filter, type: e.target.value || undefined })}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">All Types</option>
          <option value="bug">🐛 Bug</option>
          <option value="feature">✨ Feature</option>
          <option value="improvement">💡 Improvement</option>
          <option value="rating">⭐ Rating</option>
        </select>

        <select
          value={filter.status || ""}
          onChange={(e) =>
            setFilter({ ...filter, status: e.target.value || undefined })
          }
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">All Status</option>
          <option value="new">🔴 New</option>
          <option value="acknowledged">🟡 Acknowledged</option>
          <option value="in_progress">🔵 In Progress</option>
          <option value="resolved">🟢 Resolved</option>
        </select>
      </div>

      {/* Feedback List & Detail */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {loading ? (
            <div className="text-brand-muted">Loading feedback...</div>
          ) : feedback.length === 0 ? (
            <div className="text-brand-muted">No feedback found</div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {feedback.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setSelectedFeedback(f)}
                  className={`p-4 border rounded-lg cursor-pointer transition ${
                    selectedFeedback?.id === f.id
                      ? "border-brand-green bg-brand-green-wash"
                      : "hover:border-brand-green bg-brand-paper"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{typeIcons[f.type]}</span>
                      <span className="font-semibold capitalize text-brand-green-ink">
                        {f.type}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${statusColors[f.status]}`}>
                      {f.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-brand-green-ink">
                    {f.title}
                  </div>
                  <div className="text-xs text-brand-muted mt-1">
                    From: {f.userName} ({f.userType})
                  </div>
                  <div className="text-xs text-brand-muted">
                    {formatAdminDate(f.createdAt)} -{" "}
                    {new Date(f.createdAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kathmandu" })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Pane */}
        <div className="bg-brand-paper border rounded-lg p-4 h-fit">
          {selectedFeedback ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-brand-muted uppercase tracking-wide">
                  ID
                </div>
                <div className="text-sm font-mono text-brand-green-ink">
                  {selectedFeedback.id}
                </div>
              </div>

              <div>
                <div className="text-xs text-brand-muted uppercase tracking-wide">
                  Title
                </div>
                <div className="text-sm font-semibold text-brand-green-ink">
                  {selectedFeedback.title}
                </div>
              </div>

              {selectedFeedback.rating && (
                <div>
                  <div className="text-xs text-brand-muted uppercase tracking-wide">
                    Rating
                  </div>
                  <div className="text-lg">
                    {"⭐".repeat(selectedFeedback.rating)}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-brand-muted uppercase tracking-wide">
                  From
                </div>
                <div className="text-sm text-brand-green-ink">
                  {selectedFeedback.userName}
                </div>
                <div className="text-xs text-brand-muted">
                  ({selectedFeedback.userType})
                </div>
                {selectedFeedback.userEmail && (
                  <div className="text-xs text-brand-muted">
                    {selectedFeedback.userEmail}
                  </div>
                )}
                {selectedFeedback.userPhone && (
                  <div className="text-xs text-brand-muted">
                    {selectedFeedback.userPhone}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs text-brand-muted uppercase tracking-wide">
                  Message
                </div>
                <div className="text-sm text-brand-muted-deep mt-1">
                  {selectedFeedback.message}
                </div>
              </div>

              <div>
                <div className="text-xs text-brand-muted uppercase tracking-wide mb-2">
                  Status
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(["new", "acknowledged", "in_progress", "resolved"] as FeedbackStatus[]).map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selectedFeedback.id, s)}
                        disabled={updating}
                        className={`text-xs px-2 py-1 rounded transition ${
                          selectedFeedback.status === s
                            ? `${statusColors[s]} font-semibold`
                            : "bg-brand-mist text-brand-muted-deep hover:bg-brand-green-line"
                        }`}
                      >
                        {s.replace("_", " ")}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="text-xs text-brand-muted">
                Created: {formatAdminDate(selectedFeedback.createdAt, { time: true })}
              </div>
            </div>
          ) : (
            <div className="text-brand-muted text-sm">
              Select feedback to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
