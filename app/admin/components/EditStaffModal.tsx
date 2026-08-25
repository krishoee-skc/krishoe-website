"use client";

import { useState } from "react";
import { XIcon } from "@/components/Icons";

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: string;
}

interface EditStaffModalProps {
  staff: Staff | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedStaff: Partial<Staff>) => Promise<void>;
}

export default function EditStaffModal({ staff, isOpen, onClose, onSave }: EditStaffModalProps) {
  const [formData, setFormData] = useState<Partial<Staff>>(
    staff || {
      name: "",
      email: "",
      role: "",
      branch: "",
    }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await onSave(formData);
      setSuccess("Staff updated successfully!");
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update staff");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !staff) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-brand-paper p-6 shadow-lg dark:bg-brand-green-ink">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-brand-green-ink dark:text-white">Edit Staff</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-brand-mist dark:hover:bg-brand-green-ink"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-brand-muted-deep dark:text-brand-muted-soft">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name || ""}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-brand-green-line px-3 py-2 dark:border-white/10 dark:bg-brand-muted-deep dark:text-white"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-brand-muted-deep dark:text-brand-muted-soft">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email || ""}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-brand-green-line px-3 py-2 dark:border-white/10 dark:bg-brand-muted-deep dark:text-white"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-brand-muted-deep dark:text-brand-muted-soft">
              Role
            </label>
            <select
              name="role"
              value={formData.role || ""}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-brand-green-line px-3 py-2 dark:border-white/10 dark:bg-brand-muted-deep dark:text-white"
            >
              <option value="">Select Role</option>
              <option value="Viewer">Viewer</option>
              <option value="Accountant">Accountant</option>
              <option value="Manager">Manager</option>
              <option value="Owner">Owner</option>
            </select>
          </div>

          {/* Branch */}
          <div>
            <label className="block text-sm font-medium text-brand-muted-deep dark:text-brand-muted-soft">
              Branch
            </label>
            <input
              type="text"
              name="branch"
              value={formData.branch || ""}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg border border-brand-green-line px-3 py-2 dark:border-white/10 dark:bg-brand-muted-deep dark:text-white"
            />
          </div>

          {/* Messages */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
              {success}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-brand-green-line px-4 py-2 text-sm font-medium text-brand-muted-deep hover:bg-brand-paper-deep dark:border-white/10 dark:text-brand-muted-soft dark:hover:bg-brand-green-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-ink disabled:opacity-50 dark:bg-brand-green dark:hover:bg-brand-green-ink"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
