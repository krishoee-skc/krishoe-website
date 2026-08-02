"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSessionCookie, requireAdminSession } from "@/lib/admin-auth";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { getSessionAdminRole } from "@/lib/admin-permissions";
import {
  listAdminStaffSessions,
  recordAdminStaffAccessHistory,
  revokeAdminStaffSession,
  revokeAllAdminStaffSessions,
} from "@/lib/admin-staff-security";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function auditContext() {
  const requestHeaders = await headers();
  return {
    ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
      || requestHeaders.get("x-real-ip")?.trim()
      || "",
    userAgent: requestHeaders.get("user-agent")?.slice(0, 500) ?? "",
  };
}

export async function revokeDeviceSessionAction(formData: FormData) {
  const actor = await requireAdminSession();
  const role = getSessionAdminRole(actor);
  const sessionId = textValue(formData, "sessionId");
  if (!sessionId) throw new Error("Device session is required.");

  const visibleSessions = await listAdminStaffSessions(role === "Owner" ? undefined : actor.staffId);
  const target = visibleSessions.find((entry) => entry.id === sessionId);
  if (!target) throw new Error("You are not allowed to sign out this device.");

  const revoked = await revokeAdminStaffSession(target.id, actor.staffId ?? actor.email ?? "Owner");
  if (!revoked) throw new Error("Device session could not be signed out.");

  const context = await auditContext();
  await recordAdminStaffAccessHistory({
    staffId: target.staffId,
    action: "device_session_revoked",
    beforeState: { sessionId: target.id, revokedAt: target.revokedAt ?? null },
    afterState: { sessionId: target.id, revoked: true },
    actorId: actor.staffId,
    actorEmail: actor.email,
    actorRole: role,
    ...context,
  });
  await recordAdminAuditEvent(
    "staff_device_logout",
    `Device session ${target.deviceLabel} was manually signed out.`,
    "success",
  );

  if (target.id === actor.sessionId) {
    await clearAdminSessionCookie();
    redirect("/admin/login");
  }

  revalidatePath("/admin/devices");
  redirect("/admin/devices?success=Device+signed+out");
}

export async function revokeAllDeviceSessionsAction(formData: FormData) {
  const actor = await requireAdminSession();
  const role = getSessionAdminRole(actor);
  const requestedStaffId = textValue(formData, "staffId");
  const targetStaffId = role === "Owner" ? requestedStaffId : actor.staffId ?? "";

  if (!targetStaffId) throw new Error("Staff account is required.");
  if (role !== "Owner" && targetStaffId !== actor.staffId) {
    throw new Error("You are not allowed to sign out another staff account.");
  }

  const count = await revokeAllAdminStaffSessions(
    targetStaffId,
    actor.staffId ?? actor.email ?? "Owner",
  );
  const context = await auditContext();
  await recordAdminStaffAccessHistory({
    staffId: targetStaffId,
    action: "all_device_sessions_revoked",
    beforeState: { activeSessions: count },
    afterState: { activeSessions: 0 },
    actorId: actor.staffId,
    actorEmail: actor.email,
    actorRole: role,
    ...context,
  });
  await recordAdminAuditEvent(
    "staff_all_devices_logout",
    `${count} device session(s) were manually signed out for staff ${targetStaffId}.`,
    "success",
  );

  if (targetStaffId === actor.staffId) {
    await clearAdminSessionCookie();
    redirect("/admin/login");
  }

  revalidatePath("/admin/devices");
  redirect(`/admin/devices?success=${encodeURIComponent(`${count} device(s) signed out`)}`);
}
