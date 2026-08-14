import type { Metadata } from "next";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import { adminRoles, getAdminPermissionSummary, requireAdminPermission } from "@/lib/admin-permissions";
import {
  companyBranchStatuses,
  companyBranchTypes,
  getAdminSettings,
} from "@/lib/admin-settings";
import {
  createBranchAction,
  saveCompanySettingsAction,
} from "./actions";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import StaffAccessManager from "@/components/admin/StaffAccessManager";
import { getHrData } from "@/lib/hr";
import { listFactoryWorkerOptions } from "@/lib/factory-worker-portal";
import { getAdminStaffAccessHistory } from "@/lib/admin-staff-security";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Settings | KRISHOE",
  description: "Company, branch, staff, and admin role settings.",
};

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="h-11 rounded-lg border border-gray-200 px-3 text-sm font-normal outline-none focus:border-brand-green"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: readonly string[] | Array<{ value: string; label: string }>;
}) {
  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );

  return (
    <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="h-11 rounded-lg border border-gray-200 px-3 text-sm font-normal outline-none focus:border-brand-green"
      >
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Wraps the shared FormSubmitButton so every settings form that used the old
// local button now disables on submit and shows "Saving…" for free.
function SubmitButton({ label }: { label: string }) {
  return (
    <FormSubmitButton className="rounded-lg bg-brand-green px-4 py-2 text-sm font-black text-white transition hover:bg-[#08392C]">
      {label}
    </FormSubmitButton>
  );
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  const { role } = await requireAdminPermission("settings:write");
  const [settings, hrData, accessHistory, factoryWorkers] = await Promise.all([
    getAdminSettings(),
    getHrData(),
    getAdminStaffAccessHistory(undefined, 40),
    listFactoryWorkerOptions(),
  ]);
  const notice = await searchParams;
  const activeBranches = settings.branches.filter((branch) => branch.status === "Active");
  const activeStaff = settings.staff.filter((staff) => staff.status === "Active");
  const branchOptions = settings.branches.map((branch) => ({
    value: branch.id,
    label: `${branch.name} (${branch.code})`,
  }));
  const permissionMap = Object.fromEntries(
    adminRoles.map((adminRole) => [
      adminRole,
      getAdminPermissionSummary(adminRole).permissions
        .filter((entry) => entry.allowed)
        .map((entry) => entry.permission),
    ]),
  ) as Record<(typeof adminRoles)[number], string[]>;

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
            Access control
          </p>
          <h1 className="mt-2 text-2xl font-black text-brand-green-ink">Company and staff settings</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Manage branch identity, staff login accounts, and role-based admin access for the
            factory, shop, POS, inventory, HR, and reports modules.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm">
          <p className="font-black text-emerald-950">{role}</p>
          <p className="text-xs font-semibold text-emerald-700">current permission role</p>
        </div>
      </div>

      {notice?.success ? (
        <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          {notice.success}
        </div>
      ) : null}
      {notice?.error ? (
        <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {notice.error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">Company</p>
          <p className="mt-2 text-2xl font-black text-brand-green-ink">{settings.company.companyName}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            Updated {settings.company.updatedAt ? <DateDisplayAdmin date={settings.company.updatedAt} time={true} /> : "Never"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">Active branches</p>
          <p className="mt-2 text-2xl font-black text-brand-green-ink">{activeBranches.length}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            {settings.branches.length} total branch records
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">Active staff</p>
          <p className="mt-2 text-2xl font-black text-brand-green-ink">{activeStaff.length}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            {settings.staff.length} staff login accounts
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <form action={saveCompanySettingsAction} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-black text-brand-green-ink">Company profile</h2>
            <p className="mt-1 text-sm text-gray-500">Used for billing identity, SEO, reports, and branch defaults.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company name" name="companyName" defaultValue={settings.company.companyName} required />
            <Field label="Legal name" name="legalName" defaultValue={settings.company.legalName} required />
            <Field label="Phone" name="phone" defaultValue={settings.company.phone} />
            <Field label="Email" name="email" type="email" defaultValue={settings.company.email} />
            <Field label="PAN / VAT number" name="panVatNumber" defaultValue={settings.company.panVatNumber} />
            <Field label="Currency" name="currency" defaultValue={settings.company.currency} required />
            <Field label="Timezone" name="timezone" defaultValue={settings.company.timezone} required />
            <SelectField
              label="Default branch"
              name="defaultBranchId"
              value={settings.company.defaultBranchId}
              options={branchOptions}
            />
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink md:col-span-2">
              Address
              <textarea
                name="address"
                defaultValue={settings.company.address}
                rows={3}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal outline-none focus:border-brand-green"
              />
            </label>
          </div>
          <div className="mt-5">
            <SubmitButton label="Save company settings" />
          </div>
        </form>

        <form action={createBranchAction} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-black text-brand-green-ink">Add branch</h2>
            <p className="mt-1 text-sm text-gray-500">Create factory, wholesale, retail, online, or office branch records.</p>
          </div>
          <div className="grid gap-4">
            <Field label="Branch name" name="name" placeholder="Main Factory" required />
            <Field label="Branch code" name="code" placeholder="FACTORY" required />
            <SelectField label="Type" name="type" value="Retail" options={companyBranchTypes} />
            <SelectField label="Status" name="status" value="Active" options={companyBranchStatuses} />
            <Field label="Phone" name="phone" />
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
              Address
              <textarea
                name="address"
                rows={3}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal outline-none focus:border-brand-green"
              />
            </label>
          </div>
          <div className="mt-5">
            <SubmitButton label="Create branch" />
          </div>
        </form>
      </div>

      <StaffAccessManager
        staff={settings.staff}
        branches={settings.branches.map(({ id, name, code }) => ({ id, name, code }))}
        employees={hrData.employees.map(({ id, name, department, status }) => ({ id, name, department, status }))}
        factoryWorkers={factoryWorkers}
        permissionMap={permissionMap}
        defaultBranchId={settings.company.defaultBranchId}
      />

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Immutable security trail</p>
          <h2 className="mt-2 text-xl font-black text-brand-green-ink">Recent staff access changes</h2>
          <p className="mt-1 text-sm text-gray-600">Every sensitive change records the actor, time, device and safe before/after values.</p>
        </div>
        <div className="mt-5 grid gap-3">
          {accessHistory.map((entry) => {
            const member = settings.staff.find((staff) => staff.id === entry.staffId);
            return (
              <details key={entry.id} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-black text-brand-green-ink">{entry.action.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs text-gray-500">{member?.name ?? entry.staffId} · by {entry.actorEmail || entry.actorRole || "System"}</p>
                    </div>
                    <time className="text-xs font-semibold text-gray-500">{entry.createdAt ? <DateDisplayAdmin date={entry.createdAt} time={true} /> : "Never"}</time>
                  </div>
                </summary>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-xs font-black uppercase text-gray-500">Before</p><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-gray-700">{JSON.stringify(entry.beforeState, null, 2)}</pre></div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"><p className="text-xs font-black uppercase text-emerald-700">After</p><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-emerald-900">{JSON.stringify(entry.afterState, null, 2)}</pre></div>
                </div>
                <p className="mt-3 text-[11px] text-gray-500">IP {entry.ipAddress || "not available"} · {entry.userAgent ? entry.userAgent.slice(0, 100) : "device not available"}</p>
              </details>
            );
          })}
          {accessHistory.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm font-semibold text-gray-500">No staff access changes recorded yet.</p> : null}
        </div>
      </section>
    </section>
  );
}
