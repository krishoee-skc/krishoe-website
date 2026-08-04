"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  expected_delivery?: string;
  created_at: string;
}

interface Feedback {
  id: string;
  feedback_type: string;
  rating?: number;
  message: string;
  status: string;
  created_at: string;
}

export default function CustomerDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would fetch from the API based on authenticated customer
    // For now, showing demo data
    setOrders([
      {
        id: "1",
        order_number: "ORD-001",
        status: "delivered",
        total_amount: 2500,
        expected_delivery: "2026-08-02",
        created_at: "2026-07-28",
      },
      {
        id: "2",
        order_number: "ORD-002",
        status: "shipped",
        total_amount: 1800,
        expected_delivery: "2026-08-08",
        created_at: "2026-08-01",
      },
    ]);

    setFeedback([
      {
        id: "1",
        feedback_type: "review",
        rating: 5,
        message: "Excellent product quality! बहुत राम्रो पण्य।",
        status: "acknowledged",
        created_at: "2026-08-02",
      },
    ]);

    setLoyaltyPoints(250);
    setIsLoading(false);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-700";
      case "shipped":
        return "bg-blue-100 text-blue-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "delivered":
        return "✅ Delivered";
      case "shipped":
        return "🚚 Shipped";
      case "pending":
        return "⏳ Pending";
      case "cancelled":
        return "❌ Cancelled";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-600">लोड हुँदैछ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">आपको Dashboard</h1>
          <p className="text-gray-600 mt-2">आपको orders, feedback र loyalty points</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-4xl mb-2">📦</div>
            <p className="text-gray-600 text-sm">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-4xl mb-2">⭐</div>
            <p className="text-gray-600 text-sm">Feedback Given</p>
            <p className="text-2xl font-bold text-gray-900">{feedback.length}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-4xl mb-2">🎁</div>
            <p className="text-gray-600 text-sm">Loyalty Points</p>
            <p className="text-2xl font-bold text-gray-900">{loyaltyPoints}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <div className="text-4xl mb-2">👑</div>
            <p className="text-blue-100 text-sm">Tier Status</p>
            <p className="text-2xl font-bold">Silver</p>
          </div>
        </div>

        {/* Orders Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">📦 आपको Orders</h2>
            <Link href="/customer/orders" className="text-blue-600 hover:text-blue-800">
              View All →
            </Link>
          </div>

          {orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">#{order.order_number}</p>
                      <p className="text-sm text-gray-600 mt-1">Order Date: {order.created_at}</p>
                      {order.expected_delivery && (
                        <p className="text-sm text-gray-600">Expected: {order.expected_delivery}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      <p className="text-lg font-bold text-gray-900 mt-2">Rs. {order.total_amount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">अभी कोई order नहीं। 🛍️</p>
          )}
        </div>

        {/* Feedback Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">⭐ आपको Feedback</h2>
            <Link href="/customer/feedback" className="text-blue-600 hover:text-blue-800">
              Leave Feedback →
            </Link>
          </div>

          {feedback.length > 0 ? (
            <div className="space-y-4">
              {feedback.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex gap-1">
                        {[...Array(item.rating || 0)].map((_, i) => (
                          <span key={i} className="text-yellow-400">
                            ⭐
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{item.message}</p>
                      <p className="text-xs text-gray-500 mt-2">{item.created_at}</p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">कोई feedback नहीं। एक feedback दिनुहोस्!</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/customer/feedback"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-center transition"
          >
            📝 Feedback दिनुहोस्
          </Link>
          <Link
            href="/customer/orders"
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg text-center transition"
          >
            📦 सबै Orders हेर्नुहोस्
          </Link>
        </div>
      </div>
    </div>
  );
}
