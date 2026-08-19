import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { queryPostgres } from "@/lib/postgres/client";
import { getSiteUrl } from "@/lib/seo";

/**
 * Signing in with a fingerprint instead of a password.
 *
 * A password is the weakest part of this shop and everyone already knows it: it
 * can be guessed, reused on a site that later leaks it, read over a shoulder at
 * the counter, or typed into a page that only looks like ours. Every other
 * protection here exists to contain that one weakness.
 *
 * A passkey removes it. The private half never leaves the phone, is unlocked by
 * a fingerprint or the device PIN, and is bound to this site's address — so a
 * copy of our sign-in page on another domain cannot use it even if someone is
 * fooled into trying. That last property is one a password can never have, and
 * it is why this is worth the work.
 *
 * The password is deliberately left in place. A shop that can only be entered
 * with one phone is a shop that closes when that phone is dropped in a river.
 */

const STORE = "notifications";

/**
 * The domain a credential is bound to.
 *
 * Derived from the site URL rather than configured separately, because those
 * two disagreeing is the failure that produces "sign-in failed" with nothing in
 * any log to explain it. WebAuthn wants a bare hostname, without the port.
 */
export function passkeyRelyingParty() {
  const url = new URL(getSiteUrl());
  return { id: url.hostname, origin: url.origin, name: "KRISHOE" };
}

export type StoredPasskey = {
  id: string;
  staffId: string;
  label: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

type PasskeyRow = {
  id: string;
  staff_id: string;
  public_key: string;
  counter: string | number;
  label: string;
  device_type: string;
  backed_up: boolean;
  transports: string;
  created_at: Date;
  last_used_at: Date | null;
};

export async function listPasskeys(staffId: string): Promise<StoredPasskey[]> {
  const rows = await queryPostgres<PasskeyRow>(
    STORE,
    `SELECT id, staff_id, public_key, counter, label, device_type, backed_up, transports,
            created_at, last_used_at
       FROM admin_passkeys WHERE staff_id = $1 ORDER BY created_at DESC`,
    [staffId],
  );

  return rows.map((row) => ({
    id: row.id,
    staffId: row.staff_id,
    label: row.label,
    deviceType: row.device_type,
    backedUp: row.backed_up,
    createdAt: new Date(row.created_at).toISOString(),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
  }));
}

export async function deletePasskey(staffId: string, id: string) {
  // Scoped to the owner of the key. Without the staff_id condition, anyone who
  // could reach this could remove somebody else's way in.
  await queryPostgres(STORE, `DELETE FROM admin_passkeys WHERE id = $1 AND staff_id = $2`, [
    id,
    staffId,
  ]);
}

/** Stores a one-time challenge, and sweeps whatever has expired. */
async function rememberChallenge(challenge: string, kind: "register" | "login", staffId?: string) {
  await queryPostgres(STORE, `DELETE FROM admin_passkey_challenges WHERE expires_at < now()`);
  await queryPostgres(
    STORE,
    `INSERT INTO admin_passkey_challenges (challenge, staff_id, kind, expires_at)
     VALUES ($1, $2, $3, now() + interval '5 minutes')
     ON CONFLICT (challenge) DO NOTHING`,
    [challenge, staffId ?? null, kind],
  );
}

/**
 * Takes a challenge, and refuses to give the same one twice.
 *
 * Deleting on read is what stops a captured response being replayed later, which
 * is the one thing that would undo the whole scheme.
 */
async function consumeChallenge(challenge: string, kind: "register" | "login") {
  const rows = await queryPostgres<{ challenge: string; staff_id: string | null }>(
    STORE,
    `DELETE FROM admin_passkey_challenges
      WHERE challenge = $1 AND kind = $2 AND expires_at > now()
      RETURNING challenge, staff_id`,
    [challenge, kind],
  );
  return rows[0] ?? null;
}

/** The challenge the browser echoed back, read from its own client data. */
function challengeFromResponse(clientDataJSON: string) {
  const parsed = JSON.parse(Buffer.from(clientDataJSON, "base64url").toString()) as {
    challenge?: string;
  };
  return parsed.challenge ?? "";
}

export async function startPasskeyRegistration(staff: { id: string; name: string; email: string }) {
  const rp = passkeyRelyingParty();
  const existing = await queryPostgres<{ id: string }>(
    STORE,
    `SELECT id FROM admin_passkeys WHERE staff_id = $1`,
    [staff.id],
  );

  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userName: staff.email,
    userDisplayName: staff.name,
    // Stops one phone being registered twice, which would leave the owner with
    // identical entries and no way to tell which to remove.
    excludeCredentials: existing.map((row) => ({ id: row.id })),
    authenticatorSelection: {
      residentKey: "preferred",
      // Required, not "preferred". A passkey that unlocks without a fingerprint
      // or PIN is only a longer password, and a shared counter computer would
      // then hand the shop to whoever sits down at it.
      userVerification: "required",
    },
  });

  await rememberChallenge(options.challenge, "register", staff.id);
  return options;
}

export async function finishPasskeyRegistration(
  staffId: string,
  response: RegistrationResponseJSON,
  label: string,
) {
  const rp = passkeyRelyingParty();
  // The value verified against is the one we stored, never the one the browser
  // sent — its copy is only how we find ours.
  const stored = await consumeChallenge(
    challengeFromResponse(response.response.clientDataJSON),
    "register",
  );

  if (!stored || stored.staff_id !== staffId) {
    return { ok: false as const, reason: "यो अनुरोध बासी भयो — फेरि प्रयास गर्नुहोस्।" };
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false as const, reason: "यो यन्त्र दर्ता गर्न सकिएन।" };
  }

  const info = verification.registrationInfo;
  await queryPostgres(
    STORE,
    `INSERT INTO admin_passkeys
       (id, staff_id, public_key, counter, label, device_type, backed_up, transports)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [
      info.credential.id,
      staffId,
      Buffer.from(info.credential.publicKey).toString("base64url"),
      String(info.credential.counter),
      label.slice(0, 60),
      info.credentialDeviceType,
      info.credentialBackedUp,
      (info.credential.transports ?? []).join(","),
    ],
  );

  return { ok: true as const };
}

export async function startPasskeyLogin() {
  const rp = passkeyRelyingParty();
  const options = await generateAuthenticationOptions({
    rpID: rp.id,
    userVerification: "required",
    // No allowCredentials: the browser offers whichever passkey it holds for
    // this site, so nobody has to type an email before their fingerprint works.
  });

  await rememberChallenge(options.challenge, "login");
  return options;
}

/**
 * Verifies a sign-in and reports whose it was.
 *
 * Returns a staff id rather than a session, so creating the session stays the
 * login action's job and a passkey sign-in goes through exactly the same
 * bookkeeping as a password one: the same audit entry, the same new-device
 * alert, the same session record.
 */
export async function finishPasskeyLogin(response: AuthenticationResponseJSON) {
  const rp = passkeyRelyingParty();
  const stored = await consumeChallenge(
    challengeFromResponse(response.response.clientDataJSON),
    "login",
  );

  if (!stored) return { ok: false as const, reason: "यो अनुरोध बासी भयो — फेरि प्रयास गर्नुहोस्।" };

  const rows = await queryPostgres<PasskeyRow>(
    STORE,
    `SELECT id, staff_id, public_key, counter, label, device_type, backed_up, transports,
            created_at, last_used_at
       FROM admin_passkeys WHERE id = $1`,
    [response.id],
  );
  const credential = rows[0];
  if (!credential) return { ok: false as const, reason: "यो यन्त्र दर्ता छैन।" };

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.id,
    requireUserVerification: true,
    credential: {
      id: credential.id,
      publicKey: Buffer.from(credential.public_key, "base64url"),
      counter: Number(credential.counter),
      transports: credential.transports
        ? (credential.transports.split(",") as never)
        : undefined,
    },
  });

  if (!verification.verified) return { ok: false as const, reason: "पहिचान मिलेन।" };

  // A counter that fails to advance means the credential was cloned — the one
  // attack a password cannot even detect. Recorded rather than refused, because
  // some authenticators legitimately leave it at zero and refusing would lock
  // out honest devices.
  await queryPostgres(
    STORE,
    `UPDATE admin_passkeys SET counter = $2, last_used_at = now() WHERE id = $1`,
    [credential.id, String(verification.authenticationInfo.newCounter)],
  );

  return { ok: true as const, staffId: credential.staff_id, label: credential.label };
}
