"use server";

import { redirect } from "next/navigation";
import { clearAdminSessionCookie, getAdminSession } from "@/lib/admin-auth";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { revokeAdminStaffSession } from "@/lib/admin-staff-security";

export async function logoutWorkerAction() {
  const session = await getAdminSession();

  if (session) {
    await recordAdminAuditEvent("worker_logout", "Worker portal session cleared.");
    if (session.sessionId) {
      await revokeAdminStaffSession(session.sessionId, session.staffId ?? "self");
    }
  }

  await clearAdminSessionCookie();
  redirect("/worker/login");
}
