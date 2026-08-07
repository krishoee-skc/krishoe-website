"use client";

import { useState } from "react";
import { StarIcon } from "@/components/Icons";

interface ReviewFormProps {
  productId: string;
  onSubmitSuccess?: () => void;
}

export default function ReviewForm({ productId, onSubmitSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validation
    if (!name.trim()) {
      setError("Name is required");
      setLoading(false);
      return;
    }

    if (comment.trim().length < 10) {
      setError("Review must be at least 10 characters");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          customer_name: name,
          customer_email: email || undefined,
          rating,
          title: title || undefined,
          comment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit review");
      }

      setSuccess(true);
      setName("");
      setEmail("");
      setTitle("");
      setComment("");
      setRating(5);

      setTimeout(() => {
        setSuccess(false);
        onSubmitSuccess?.();
      }, 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-black text-brand-green-ink">Share Your Review</h3>
      <p className="mt-1 text-sm text-gray-500">Help other customers make informed decisions</p>

      {success && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          ✅ Thank you! Your review has been submitted for moderation.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm font-semibold text-red-800">
          ❌ {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {/* Rating */}
        <div>
          <label className="text-sm font-black text-brand-green-ink">Rating</label>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition"
              >
                <StarIcon
                  className={`h-8 w-8 ${
                    star <= (hoveredRating || rating)
                      ? "fill-brand-gold text-brand-gold"
                      : "fill-gray-200 text-gray-200"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-black text-brand-green-ink">Your Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand-green"
            placeholder="John Doe"
            required
          />
        </div>

        {/* Email */}
        <div>
          <label className="text-sm font-black text-brand-green-ink">Email (Optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand-green"
            placeholder="john@example.com"
          />
        </div>

        {/* Title */}
        <div>
          <label className="text-sm font-black text-brand-green-ink">Review Title (Optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand-green"
            placeholder="Great quality!"
          />
        </div>

        {/* Comment */}
        <div>
          <label className="text-sm font-black text-brand-green-ink">Your Review *</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand-green"
            placeholder="Share your experience... (minimum 10 characters)"
            required
          />
          <p className="mt-1 text-xs text-gray-500">{comment.length} characters</p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-green px-4 py-3 font-bold text-white transition hover:bg-brand-gold hover:text-brand-green-ink disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit Review"}
        </button>
      </div>
    </form>
  );
}
