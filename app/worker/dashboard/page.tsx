"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import WorkerDashboard from "@/components/worker/WorkerDashboard";

export default function WorkerDashboardPage() {
  const searchParams = useSearchParams();
  const workerId = searchParams.get("id");
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (workerId) {
      setAuthenticated(true);
    }
  }, [workerId]);

  if (!authenticated || !workerId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Worker Portal
          </h1>
          <p className="text-gray-600 mb-6">
            Please log in with your Worker ID to access your dashboard.
          </p>
          <form className="space-y-4">
            <input
              type="password"
              placeholder="Enter your Worker ID"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Access Your Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">🏭 KRISHOE Worker Portal</h1>
          <button className="text-gray-600 hover:text-gray-900 text-sm font-medium">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <WorkerDashboard workerId={workerId} />
      </div>
    </div>
  );
}
