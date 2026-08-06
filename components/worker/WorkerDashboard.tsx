"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface WorkerProfile {
  id: string;
  name: string;
  phone: string;
  role: string;
  department: string;
  employmentType: string;
  salaryType: string;
  joinedAt: string;
  status: string;
}

interface DashboardData {
  profile: WorkerProfile | null;
  thisMonth: {
    earnings: number;
    pairs: number;
    attendance: number;
  };
  lastMonth: {
    earnings: number;
    pairs: number;
  };
}

export default function WorkerDashboard({ workerId }: { workerId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "earnings" | "attendance" | "production">(
    "overview"
  );

  useEffect(() => {
    loadDashboardData();
  }, [workerId]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/worker/dashboard?workerId=${workerId}`);
      if (res.ok) {
        const result = await res.json();
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading your dashboard...
      </div>
    );
  }

  if (!data || !data.profile) {
    return (
      <div className="p-6 text-center text-red-500">
        Failed to load worker profile
      </div>
    );
  }

  const { profile, thisMonth, lastMonth } = data;
  const earningsChange = thisMonth.earnings - lastMonth.earnings;
  const earningsChangePercent =
    lastMonth.earnings > 0
      ? ((earningsChange / lastMonth.earnings) * 100).toFixed(1)
      : 0;
  const pairsChange = thisMonth.pairs - lastMonth.pairs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">👋 Welcome, {profile.name}!</h1>
        <p className="text-blue-100">
          {profile.department} • {profile.employmentType} • {profile.salaryType}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">This Month Earnings</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            Rs. {thisMonth.earnings.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {earningsChange > 0 ? "+" : ""}{earningsChange.toLocaleString()} (
            {earningsChangePercent}%)
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Pairs Completed</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {thisMonth.pairs}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Last month: {lastMonth.pairs}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Attendance Rate</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {Math.round(thisMonth.attendance)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            This month
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Member Since</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {new Date(profile.joinedAt).getFullYear()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(profile.joinedAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {([
          { key: "overview" as const, label: "📊 Overview" },
          { key: "earnings" as const, label: "💰 Earnings" },
          { key: "attendance" as const, label: "📅 Attendance" },
          { key: "production" as const, label: "📦 Production" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              👤 Your Profile
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">Full Name</label>
                <p className="text-gray-900 font-medium mt-1">{profile.name}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Phone</label>
                <p className="text-gray-900 font-medium mt-1">{profile.phone}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Department</label>
                <p className="text-gray-900 font-medium mt-1">
                  {profile.department}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Employment Type</label>
                <p className="text-gray-900 font-medium mt-1">
                  {profile.employmentType}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Salary Type</label>
                <p className="text-gray-900 font-medium mt-1">
                  {profile.salaryType}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Status</label>
                <p className="text-gray-900 font-medium mt-1">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      profile.status === "Active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {profile.status}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">💡 Need Help?</h3>
            <p className="text-sm text-blue-800">
              Contact your manager or HR department for any questions about your
              earnings, attendance, or performance.
            </p>
          </div>
        </div>
      )}

      {/* Earnings Tab */}
      {activeTab === "earnings" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              💰 This Month's Earnings
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between pb-3 border-b border-gray-100">
                <span className="text-gray-600">Base Salary / Wages</span>
                <span className="font-bold text-gray-900">Rs. --</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-gray-100">
                <span className="text-gray-600">Piece Rate Earnings</span>
                <span className="font-bold text-gray-900">
                  Rs. {thisMonth.earnings.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between pb-3 border-b border-gray-100">
                <span className="text-gray-600">Attendance Bonus</span>
                <span className="font-bold text-gray-900">Rs. --</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-gray-100">
                <span className="text-gray-600">Quality Bonus</span>
                <span className="font-bold text-green-600">Eligible? 🎁</span>
              </div>
              <div className="flex justify-between pt-3 text-lg">
                <span className="font-bold text-gray-900">Net Pay</span>
                <span className="font-bold text-blue-600">
                  Rs. {thisMonth.earnings.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <Link
            href={`/worker/payslip?id=${workerId}`}
            className="block w-full bg-blue-600 text-white py-2 rounded-lg text-center hover:bg-blue-700 font-medium"
          >
            📄 View/Download Payslip
          </Link>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              📅 This Month's Attendance
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-3 rounded">
                <div className="text-sm text-green-600">Present Days</div>
                <div className="text-2xl font-bold text-green-900">--</div>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-sm text-blue-600">Half Days</div>
                <div className="text-2xl font-bold text-blue-900">--</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded">
                <div className="text-sm text-yellow-600">Leave Days</div>
                <div className="text-2xl font-bold text-yellow-900">--</div>
              </div>
              <div className="bg-red-50 p-3 rounded">
                <div className="text-sm text-red-600">Absent Days</div>
                <div className="text-2xl font-bold text-red-900">--</div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex justify-between mb-2">
                <span className="font-medium text-gray-900">Attendance Rate</span>
                <span className="font-bold text-lg text-gray-900">
                  {Math.round(thisMonth.attendance)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 bg-green-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(thisMonth.attendance, 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          <Link
            href={`/worker/attendance?id=${workerId}`}
            className="block w-full bg-blue-600 text-white py-2 rounded-lg text-center hover:bg-blue-700 font-medium"
          >
            📋 View Full Attendance Records
          </Link>
        </div>
      )}

      {/* Production Tab */}
      {activeTab === "production" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              📦 This Month's Production
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-purple-50 p-4 rounded">
                <div className="text-sm text-purple-600 font-medium">
                  Pairs Completed
                </div>
                <div className="text-3xl font-bold text-purple-900 mt-2">
                  {thisMonth.pairs}
                </div>
              </div>
              <div className="bg-orange-50 p-4 rounded">
                <div className="text-sm text-orange-600 font-medium">
                  Average per Day
                </div>
                <div className="text-3xl font-bold text-orange-900 mt-2">
                  {Math.round(thisMonth.pairs / 20)} 👟
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="font-medium text-gray-900 mb-3">Quality Metrics</h3>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">
                  ✨ Keep your quality rate above 95% for bonus eligibility
                </p>
                <p className="text-gray-600">
                  ✨ Maintain 90%+ attendance for attendance bonus
                </p>
                <p className="text-green-600 font-medium">
                  🎁 Combined: 5% bonus on monthly earnings
                </p>
              </div>
            </div>
          </div>

          <Link
            href={`/worker/production?id=${workerId}`}
            className="block w-full bg-blue-600 text-white py-2 rounded-lg text-center hover:bg-blue-700 font-medium"
          >
            📊 View Production Details
          </Link>
        </div>
      )}
    </div>
  );
}
