"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface AttendanceRecord {
  date: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
}

export default function AttendancePage() {
  const searchParams = useSearchParams();
  const workerId = searchParams.get("id");

  // Mock data
  const monthlyAttendance = {
    presentDays: 18,
    halfDays: 2,
    leaveDays: 1,
    absentDays: 1,
    attendanceRate: 92,
    records: [
      { date: "2026-08-06", status: "Present", checkIn: "09:15", checkOut: "17:45" },
      { date: "2026-08-05", status: "Present", checkIn: "09:00", checkOut: "18:00" },
      { date: "2026-08-04", status: "Half Day" },
      { date: "2026-08-03", status: "Absent" },
      { date: "2026-08-02", status: "Leave" },
      { date: "2026-08-01", status: "Present", checkIn: "09:20", checkOut: "17:50" },
    ],
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Present":
        return "bg-green-100 text-green-700";
      case "Half Day":
        return "bg-blue-100 text-blue-700";
      case "Leave":
        return "bg-yellow-100 text-yellow-700";
      case "Absent":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 p-4 mb-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">📅 Attendance Records</h1>
          <Link
            href={`/worker/dashboard?id=${workerId}`}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <div className="text-sm text-green-600 font-medium">Present Days</div>
            <div className="text-2xl font-bold text-green-900 mt-2">
              {monthlyAttendance.presentDays}
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <div className="text-sm text-blue-600 font-medium">Half Days</div>
            <div className="text-2xl font-bold text-blue-900 mt-2">
              {monthlyAttendance.halfDays}
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <div className="text-sm text-yellow-600 font-medium">Leave Days</div>
            <div className="text-2xl font-bold text-yellow-900 mt-2">
              {monthlyAttendance.leaveDays}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <div className="text-sm text-red-600 font-medium">Absent Days</div>
            <div className="text-2xl font-bold text-red-900 mt-2">
              {monthlyAttendance.absentDays}
            </div>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex justify-between mb-2">
            <span className="font-medium text-gray-900">Attendance Rate</span>
            <span className="font-bold text-lg text-gray-900">
              {monthlyAttendance.attendanceRate}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="h-3 bg-green-500 rounded-full transition-all"
              style={{ width: `${Math.min(monthlyAttendance.attendanceRate, 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Keep above 90% for attendance bonus eligibility
          </p>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Check In
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Check Out
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {monthlyAttendance.records.map((record) => (
                <tr key={record.date} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {new Date(record.date).toLocaleDateString("default", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        record.status
                      )}`}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {record.checkIn || "—"}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {record.checkOut || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
