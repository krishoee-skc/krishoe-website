"use client";

import { useState } from "react";
import { FeedbackType } from "@/lib/feedback";
import { useLanguage } from "@/components/LanguageProvider";

export default function FeedbackForm() {
  const { text } = useLanguage();
  const [type, setType] = useState<FeedbackType>("improvement");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const typeOptions = [
    { value: "bug" as FeedbackType, label: "🐛 Bug Report", desc: "Report a problem or crash" },
    { value: "feature" as FeedbackType, label: "✨ Feature Request", desc: "Suggest a new feature" },
    { value: "improvement" as FeedbackType, label: "💡 Improvement", desc: "Suggest better UX/design" },
    { value: "rating" as FeedbackType, label: "⭐ Rating", desc: "Rate your experience" },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!userName.trim() || !title.trim() || !message.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    if (type === "rating" && rating === 0) {
      setError("Please select a rating");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          userName,
          userEmail: userEmail || undefined,
          userPhone: userPhone || undefined,
          title,
          message,
          rating: rating || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setType("improvement");
        setUserName("");
        setUserEmail("");
        setUserPhone("");
        setTitle("");
        setMessage("");
        setRating(0);
        setTimeout(() => setSuccess(false), 5000);
      } else {
        setError(data.error || "Failed to submit feedback");
      }
    } catch (err) {
      setError("Failed to submit feedback. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg border p-8">
      <h1 className="text-3xl font-bold mb-2">{text("Share Your Feedback", "तपाईंको सुझाव लेख्नुहोस्")}</h1>
      <p className="text-gray-600 mb-8">
        Help us improve! Your feedback helps us make better decisions.
      </p>

      {success && (
        <div className="bg-green-50 border border-green-300 text-green-900 px-4 py-3 rounded-lg mb-6">
          ✅ Thank you! Your feedback has been received.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-900 px-4 py-3 rounded-lg mb-6">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Feedback Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Feedback Type
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {typeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={`p-3 rounded-lg border-2 text-center transition ${
                  type === option.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="font-semibold text-gray-900">{option.label}</div>
                <div className="text-xs text-gray-500">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Name *
          </label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder={text("Your name", "तपाईंको नाम")}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Email & Phone */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Email
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Phone
            </label>
            <input
              type="tel"
              value={userPhone}
              onChange={(e) => setUserPhone(e.target.value)}
              placeholder="+977..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Rating (if rating type) */}
        {type === "rating" && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Rating *
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-4xl transition ${
                    star <= rating ? "text-yellow-400" : "text-gray-300"
                  }`}
                >
                  ⭐
                </button>
              ))}
            </div>
            <div className="text-sm text-gray-600 mt-2">
              {rating > 0 && `You rated: ${rating} star${rating !== 1 ? "s" : ""}`}
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={text("Brief summary of your feedback", "छोटकरीमा के भन्न खोज्नुभएको")}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Message *
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={text("Detailed explanation...", "विस्तारमा लेख्नुहोस्…")}
            rows={5}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            required
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition"
        >
          {loading ? "Submitting..." : "Submit Feedback"}
        </button>
      </form>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          <strong>💡 Tip:</strong> Be specific and constructive. Include steps to reproduce for bugs,
          and explain why a feature would be useful.
        </p>
      </div>
    </div>
  );
}
