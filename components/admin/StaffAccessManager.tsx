"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import {
  inviteStaffAccountAction,
  resendStaffInvitationAction,
  sendStaffPasswordResetAction,
  setStaffTemporaryPasswordAction,
  updateStaffAccessAction,
  updateStaffMfaAction,
  updateStaffStatusAction,
} from "@/app/admin/settings/actions";
import ConfirmSubmitButton from "@/app/admin/settings/ConfirmSubmitButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { adminRoles, type AdminRole } from "@/lib/admin-role-permissions";
import type { SafeAdminStaffAccount } from "@/lib/admin-settings";
import { formatStaffPhone, staffSignInLabel } from "@/lib/staff-phone";
import { formatAdminDate } from "@/lib/format-date";

type BranchOption = { id: string; name: string; code: string };
/** A factory worker a Worker sign-in can be attached to. */
type FactoryWorkerOption = { id: string; name: string; category: string };

const inputClass = "min-h-11 w-full rounded-xl border border-brand-green-line bg-brand-paper px-3 text-sm outline-none focus:border-brand-green";
const buttonClass = "min-h-11 rounded-xl bg-brand-green px-4 text-sm font-black text-white transition hover:bg-[#08392C] disabled:opacity-60";
const neutralButtonClass = "min-h-11 rounded-xl border border-brand-green-line px-4 text-sm font-black text-brand-green-ink transition hover:border-brand-green";
const dangerButtonClass = "min-h-11 rounded-xl border border-red-200 px-4 text-sm font-black text-red-700 transition hover:bg-red-50";

function displayDate(value?: string) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatAdminDate(date, { time: true });
}

function permissionLabel(permission: string) {
  const [moduleName, action] = permission.split(":");
  return `${moduleName.replaceAll("-", " ")} · ${action}`;
}

function statusTone(status: SafeAdminStaffAccount["status"]) {
  if (status === "Active") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "Invited") return "border-brand-green-line bg-brand-green-wash text-brand-green";
  if (status === "Locked") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-700";
}

export default function StaffAccessManager({
  staff,
  branches,
  factoryWorkers,
  permissionMap,
  defaultBranchId,
}: {
  staff: SafeAdminStaffAccount[];
  branches: BranchOption[];
  factoryWorkers: FactoryWorkerOption[];
  permissionMap: Record<AdminRole, string[]>;
  defaultBranchId: string;
}) {
  const { text } = useLanguage();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredStaff = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return staff.filter((member) => {
      const matchesQuery = !needle || [member.name, member.email, member.phone, member.id, member.employeeId ?? ""]
        .some((value) => value.toLowerCase().includes(needle));
      return matchesQuery
        && (roleFilter === "All" || member.role === roleFilter)
        && (statusFilter === "All" || member.status === statusFilter);
    });
  }, [query, roleFilter, staff, statusFilter]);

  return (
    <div className="mt-8 grid gap-6">
      <section className="rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Secure onboarding</p>
            <h2 className="mt-2 text-xl font-black text-brand-green-ink">Invite a staff member</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
              <span className="font-black text-brand-green-ink">With an email:</span> KRISHOE sends a
              one-time link and the Owner never sees or types the password.{" "}
              <span className="font-black text-brand-green-ink">With a mobile number only</span> —
              the usual case for a factory worker — set a temporary password below and tell them in
              person. They must change it the moment they sign in.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">48-hour link</span>
        </div>
        <form action={inviteStaffAccountAction} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">Name<input name="name" required autoComplete="name" className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            Email <span className="font-normal text-brand-muted">(or leave empty)</span>
            <input name="email" type="email" autoComplete="email" className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            {text("Mobile number", "मोबाइल नम्बर")}
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="98XXXXXXXX"
              className={inputClass}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            Temporary password
            <input
              name="temporaryPassword"
              type="text"
              minLength={8}
              autoComplete="off"
              placeholder="Needed only when there is no email"
              className={inputClass}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            Factory worker (for a Worker sign-in)
            <select name="factoryWorkerId" defaultValue="" className={inputClass}>
              <option value="">Not a factory worker</option>
              {factoryWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} · {worker.category}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">Role<select name="role" defaultValue="Viewer" className={inputClass}>{adminRoles.map((role) => <option key={role}>{role}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">Branch<select name="branchId" defaultValue={defaultBranchId} className={inputClass}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>)}</select></label>
          <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-brand-green-line px-3 text-sm font-bold text-brand-green-ink">
            <input type="checkbox" name="mfaEnabled" className="h-5 w-5 accent-brand-green" />
            Require email 2-step verification
          </label>
          <div className="md:col-span-2 xl:col-span-3">
            <FormSubmitButton className={buttonClass} pendingLabel="Sending invitation…">Send secure invitation</FormSubmitButton>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-brand-green-ink">Staff accounts</h2>
            <p className="mt-1 text-sm text-brand-muted">Role, branch, worker, device security and account status in one place.</p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or ID" className={inputClass} aria-label="Search staff" />
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={inputClass} aria-label="Filter role"><option>All</option>{adminRoles.map((role) => <option key={role}>{role}</option>)}</select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass} aria-label="Filter status"><option>All</option><option>Invited</option><option>Active</option><option>Locked</option><option>Disabled</option></select>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {filteredStaff.map((member) => {
            const branch = branches.find((item) => item.id === member.branchId);
            const permissions = permissionMap[member.role] ?? [];
            return (
              <article key={member.id} className="rounded-2xl border border-brand-green-line bg-brand-paper-deep/40 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-brand-green-ink">{member.name}</h3>
                    <p className="truncate text-sm text-brand-muted">{staffSignInLabel(member) || "No sign-in identity"}</p>
                    {member.email && member.phone ? (
                      <p className="truncate text-xs text-brand-muted">{formatStaffPhone(member.phone)}</p>
                    ) : null}
                    <p className="mt-1 font-mono text-[11px] text-brand-muted-soft">{member.id}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(member.status)}`}>{member.status}</span>
                </div>

                <div className="mt-4 grid gap-2 rounded-xl border border-brand-green-line bg-brand-paper p-3 text-xs text-brand-muted sm:grid-cols-2">
                  <p><span className="font-black text-brand-green-ink">Branch:</span> {branch?.name ?? member.branchId}</p>
                  <p><span className="font-black text-brand-green-ink">Last login:</span> {displayDate(member.lastLoginAt)}</p>
                  <p><span className="font-black text-brand-green-ink">Password changed:</span> {displayDate(member.passwordChangedAt)}</p>
                  <p><span className="font-black text-brand-green-ink">Last device:</span> {member.lastLoginUserAgent ? member.lastLoginUserAgent.slice(0, 45) : "Never"}</p>
                  <p><span className="font-black text-brand-green-ink">Failed logins:</span> {member.failedLoginCount}</p>
                </div>

                <form action={updateStaffAccessAction} className="mt-4 grid gap-3 sm:grid-cols-3">
                  <input type="hidden" name="id" value={member.id} />
                  <label className="grid gap-1 text-xs font-black text-brand-green-ink">Role<select name="role" defaultValue={member.role} className={inputClass}>{adminRoles.map((role) => <option key={role}>{role}</option>)}</select></label>
                  <label className="grid gap-1 text-xs font-black text-brand-green-ink">Branch<select name="branchId" defaultValue={member.branchId} className={inputClass}>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                  <label className="grid gap-1 text-xs font-black text-brand-green-ink">
                    Factory worker
                    <select name="factoryWorkerId" defaultValue={member.factoryWorkerId ?? ""} className={inputClass}>
                      <option value="">Not linked</option>
                      {factoryWorkers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="sm:col-span-3"><FormSubmitButton className={buttonClass} pendingLabel="Saving access…">Save access</FormSubmitButton></div>
                </form>

                <details className="mt-4 rounded-xl border border-brand-green-line bg-brand-paper p-3">
                  <summary className="cursor-pointer text-sm font-black text-brand-green-ink">Permission preview · {permissions.length} allowed</summary>
                  <div className="mt-3 flex flex-wrap gap-2">{permissions.map((permission) => <span key={permission} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">{permissionLabel(permission)}</span>)}</div>
                </details>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {member.status === "Invited" ? (
                    <form action={resendStaffInvitationAction}><input type="hidden" name="id" value={member.id} /><FormSubmitButton className={`${neutralButtonClass} w-full`} pendingLabel="Sending…">Resend invitation</FormSubmitButton></form>
                  ) : member.status === "Active" && member.email ? (
                    <form action={sendStaffPasswordResetAction}><input type="hidden" name="id" value={member.id} /><ConfirmSubmitButton label="Email reset link" message={`Send a one-time password reset link to ${member.email}?`} className={`${neutralButtonClass} w-full`} /></form>
                  ) : null}
                  {/* No inbox, no link to send. The Owner hands over a password
                      instead, and the account is forced to replace it. */}
                  {member.email ? null : (
                    <form action={setStaffTemporaryPasswordAction} className="flex gap-2 sm:col-span-2">
                      <input type="hidden" name="id" value={member.id} />
                      <input
                        name="temporaryPassword"
                        type="text"
                        minLength={8}
                        required
                        autoComplete="off"
                        placeholder="New temporary password (8+)"
                        className={inputClass}
                      />
                      <ConfirmSubmitButton
                        label="Set password"
                        message={`Give ${member.name} a new temporary password? Every device they are signed in on is signed out, and they must change it at the next sign-in.`}
                        className={neutralButtonClass}
                      />
                    </form>
                  )}
                  <form action={updateStaffMfaAction}>
                    <input type="hidden" name="id" value={member.id} />
                    <input type="hidden" name="enabled" value={member.mfaEnabled ? "false" : "true"} />
                    <ConfirmSubmitButton label={member.mfaEnabled ? "Disable 2-step" : "Enable 2-step"} message={`${member.mfaEnabled ? "Disable" : "Enable"} email 2-step verification for ${staffSignInLabel(member)}? This signs out old devices.`} className={`${neutralButtonClass} w-full`} />
                  </form>
                  <form action={updateStaffStatusAction} className="flex gap-2 sm:col-span-2">
                    <input type="hidden" name="id" value={member.id} />
                    <select name="status" defaultValue={member.status} className={inputClass}><option>Invited</option><option>Active</option><option>Locked</option><option>Disabled</option></select>
                    <ConfirmSubmitButton label="Save status" message={`Change status for ${staffSignInLabel(member)}? Disabled or locked accounts are signed out automatically.`} className={member.status === "Active" ? dangerButtonClass : neutralButtonClass} />
                  </form>
                </div>
              </article>
            );
          })}
          {filteredStaff.length === 0 ? <div className="rounded-2xl border border-dashed border-brand-green-line p-8 text-center text-sm font-semibold text-brand-muted xl:col-span-2">No staff account matches these filters.</div> : null}
        </div>
      </section>
    </div>
  );
}
