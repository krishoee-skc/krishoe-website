import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { getAdminSettings, saveAdminStaffAccount, verifyPasswordForStaffIdentifier } from "@/lib/admin-settings";
import { recordAdminStaffAccessHistory, revokeAllAdminStaffSessions } from "@/lib/admin-staff-security";

/**
 * A worker who has left cannot get back in (owner, 2026-10-02).
 *
 * Closing a worker in Team used to take them off the work forms and nothing
 * more: the app account stayed Active, the phone in their pocket stayed signed
 * in, and the right password still opened it. Now closing a worker switches
 * their app account off (Disabled) and signs every phone out, in the same step.
 * Nothing of theirs is deleted — wages, work and the account itself stay, and
 * "New code" on their row opens it again once they are back.
 */
export async function lockWorkerApp(workerId: string, actor: { id: string; email: string; role: string }) {
  const { staff } = await getAdminSettings();
  const accounts = staff.filter((member) => member.factoryWorkerId === workerId && member.status !== "Disabled");
  for (const account of accounts) {
    await saveAdminStaffAccount({ id: account.id, status: "Disabled" });
    const revoked = await revokeAllAdminStaffSessions(account.id, actor.id || actor.email || "worker-left");
    await recordAdminStaffAccessHistory({
      staffId: account.id,
      action: "worker_left_app_locked",
      beforeState: { status: account.status },
      afterState: { status: "Disabled", revokedSessions: revoked },
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
    });
    await recordAdminAuditEvent(
      "factory_worker_app_locked",
      `${account.name} left the factory: their app account was switched off and ${revoked} signed-in phone(s) signed out.`,
      "warning",
    );
  }
  return accounts.length;
}

/**
 * Whether these are a closed worker account's own right details — so the
 * sign-in can say "your account is closed" instead of "wrong password". Only
 * with the right password: a wrong one is told nothing new.
 */
export async function isClosedWorkerSignIn(identifier: string, password: string) {
  const match = await verifyPasswordForStaffIdentifier(identifier, password);
  return Boolean(match && match.role === "Worker" && match.status === "Disabled");
}
