"use client";

import AdvancedAnalyticsDashboard from "@/components/admin/AdvancedAnalyticsDashboard";
import GoogleAnalyticsDashboard from "@/components/admin/GoogleAnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <GoogleAnalyticsDashboard />
      <AdvancedAnalyticsDashboard />
    </div>
  );
}
