"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface PayslipData {
  month: string;
  baseSalary: number;
  piecesRate: number;
  attendanceBonus: number;
  deductions: number;
  netPay: number;
  status: string;
}

export default function PayslipPage() {
  const searchParams = useSearchParams();
  const workerId = searchParams.get("id");
  const [payslips, setPayslips] = useState<PayslipData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workerId) {
      loadPayslips();
    }
  }, [workerId]);

  const loadPayslips = async () => {
    setLoading(false);
    // Mock data for now
    const mockPayslips: PayslipData[] = [
      {
        month: "2026-08",
        baseSalary: 0,
        piecesRate: 25000,
        attendanceBonus: 500,
        deductions: 0,
        netPay: 25500,
        status: "Approved",
      },
      {
        month: "2026-07",
        baseSalary: 0,
        piecesRate: 23500,
        attendanceBonus: 500,
        deductions: 0,
        netPay: 24000,
        status: "Paid",
      },
      {
        month: "2026-06",
        baseSalary: 0,
        piecesRate: 24000,
        attendanceBonus: 500,
        deductions: 0,
        netPay: 24500,
        status: "Paid",
      },
    ];
    setPayslips(mockPayslips);
    if (mockPayslips.length > 0) {
      setSelectedMonth(mockPayslips[0].month);
    }
  };

  const selected = payslips.find((p) => p.month === selectedMonth);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading payslips...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 p-4 mb-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">📄 Payslips</h1>
          <Link
            href={`/worker/dashboard?id=${workerId}`}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Month Selector */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-1">
            <h2 className="font-semibold text-gray-900 mb-4">📅 Select Month</h2>
            <div className="space-y-2">
              {payslips.map((p) => (
                <button
                  key={p.month}
                  onClick={() => setSelectedMonth(p.month)}
                  className={`w-full px-4 py-2 rounded-lg text-left font-medium transition-colors ${
                    selectedMonth === p.month
                      ? "bg-blue-600 text-white"
                      : "bg-gray-50 text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  {new Date(p.month + "-01").toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </button>
              ))}
            </div>
          </div>

          {/* Payslip Details */}
          {selected && (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Payslip - {new Date(selected.month + "-01").toLocaleString("default", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                  <p className={`text-sm font-medium mt-2 inline-block px-3 py-1 rounded ${
                    selected.status === "Paid"
                      ? "bg-green-100 text-green-700"
                      : selected.status === "Approved"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {selected.status}
                  </p>
                </div>

                <div className="space-y-3 border-b border-gray-200 pb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Salary</span>
                    <span className="font-medium text-gray-900">
                      Rs. {selected.baseSalary.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Piece Rate Earnings</span>
                    <span className="font-medium text-gray-900">
                      Rs. {selected.piecesRate.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Attendance Bonus</span>
                    <span className="font-medium text-gray-900">
                      Rs. {selected.attendanceBonus.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 my-6 py-6 border-b border-gray-200">
                  <div className="flex justify-between text-red-600">
                    <span>Deductions</span>
                    <span className="font-medium">
                      - Rs. {selected.deductions.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">
                      NET PAY
                    </span>
                    <span className="text-2xl font-bold text-green-700">
                      Rs. {selected.netPay.toLocaleString()}
                    </span>
                  </div>
                </div>

                <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium">
                  📥 Download PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
