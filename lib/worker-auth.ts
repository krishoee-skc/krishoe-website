import { getAdminSession } from "@/lib/admin-auth";
import { getAdminStaffAccountById } from "@/lib/admin-settings";
import { getEmployeeHrDetail } from "@/lib/hr";

export async function getCurrentWorkerAccess() {
  const session = await getAdminSession();

  if (!session?.staffId) {
    return { authenticated: false as const, reason: "Worker sign-in is required." };
  }

  const staff = await getAdminStaffAccountById(session.staffId);
  if (!staff || staff.status !== "Active") {
    return { authenticated: false as const, reason: "This staff account is not active." };
  }

  if (!staff.employeeId) {
    return {
      authenticated: true as const,
      linked: false as const,
      session,
      staff,
      reason: "HR has not linked this staff account to an employee record yet.",
    };
  }

  const detail = await getEmployeeHrDetail(staff.employeeId);
  if (!detail || detail.employee.status !== "Active") {
    return {
      authenticated: true as const,
      linked: false as const,
      session,
      staff,
      reason: "The linked HR employee record is missing or inactive.",
    };
  }

  return {
    authenticated: true as const,
    linked: true as const,
    session,
    staff,
    detail,
  };
}
