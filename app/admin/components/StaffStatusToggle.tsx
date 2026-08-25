"use client";

import { useState } from "react";

interface StaffStatusToggleProps {
  staffId: string;
  staffName: string;
  currentStatus: "active" | "inactive";
  onStatusChange: (staffId: string, newStatus: "active" | "inactive") => Promise<void>;
}

export default function StaffStatusToggle({
  staffId,
  staffName,
  currentStatus,
  onStatusChange,
}: StaffStatusToggleProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  const handleStatusChange = async () => {
    setLoading(true);
    setError("");

    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      await onStatusChange(staffId, newStatus);
      setShowConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const isActive = currentStatus === "active";

  return (
    <div>
      <button
        onClick={() => setShowConfirm(true)}
        className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors ${
          isActive
            ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
            : "bg-brand-mist text-brand-green-ink hover:bg-brand-green-line dark:bg-brand-muted-deep dark:text-white/60"
        }`}
      >
        {isActive ? "Active" : "Inactive"}
      </button>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-brand-paper p-6 shadow-lg dark:bg-brand-green-ink">
            <h3 className="text-lg font-bold text-brand-green-ink dark:text-white">
              Change Staff Status
            </h3>
            <p className="mt-2 text-brand-muted dark:text-white/60">
              Are you sure you want to mark <strong>{staffName}</strong> as{" "}
              <strong>{currentStatus === "active" ? "inactive" : "active"}</strong>?
            </p>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-brand-green-line px-4 py-2 text-sm font-medium text-brand-muted-deep hover:bg-brand-paper-deep dark:border-white/10 dark:text-brand-muted-soft dark:hover:bg-brand-green-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                disabled={loading}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
              >
                {loading ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
