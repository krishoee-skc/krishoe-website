"use client";

import { useEffect, useState } from "react";
import WorkerAnalyticsDashboard from "@/components/admin/WorkerAnalyticsDashboard";
import { bikramMonthLabel, bikramYearMonth } from "@/lib/bikram-sambat";

interface WorkerMetrics {
  workerId: string;
  workerName: string;
  category: string;
  todayPairs: number;
  todayEarnings: number;
  weeklyPairs: number;
  weeklyEarnings: number;
  weeklyDays: number;
  monthlyPairs: number;
  monthlyEarnings: number;
  monthlyDays: number;
  completedPairs: number;
  reworkPairs: number;
  defectRate: number;
  presentDays: number;
  absentDays: number;
  attendanceRate: number;
}

export default function WorkerAnalyticsPage() {
  const [workers, setWorkers] = useState<WorkerMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadWorkerMetrics = async () => {
      try {
        // In production, this would fetch from API
        // GET /api/admin/workers/metrics
        // For now, using mock data
        const mockWorkers: WorkerMetrics[] = [
          {
            workerId: "1",
            workerName: "राज कुमार",
            category: "Upper",
            todayPairs: 60,
            todayEarnings: 720,
            weeklyPairs: 280,
            weeklyEarnings: 3360,
            weeklyDays: 5,
            monthlyPairs: 1200,
            monthlyEarnings: 14400,
            monthlyDays: 20,
            completedPairs: 1195,
            reworkPairs: 5,
            defectRate: 0.42,
            presentDays: 20,
            absentDays: 2,
            attendanceRate: 91,
          },
          {
            workerId: "2",
            workerName: "संतोष शर्मा",
            category: "Fibermen",
            todayPairs: 55,
            todayEarnings: 440,
            weeklyPairs: 260,
            weeklyEarnings: 2080,
            weeklyDays: 5,
            monthlyPairs: 1100,
            monthlyEarnings: 8800,
            monthlyDays: 19,
            completedPairs: 1090,
            reworkPairs: 10,
            defectRate: 0.91,
            presentDays: 19,
            absentDays: 3,
            attendanceRate: 86,
          },
          {
            workerId: "3",
            workerName: "अन्य कार्यकर्ता",
            category: "Upper",
            todayPairs: 45,
            todayEarnings: 540,
            weeklyPairs: 220,
            weeklyEarnings: 2640,
            weeklyDays: 5,
            monthlyPairs: 950,
            monthlyEarnings: 11400,
            monthlyDays: 18,
            completedPairs: 940,
            reworkPairs: 10,
            defectRate: 1.05,
            presentDays: 18,
            absentDays: 4,
            attendanceRate: 82,
          },
          {
            workerId: "4",
            workerName: "बिकास सिंह",
            category: "Fibermen",
            todayPairs: 50,
            todayEarnings: 400,
            weeklyPairs: 240,
            weeklyEarnings: 1920,
            weeklyDays: 5,
            monthlyPairs: 1050,
            monthlyEarnings: 8400,
            monthlyDays: 21,
            completedPairs: 1045,
            reworkPairs: 5,
            defectRate: 0.48,
            presentDays: 21,
            absentDays: 1,
            attendanceRate: 96,
          },
          {
            workerId: "5",
            workerName: "प्रिया शाही",
            category: "Upper",
            todayPairs: 48,
            todayEarnings: 576,
            weeklyPairs: 230,
            weeklyEarnings: 2760,
            weeklyDays: 5,
            monthlyPairs: 1020,
            monthlyEarnings: 12240,
            monthlyDays: 19,
            completedPairs: 1010,
            reworkPairs: 10,
            defectRate: 0.98,
            presentDays: 19,
            absentDays: 3,
            attendanceRate: 86,
          },
        ];

        setWorkers(mockWorkers);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load worker metrics");
      } finally {
        setLoading(false);
      }
    };

    loadWorkerMetrics();
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <div className="animate-pulse text-brand-muted">
          Loading worker analytics...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  const currentDate = new Date();
  // The Nepali month, because that is the month a wage belongs to. The
  // English one names a period this shop never closes.
  const month = bikramMonthLabel(currentDate);
  const year = String(bikramYearMonth(currentDate)?.year ?? currentDate.getFullYear());

  return (
    <div className="p-4 sm:p-6">
      <WorkerAnalyticsDashboard
        workers={workers}
        month={month}
        year={year}
      />
    </div>
  );
}
