import FeedbackDashboard from "@/components/admin/FeedbackDashboard";
import { requireAdminPermission } from "@/lib/admin-permissions";

export const metadata = {
  title: "Feedback Management | KRISHOE Admin",
  description: "Manage user feedback, bug reports, and feature requests",
};

export default async function FeedbackPage() {
  const adminUser = await requireAdminPermission();

  if (!adminUser) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 font-semibold">Unauthorized Access</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Feedback Management</h1>
        <p className="text-gray-600 mt-2">
          Review and manage feedback from users (customers, workers, admins)
        </p>
      </div>

      <FeedbackDashboard />
    </div>
  );
}
