import PasskeyManager from "@/components/admin/PasskeyManager";
import type { Metadata } from "next";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getAdminSettings } from "@/lib/admin-settings";
import { listAdminStaffSessions } from "@/lib/admin-staff-security";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import T from "@/components/T";
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
  // The ones still able to get in come first — this device at the top — and
  // the ended ones fold away below. Every login ever made sat in one list, so
  // fifteen live ones were lost among thirty-odd logged out and expired
  // (owner, 2026-09-30). Nothing is deleted: the folded list is the history.
  const liveSessions = [...activeSessions].sort(
    (left, right) => Number(right.id === session.sessionId) - Number(left.id === session.sessionId),
  );
  const endedSessions = sessions.filter((entry) => !entry.active);
  const success = (await searchParams)?.success?.trim();
  const staffById = new Map(settings.staff.map((member) => [member.id, member]));
  const activeStaffIds = [...new Set(activeSessions.map((entry) => entry.staffId))];

  return (
    <section className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Account security</p>
          <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink">Login devices</h1>
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

      <h2 className="mt-6 text-lg font-black text-brand-green-ink">
        <T en={`Signed in now (${liveSessions.length})`} ne={`अहिले चालु login (${liveSessions.length})`} />
      </h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {liveSessions.map((entry) => {
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
        {liveSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-brand-green-line bg-brand-paper p-8 text-center text-sm font-semibold text-brand-muted md:col-span-2">
            <T en="No device is signed in." ne="कुनै यन्त्र sign in भएको छैन।" />
          </div>
        ) : null}
      </div>

      {endedSessions.length > 0 ? (
        <details className="mt-6 rounded-2xl border border-brand-green-line bg-brand-paper-deep p-4">
          <summary className="cursor-pointer text-base font-black text-brand-muted">
            <T
              en={`Old logins (${endedSessions.length}) — logged out or expired, press to see`}
              ne={`पुराना login (${endedSessions.length}) — बन्द वा समय सकिएका, थिचेर हेर्ने`}
            />
          </summary>
          <p className="mt-2 text-sm text-brand-muted">
            <T
              en="These can no longer get in. They are kept as a record of who signed in, from where and when."
              ne="यिनबाट अब कोही छिर्न सक्दैन। कसले, कहाँबाट र कहिले sign in गर्‍यो भन्ने रेकर्डका लागि मात्र राखिएका हुन्।"
            />
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {endedSessions.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-brand-green-line bg-brand-paper p-4 text-xs text-brand-muted">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-brand-green-ink">{entry.deviceLabel}</p>
                    <p className="mt-0.5 font-semibold">{staffById.get(entry.staffId)?.name ?? entry.staffId}</p>
                  </div>
                  <span className="rounded-full bg-brand-mist px-2.5 py-1 font-black">
                    {entry.revokedAt ? <T en="Logged out" ne="बन्द गरिएको" /> : <T en="Expired" ne="समय सकिएको" />}
                  </span>
                </div>
                <dl className="mt-3 grid gap-1.5">
                  <div className="flex justify-between gap-3"><dt className="font-bold"><T en="Signed in" ne="Sign in" /></dt><dd><DateDisplayAdmin date={entry.createdAt} time={true} /></dd></div>
                  <div className="flex justify-between gap-3"><dt className="font-bold"><T en="Last active" ne="पछिल्लो पटक" /></dt><dd><DateDisplayAdmin date={entry.lastSeenAt} time={true} /></dd></div>
                  <div className="flex justify-between gap-3"><dt className="font-bold">IP</dt><dd className="font-mono">{entry.ipAddress || "—"}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
