"use client";

import { useCallback, useEffect, useState } from "react";
import { formatAdminDate } from "@/lib/format-date";
import { useLanguage } from "@/components/LanguageProvider";

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

// The log's own words, said in both languages (owner's sample 7घ,
// 2026-10-14): this screen was English throughout.
const STATUS_WORDS: Record<string, { en: string; ne: string }> = {
  sent: { en: "sent", ne: "पुग्यो" },
  failed: { en: "failed", ne: "पुगेन" },
  pending: { en: "waiting", ne: "पठाउँदै" },
};
const TYPE_WORDS: Record<"all" | "customer" | "worker" | "admin", { en: string; ne: string }> = {
  all: { en: "All", ne: "सबै" },
  customer: { en: "👥 Customers", ne: "👥 ग्राहक" },
  worker: { en: "👤 Workers", ne: "👤 कामदार" },
  admin: { en: "🚨 Owner", ne: "🚨 मालिक" },
};
const EVENT_WORDS: Record<string, { en: string; ne: string }> = {
  order_confirmed: { en: "Order confirmed", ne: "अर्डर पक्का" },
  payment_link_sent: { en: "Payment link", ne: "भुक्तानीको link" },
  shipped: { en: "Shipped", ne: "पठाइयो" },
  out_for_delivery: { en: "Out for delivery", ne: "बाटोमा" },
  delivered: { en: "Delivered", ne: "पुग्यो" },
  payment_ready: { en: "Payment ready", ne: "भुक्तानी तयार" },
  payment_confirmed: { en: "Payment confirmed", ne: "भुक्तानी पक्का" },
  admin_alert: { en: "Alert", ne: "चेतावनी" },
};

export default function SMSManagementPanel() {
  const { text } = useLanguage();
  const [messages, setMessages] = useState<SMSRecord[]>([]);
  const [stats, setStats] = useState<SMSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "customer" | "worker" | "admin">(
    "all"
  );
  // The period the three figures cover (owner's sample 7घ).
  const [days, setDays] = useState<7 | 30>(7);
  const [selectedMessage, setSelectedMessage] = useState<SMSRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [messagesRes, statsRes] = await Promise.all([
        fetch(
          `/api/admin/sms-logs?limit=100${
            filter !== "all" ? `&type=${filter}` : ""
          }`
        ),
        fetch(`/api/admin/sms-logs?stats=true&days=${days}`),
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
  }, [filter, days]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-brand-mist text-brand-green-ink";
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

  const say = (words: { en: string; ne: string } | undefined, fallback: string) =>
    words ? text(words.en, words.ne) : fallback;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return formatAdminDate(date, { time: true });
  };

  if (loading && !messages.length) {
    return (
      <div className="p-6 text-center text-brand-muted">{text("Loading SMS data…", "SMS खुल्दैछ…")}</div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-lg border border-brand-green-line bg-brand-paper p-4 sm:p-6">
        <h1 className="font-display text-2xl font-black text-brand-green-ink sm:text-3xl">SMS</h1>
        <p className="mt-1 text-sm text-brand-muted">
          {text(
            "Every SMS sent to customers, workers and you, and whether it arrived.",
            "ग्राहक, कामदार र तपाईंलाई पठाएका सबै SMS, र पुग्यो कि पुगेन।",
          )}
        </p>
      </div>

      {/* Three figures and the period they cover */}
      {stats && (
        <div className="grid gap-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-brand-green-line bg-brand-paper px-3 py-2">
              <div className="font-display text-xl font-black tabular-nums text-brand-green-ink">{stats.total_sent}</div>
              <div className="text-xs font-bold text-brand-muted">{text("sent", "पठाएका")}</div>
            </div>
            <div className="rounded-2xl border border-transparent bg-brand-green-wash px-3 py-2">
              <div className="font-display text-xl font-black tabular-nums text-brand-green">{stats.success_rate}%</div>
              <div className="text-xs font-bold text-brand-green">{text("arrived", "पुगेका")}</div>
            </div>
            <div className={`rounded-2xl border px-3 py-2 ${stats.total_failed > 0 ? "border-transparent bg-brand-clay-tint text-brand-clay" : "border-brand-green-line bg-brand-paper text-brand-green-ink"}`}>
              <div className="font-display text-xl font-black tabular-nums">{stats.total_failed}</div>
              <div className="text-xs font-bold">{text("did not arrive", "नपुगेका")}</div>
            </div>
          </div>
          <div className="flex gap-1.5">
            {([7, 30] as const).map((period) => (
              <button
                key={period}
                type="button"
                aria-pressed={days === period}
                onClick={() => setDays(period)}
                className={`min-h-10 rounded-full border px-4 text-sm font-black ${days === period ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"}`}
              >
                {text(`${period} days`, `${period} दिन`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div role="tablist" aria-label={text("Whose messages", "कसका सन्देश")} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {(["all", "customer", "worker", "admin"] as const).map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={filter === type}
            onClick={() => setFilter(type)}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-black ${
              filter === type
                ? "border-brand-green bg-brand-green text-white"
                : "border-brand-green-line bg-brand-paper text-brand-green-ink"
            }`}
          >
            {say(TYPE_WORDS[type], type)}
          </button>
        ))}
      </div>

      {/* Messages List: two lines a message */}
      <div className="max-h-[37.5rem] space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-brand-muted">
            {text("No SMS messages found", "कुनै SMS भेटिएन")}
          </div>
        ) : (
          messages.map((msg) => (
            <button
              type="button"
              key={msg.id}
              onClick={() => setSelectedMessage(msg)}
              className="grid w-full gap-1 rounded-xl border border-brand-green-line bg-brand-paper p-3 text-left transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 break-words font-semibold text-brand-green-ink">
                  {getTypeIcon(msg.message_type)} {getEventEmoji(msg.event_type)} {msg.phone_number}
                </span>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${getStatusColor(msg.status)}`}>
                  {say(STATUS_WORDS[msg.status], msg.status)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 text-xs text-brand-muted">
                <span>{say(EVENT_WORDS[msg.event_type], msg.event_type)}</span>
                {msg.order_id && <span>📦 {text("Order", "अर्डर")} {msg.order_id}</span>}
                {msg.worker_id && <span>👤 {text("Worker", "कामदार")} {msg.worker_id}</span>}
                <span>{formatDate(msg.created_at)}</span>
              </div>
              <p className="line-clamp-2 text-sm text-brand-muted-deep">{msg.message_text}</p>
            </button>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-brand-paper">
            <div className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <h2 className="text-xl font-bold text-brand-green-ink">
                  📱 {text("SMS details", "SMS को विवरण")}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  aria-label={text("Close", "बन्द गर्ने")}
                  className="grid h-11 w-11 place-items-center text-2xl text-brand-muted hover:text-brand-muted-deep"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-brand-muted">{text("To number", "कुन नम्बरमा")}</p>
                    <div className="font-mono text-lg text-brand-green-ink">{selectedMessage.phone_number}</div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-brand-muted">{text("Status", "अवस्था")}</p>
                    <div className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(selectedMessage.status)}`}>
                      {say(STATUS_WORDS[selectedMessage.status], selectedMessage.status)}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-brand-muted">{text("To whom", "कसलाई")}</p>
                    <div className="text-brand-green-ink">
                      {say(TYPE_WORDS[selectedMessage.message_type as keyof typeof TYPE_WORDS], selectedMessage.message_type)}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-brand-muted">{text("What for", "के बारे")}</p>
                    <div className="text-brand-green-ink">{say(EVENT_WORDS[selectedMessage.event_type], selectedMessage.event_type)}</div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-brand-muted">{text("Message ID", "सन्देशको ID")}</p>
                    <div className="break-all font-mono text-xs text-brand-muted">{selectedMessage.id}</div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-brand-muted">{text("Sent at", "पठाएको")}</p>
                    <div className="text-brand-green-ink">{formatDate(selectedMessage.created_at)}</div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-brand-muted">{text("Message", "सन्देश")}</p>
                  <div className="whitespace-pre-wrap rounded-lg bg-brand-paper-deep p-4 text-brand-green-ink">
                    {selectedMessage.message_text}
                  </div>
                </div>

                {selectedMessage.order_id && (
                  <div>
                    <p className="text-sm font-medium text-brand-muted">{text("Order", "अर्डर")}</p>
                    <div className="text-brand-green-ink">{selectedMessage.order_id}</div>
                  </div>
                )}

                {selectedMessage.worker_id && (
                  <div>
                    <p className="text-sm font-medium text-brand-muted">{text("Worker", "कामदार")}</p>
                    <div className="text-brand-green-ink">{selectedMessage.worker_id}</div>
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
