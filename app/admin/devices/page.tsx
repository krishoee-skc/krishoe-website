import PasskeyManager from "@/components/admin/PasskeyManager";
import type { Metadata } from "next";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getAdminSettings } from "@/lib/admin-settings";
import { listAdminStaffSessions } from "@/lib/admin-staff-security";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import { revokeAllDeviceSessionsAction, revokeDeviceSessionAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Login Devices | KRISHOE Admin" };

export default async function AdminDevicesPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string }>;
}) {
  const { session, role } = await requireAdminPermission("devices:read");
  const settings = await getAdminSettings();
  const sessions = await listAdminStaffSessions(role === "Owner" ? undefined : session.staffId);
  const activeSessions = sessions.filter((entry) => entry.active);
  const success = (await searchParams)?.success?.trim();
  const staffById = new Map(settings.staff.map((member) => [member.id, member]));
  const activeStaffIds = [...new Set(activeSessions.map((entry) => entry.staffId))];

  return (
    <section className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Account security</p>
          <h1 className="mt-2 text-2xl font-black text-brand-green-ink">Login devices</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
            Review active phones and computers. Password, role, branch, MFA, disable, and lock changes automatically close old sessions; the Owner can also sign out any device manually.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm">
          <span className="text-2xl font-black text-emerald-800">{activeSessions.length}</span>
          <span className="ml-2 font-bold text-emerald-700">active</span>
        </div>
      </div>

      {success ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800" role="status">
          {success}
        </div>
      ) : null}

      {/* Passkeys live beside the sessions rather than in Settings: this is the
          page someone opens when they are thinking about which devices can get
          in, and removing a lost phone's key belongs in the same breath as
          ending its session. */}
      <div className="mt-6">
        <PasskeyManager />
      </div>

      {role === "Owner" && activeStaffIds.length ? (
        <section className="mt-6 rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
          <h2 className="font-black text-brand-green-ink">Owner controls</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeStaffIds.map((staffId) => {
              const staff = staffById.get(staffId);
              return (
                <form key={staffId} action={revokeAllDeviceSessionsAction}>
                  <input type="hidden" name="staffId" value={staffId} />
                  <button className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-black text-red-700 hover:bg-red-50">
                    Logout all: {staff?.name ?? staffId}
                  </button>
                </form>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {sessions.map((entry) => {
          const staff = staffById.get(entry.staffId);
          const active = entry.active;
          const current = entry.id === session.sessionId;
          return (
            <article key={entry.id} className="rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-black text-brand-green-ink">{entry.deviceLabel}</h2>
                  <p className="mt-1 text-xs font-semibold text-brand-muted">{staff?.name ?? entry.staffId}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${active ? "bg-emerald-50 text-emerald-800" : "bg-brand-mist text-brand-muted"}`}>
                  {current && active ? "Current" : active ? "Active" : entry.revokedAt ? "Logged out" : "Expired"}
                </span>
              </div>
              <dl className="mt-4 grid gap-2 text-xs text-brand-muted">
                <div className="flex justify-between gap-3"><dt className="font-bold">Last active</dt><dd><DateDisplayAdmin date={entry.lastSeenAt} time={true} /></dd></div>
                <div className="flex justify-between gap-3"><dt className="font-bold">Signed in</dt><dd><DateDisplayAdmin date={entry.createdAt} time={true} /></dd></div>
                <div className="flex justify-between gap-3"><dt className="font-bold">IP</dt><dd className="font-mono">{entry.ipAddress || "Not available"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-bold">2-step</dt><dd>{entry.mfaVerified ? "Verified" : "Not enabled"}</dd></div>
              </dl>
              {active ? (
                <form action={revokeDeviceSessionAction} className="mt-5">
                  <input type="hidden" name="sessionId" value={entry.id} />
                  <button className="min-h-11 w-full rounded-xl border border-red-200 text-sm font-black text-red-700 hover:bg-red-50">
                    {current ? "Sign out this device" : "Sign out device"}
                  </button>
                </form>
              ) : null}
            </article>
          );
        })}
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-brand-green-line bg-brand-paper p-8 text-center text-sm font-semibold text-brand-muted md:col-span-2">
            No registered staff login devices yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}
