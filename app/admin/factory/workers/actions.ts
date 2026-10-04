"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getAdminSettings, saveAdminStaffAccount, updateAdminStaffPassword } from "@/lib/admin-settings";
import { recordAdminStaffAccessHistory, revokeAllAdminStaffSessions } from "@/lib/admin-staff-security";
import { getFactoryWorkers } from "@/lib/factory-board-data";
import { reportError } from "@/lib/report-error";
import { absoluteUrl } from "@/lib/seo";
import { formatStaffPhone, normalizeStaffPhone } from "@/lib/staff-phone";
import { generateJoinCode } from "@/lib/worker-join";
import { setWorkerLeave } from "@/lib/worker-portal";

/** On leave, or back (owner, 2026-10-02). Owner only, like closing a worker. */
export async function setWorkerLeaveAction(workerId: string, away: boolean): Promise<{ ok: boolean; en: string; ne: string }> {
  const actor = await requireAdminPermission("wages:write");
  try {
    await setWorkerLeave(workerId, away, actor.session.email ?? actor.session.staffId ?? "");
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_READY") {
      return { ok: false, en: "Add the worker app tables in Settings first.", ne: "पहिले Settings मा कामदार app को database थप्नुहोस्।" };
    }
    reportError(`set leave for factory worker ${workerId}`, error);
    return { ok: false, en: "Not saved. Try again.", ne: "सुरक्षित भएन। फेरि प्रयास गर्नुहोस्।" };
  }
  await recordAdminAuditEvent("factory_worker_leave", `Factory worker ${workerId} ${away ? "put on leave" : "back at work"}.`);
  revalidatePath("/admin/factory/workers");
  return away
    ? { ok: true, en: "On leave — still on the books.", ne: "बिदामा राखियो — हिसाबमा छ।" }
    : { ok: true, en: "Back at work.", ne: "काममा फर्कियो।" };
}

/**
 * What the screen gets back: either why not, in both languages, or the card to
 * hand the worker — their number, the code, and the link.
 */
export type WorkerJoinResult =
  | { ok: false; en: string; ne: string }
  | { ok: true; name: string; phone: string; code: string; loginUrl: string; renewed: boolean };

/** A plain check that an address could be one — the inbox itself is not asked. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A factory worker into the app, from their own row (owner, 2026-10-02).
 *
 * The mobile number is the only thing asked: the name and the factory record
 * are already known, the role is Worker, the branch is the factory's, and the
 * first password is an eight-digit code made here. The account is the same
 * kind Settings → Invite makes for a mobile-only worker — Active, the code a
 * temporary password the worker must replace at the first sign-in.
 */
export async function joinWorkerToAppAction(workerId: string, phoneInput: string, emailInput = ""): Promise<WorkerJoinResult> {
  const actor = await requireAdminPermission("settings:write");
  const phone = normalizeStaffPhone(phoneInput);
  if (!phone) return { ok: false, en: "Enter the worker's mobile number.", ne: "कामदारको मोबाइल नम्बर ठीकसँग हाल्नुहोस्।" };
  // An email too, if they have one: the app then opens with either (2026-10-04).
  const email = emailInput.trim().toLowerCase();
  if (email && !EMAIL_SHAPE.test(email)) return { ok: false, en: "That email does not look right.", ne: "Email मिलेन — फेरि हेर्नुहोस्।" };

  const worker = (await getFactoryWorkers()).find((item) => item.id === workerId);
  if (!worker || worker.status !== "active") {
    return { ok: false, en: "That worker was not found, or is not active.", ne: "त्यो कामदार भेटिएन, वा सक्रिय छैन।" };
  }

  const settings = await getAdminSettings();
  if (settings.staff.some((member) => member.factoryWorkerId === worker.id)) {
    return { ok: false, en: `${worker.name} already has the app — give a new code instead.`, ne: `${worker.name} को app पहिले नै छ — "नयाँ कोड" थिच्नुहोस्।` };
  }
  const sameNumber = settings.staff.find((member) => normalizeStaffPhone(member.phone) === phone);
  const sameEmail = email ? settings.staff.find((member) => (member.email ?? "").toLowerCase() === email) : undefined;
  if (sameEmail) {
    return { ok: false, en: `This email already signs in as ${sameEmail.name}.`, ne: `यो email ${sameEmail.name} को खातामा पहिले नै छ।` };
  }
  if (sameNumber) {
    return { ok: false, en: `This number already signs in as ${sameNumber.name}.`, ne: `यो नम्बर ${sameNumber.name} को खातामा पहिले नै छ।` };
  }

  const factoryBranch = settings.branches.find((branch) => branch.type === "Factory" && branch.status === "Active");
  const code = generateJoinCode();
  try {
    const created = await saveAdminStaffAccount({
      name: worker.name,
      phone,
      ...(email ? { email } : {}),
      role: "Worker",
      branchId: factoryBranch?.id ?? settings.company.defaultBranchId,
      factoryWorkerId: worker.id,
      status: "Active",
      password: code,
      temporaryPassword: true,
      // As for every account; a mobile-only Worker has no inbox for the code,
      // so sign-in skips that step for them until an email is added.
      mfaEnabled: true,
    });
    await recordAdminStaffAccessHistory({
      staffId: created.id,
      action: "worker_joined_from_team",
      beforeState: {},
      afterState: { role: "Worker", factoryWorkerId: worker.id, mustChangePassword: true },
      actorId: actor.session.staffId,
      actorEmail: actor.session.email,
      actorRole: actor.role,
    });
  } catch (error) {
    reportError(`join factory worker ${worker.id} to the app`, error);
    return { ok: false, en: "The account was not made. Try again.", ne: "खाता बनेन। फेरि प्रयास गर्नुहोस्।" };
  }

  await recordAdminAuditEvent(
    "factory_worker_joined_app",
    `${actor.session.email ?? "Owner"} brought ${worker.name} into the worker app (${formatStaffPhone(phone)}). The code is not recorded.`,
  );
  revalidatePath("/admin/factory/workers");
  revalidatePath("/admin/settings");
  return { ok: true, name: worker.name, phone: formatStaffPhone(phone), code, loginUrl: absoluteUrl("/worker/login"), renewed: false };
}

/**
 * A new code for a worker who already has the app — forgot their password,
 * new phone. The old password stops working, every signed-in phone is signed
 * out, and the worker sets a new password at the next sign-in.
 */
export async function newWorkerCodeAction(workerId: string): Promise<WorkerJoinResult> {
  const actor = await requireAdminPermission("settings:write");
  const settings = await getAdminSettings();
  const staff = settings.staff.find((member) => member.factoryWorkerId === workerId);
  if (!staff) return { ok: false, en: "This worker has no app account yet.", ne: "यो कामदारको app खाता अझै छैन।" };
  const worker = (await getFactoryWorkers({ includeRetired: true })).find((item) => item.id === workerId);
  if (!worker || worker.status !== "active") {
    return { ok: false, en: "Make the worker active again first.", ne: "पहिले कामदारलाई “फेरि चालु” गर्नुहोस्।" };
  }

  const code = generateJoinCode();
  try {
    // A worker who left and came back: their closed account opens again here.
    if (staff.status === "Disabled" || staff.status === "Locked") {
      await saveAdminStaffAccount({ id: staff.id, status: "Active" });
    }
    await updateAdminStaffPassword(staff.id, code, { mustChangePassword: true, activateInvitation: staff.status === "Invited" });
    const revoked = await revokeAllAdminStaffSessions(staff.id, actor.session.staffId ?? actor.session.email ?? "new-worker-code");
    await recordAdminStaffAccessHistory({
      staffId: staff.id,
      action: "worker_new_code",
      beforeState: {},
      afterState: { mustChangePassword: true, revokedSessions: revoked },
      actorId: actor.session.staffId,
      actorEmail: actor.session.email,
      actorRole: actor.role,
    });
  } catch (error) {
    reportError(`give factory worker ${workerId} a new code`, error);
    return { ok: false, en: "No new code was made. Try again.", ne: "नयाँ कोड बनेन। फेरि प्रयास गर्नुहोस्।" };
  }

  await recordAdminAuditEvent(
    "factory_worker_new_code",
    `${actor.session.email ?? "Owner"} gave ${staff.name} a new sign-in code; their phones were signed out. The code is not recorded.`,
    "warning",
  );
  revalidatePath("/admin/factory/workers");
  return { ok: true, name: staff.name, phone: formatStaffPhone(staff.phone), code, loginUrl: absoluteUrl("/worker/login"), renewed: true };
}

/**
 * An email for a worker already in the app (owner, 2026-10-04), so they open
 * it with either the mobile or the email. Like every account with an email, a
 * new phone is then sent a sign-in code there.
 */
export async function setWorkerEmailAction(workerId: string, emailInput: string): Promise<{ ok: boolean; en: string; ne: string }> {
  const actor = await requireAdminPermission("settings:write");
  const email = emailInput.trim().toLowerCase();
  if (!EMAIL_SHAPE.test(email)) return { ok: false, en: "That email does not look right.", ne: "Email मिलेन — फेरि हेर्नुहोस्।" };
  const settings = await getAdminSettings();
  const staff = settings.staff.find((member) => member.factoryWorkerId === workerId);
  if (!staff) return { ok: false, en: "This worker has no app account yet.", ne: "यो कामदारको app खाता अझै छैन।" };
  const other = settings.staff.find((member) => member.id !== staff.id && (member.email ?? "").toLowerCase() === email);
  if (other) return { ok: false, en: `This email already signs in as ${other.name}.`, ne: `यो email ${other.name} को खातामा पहिले नै छ।` };
  try {
    await saveAdminStaffAccount({ id: staff.id, email });
    await recordAdminStaffAccessHistory({
      staffId: staff.id,
      action: "worker_email_set",
      beforeState: { email: staff.email ?? "" },
      afterState: { email },
      actorId: actor.session.staffId,
      actorEmail: actor.session.email,
      actorRole: actor.role,
    });
  } catch (error) {
    reportError(`set the email of factory worker ${workerId}`, error);
    return { ok: false, en: "The email was not saved. Try again.", ne: "Email बचत भएन। फेरि प्रयास गर्नुहोस्।" };
  }
  await recordAdminAuditEvent("factory_worker_email_set", `${actor.session.email ?? "Owner"} gave ${staff.name}'s app the email ${email}.`);
  revalidatePath("/admin/factory/workers");
  revalidatePath("/admin/settings");
  return { ok: true, en: `Saved — ${staff.name} can now open the app with ${email} too.`, ne: `बचत भयो — ${staff.name} ले अब ${email} बाट पनि app खोल्न सक्छ।` };
}
