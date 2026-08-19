"use server";

import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminStaffAccountById } from "@/lib/admin-settings";
import {
  deletePasskey,
  finishPasskeyLogin,
  finishPasskeyRegistration,
  listPasskeys,
  startPasskeyLogin,
  startPasskeyRegistration,
} from "@/lib/passkeys";
import { completePasskeyStaffLogin } from "@/app/admin/login/actions";

/**
 * Passkey sign-in and enrolment.
 *
 * Kept beside the password actions rather than in an API route so the browser
 * never has to hold anything but the WebAuthn response itself — no token to
 * carry, nothing to leak in a URL.
 *
 * Enrolment requires an existing session on purpose: a passkey is a way in, and
 * adding one has to be at least as hard as the way in the person already has.
 * Otherwise a borrowed unlocked laptop becomes a permanent key.
 */

export async function startPasskeyRegistrationAction() {
  const session = await getAdminSession();
  const staffId = session?.staffId;
  if (!staffId) return { ok: false as const, reason: "पहिले login गर्नुहोस्।" };

  const staff = await getAdminStaffAccountById(staffId);
  if (!staff) return { ok: false as const, reason: "खाता भेटिएन।" };

  const options = await startPasskeyRegistration({
    id: staff.id,
    name: staff.name,
    email: staff.email,
  });

  return { ok: true as const, options };
}

export async function finishPasskeyRegistrationAction(
  response: RegistrationResponseJSON,
  label: string,
) {
  const session = await getAdminSession();
  const staffId = session?.staffId;
  if (!staffId) return { ok: false as const, reason: "पहिले login गर्नुहोस्।" };

  const result = await finishPasskeyRegistration(staffId, response, label);

  if (result.ok) {
    await recordAdminAuditEvent(
      "passkey_registered",
      `A passkey was added for ${session.email ?? staffId} (${label}).`,
      "success",
      { actorId: staffId, actorEmail: session.email, actorRole: session.role },
    );
  }

  return result;
}

export async function listPasskeysAction() {
  const session = await getAdminSession();
  if (!session?.staffId) return [];
  return listPasskeys(session.staffId);
}

export async function deletePasskeyAction(id: string) {
  const session = await getAdminSession();
  const staffId = session?.staffId;
  if (!staffId) return { ok: false as const };

  await deletePasskey(staffId, id);
  // Removing a way into the shop is exactly the kind of change that matters
  // afterwards, whether it was the owner tidying up or someone else at their
  // desk.
  await recordAdminAuditEvent(
    "passkey_removed",
    `A passkey was removed for ${session.email ?? staffId}.`,
    "warning",
    { actorId: staffId, actorEmail: session.email, actorRole: session.role },
  );

  return { ok: true as const };
}

export async function startPasskeyLoginAction() {
  const options = await startPasskeyLogin();
  return { ok: true as const, options };
}

export async function finishPasskeyLoginAction(response: AuthenticationResponseJSON) {
  const verified = await finishPasskeyLogin(response);
  if (!verified.ok) return { ok: false as const, message: verified.reason };

  const staff = await getAdminStaffAccountById(verified.staffId);
  if (!staff) return { ok: false as const, message: "खाता भेटिएन।" };

  // A passkey already proves possession of the device and a fingerprint or PIN,
  // so it counts as verified — asking for an emailed code on top would be
  // asking for a weaker second factor than the first one.
  return completePasskeyStaffLogin(staff);
}
