/**
 * How a sign-in that its own owner logged out of is marked in
 * admin_staff_sessions.revoked_by, so it can still vouch for a trusted device
 * (lib/admin-trusted-device.ts). Any other revoker ends that trust.
 */
export const SELF_LOGOUT = "self-logout";
