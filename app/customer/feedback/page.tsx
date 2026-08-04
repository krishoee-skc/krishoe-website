"use client";

import { useState } from "react";
import Link from "next/link";

export default function FeedbackPage() {
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_email: "",
    feedback_type: "review",
    rating: 5,
    title: "",
    message: "",
    product_mentioned: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRatingClick = (rating: number) => {
    setFormData((prev) => ({
      ...prev,
      rating,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/customers/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: "temp-" + Date.now(), // Temporary ID, should be from auth
          feedback_type: formData.feedback_type,
          rating: parseInt(formData.rating.toString()),
          title: formData.title,
          message: formData.message,
          product_mentioned: formData.product_mentioned,
        }),
      });

      if (response.ok) {
        setSuccessMessage("धन्यवाद! आपको feedback सफलतापूर्वक पठाइयो। 🙏");
        setFormData({
          customer_name: "",
          customer_email: "",
          feedback_type: "review",
          rating: 5,
          title: "",
          message: "",
          product_mentioned: "",
        });
      } else {
        const error = await response.json();
        setErrorMessage(error.error || "Failed to submit feedback");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Error submitting feedback");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/customer" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">आपको Feedback दिनुहोस्</h1>
          <p className="text-gray-600 mt-2">आपको अनुभव हामीलाई सुधार गर्न मद्दत गर्छ</p>
        </div>

        {/* Feedback Form Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name & Email */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">नाम</label>
                <input
                  type="text"
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleChange}
                  placeholder="आपको नाम दिनुहोस्"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  name="customer_email"
                  value={formData.customer_email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Feedback Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Feedback प्रकार</label>
              <select
                name="feedback_type"
                value={formData.feedback_type}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="review">⭐ Product Review</option>
                <option value="complaint">⚠️ Complaint</option>
                <option value="suggestion">💡 Suggestion</option>
                <option value="issue">🔧 Issue Report</option>
              </select>
            </div>

            {/* Rating (for reviews) */}
            {formData.feedback_type === "review" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingClick(star)}
                      className={`text-3xl transition ${
                        star <= formData.rating ? "text-yellow-400" : "text-gray-300 hover:text-yellow-200"
                      }`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">{formData.rating} stars selected</p>
              </div>
            )}

            {/* Product & Title */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product (Optional)</label>
                <input
                  type="text"
                  name="product_mentioned"
                  value={formData.product_mentioned}
                  onChange={handleChange}
                  placeholder="कुन product को बारेमा?"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="संक्षेप शीर्षक"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">विस्तृत Feedback (आवश्यक)</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="आपको अनुभव विस्तारै बताउनुहोस्..."
                rows={6}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Messages */}
            {successMessage && (
              <div className="p-4 bg-green-100 text-green-700 rounded-lg flex items-start gap-3">
                <span className="text-2xl">✅</span>
                <p>{successMessage}</p>
              </div>
            )}

            {errorMessage && (
              <div className="p-4 bg-red-100 text-red-700 rounded-lg flex items-start gap-3">
                <span className="text-2xl">❌</span>
                <p>{errorMessage}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition"
            >
              {isLoading ? "पठाइदैछ..." : "📤 Feedback पठाउनुहोस्"}
            </button>
          </form>
        </div>

        {/* Info Card */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">🎯 आपको Feedback महत्त्वपूर्ण छ</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✅ प्रत्येक feedback ध्यान पूर्वक पढिन्छ</li>
            <li>✅ समस्या भएमा हामी तुरुन्तै जवाफ दिन्छु</li>
            <li>✅ आपको सुझाव हामीलाई सुधार गर्न मद्दत गर्छ</li>
            <li>✅ उत्कृष्ट feedback को लागि reward points पाउनुहुनेछ</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
