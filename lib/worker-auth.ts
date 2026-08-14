import { getAdminSession } from "@/lib/admin-auth";
import { getAdminStaffAccountById } from "@/lib/admin-settings";
import { getFactoryWorkerPortalDetail } from "@/lib/factory-worker-portal";

/**
 * Resolves the signed-in worker to the factory record their pairs and wages are
 * kept against.
 *
 * This used to go through employee_id into hr_employees, but the shop floor
 * runs on the factory_* tables and the HR module holds no attendance or
 * payroll — so the portal showed an empty page beside a full one. The link is
 * an explicit factory_worker_id rather than a name match, because two workers
 * can share a name and matching on one is how wages get attributed to the
 * wrong person.
 */
export async function getCurrentWorkerAccess() {
  const session = await getAdminSession();

  if (!session?.staffId) {
    return { authenticated: false as const, reason: "Worker sign-in is required." };
  }

  const staff = await getAdminStaffAccountById(session.staffId);
  if (!staff || staff.status !== "Active") {
    return { authenticated: false as const, reason: "This staff account is not active." };
  }

  if (!staff.factoryWorkerId) {
    return {
      authenticated: true as const,
      linked: false as const,
      session,
      staff,
      reason: "यो sign-in अझै कुनै कारखानाको कामदारसँग जोडिएको छैन।",
    };
  }

  const detail = await getFactoryWorkerPortalDetail(staff.factoryWorkerId);
  if (!detail || detail.worker.status !== "active") {
    return {
      authenticated: true as const,
      linked: false as const,
      session,
      staff,
      reason: "जोडिएको कामदारको विवरण भेटिएन, वा त्यो कामदार अहिले निष्क्रिय छ।",
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
