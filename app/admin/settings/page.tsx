import type { Metadata } from "next";
import { adminRoles, requireAdminPermission } from "@/lib/admin-permissions";
import {
  adminStaffStatuses,
  companyBranchStatuses,
  companyBranchTypes,
  getAdminSettings,
} from "@/lib/admin-settings";
import {
  createBranchAction,
  resetStaffPasswordAction,
  saveCompanySettingsAction,
  saveStaffAccountAction,
  updateStaffAccessAction,
  updateStaffStatusAction,
} from "./actions";
import ConfirmSubmitButton from "./ConfirmSubmitButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Settings | KRISHOE",
  description: "Company, branch, staff, and admin role settings.",
};

function formatDate(value?: string) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(value));
}

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

function SubmitButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="rounded-lg bg-brand-green px-4 py-2 text-sm font-black text-white transition hover:bg-[#08392C]"
    >
      {label}
    </button>
  );
}

const compactInputClass =
  "h-9 rounded-lg border border-gray-200 px-2 text-xs font-normal outline-none focus:border-brand-green";
const compactSelectClass =
  "h-9 rounded-lg border border-gray-200 px-2 text-xs font-semibold outline-none focus:border-brand-green";
const compactSaveButtonClass =
  "h-9 rounded-lg bg-brand-green px-3 text-xs font-black text-white transition hover:bg-[#08392C]";
const compactNeutralButtonClass =
  "h-9 rounded-lg border border-gray-200 px-3 text-xs font-black text-brand-green-ink transition hover:border-brand-green hover:text-brand-green";
const compactDangerButtonClass =
  "h-9 rounded-lg border border-red-200 px-3 text-xs font-black text-red-700 transition hover:bg-red-50";
const compactWarnButtonClass =
  "h-9 rounded-lg border border-amber-200 px-3 text-xs font-black text-amber-700 transition hover:bg-amber-50";

export default async function AdminSettingsPage() {
  const { role } = await requireAdminPermission("settings:write");
  const settings = await getAdminSettings();
  const activeBranches = settings.branches.filter((branch) => branch.status === "Active");
  const activeStaff = settings.staff.filter((staff) => staff.status === "Active");
  const branchOptions = settings.branches.map((branch) => ({
    value: branch.id,
    label: `${branch.name} (${branch.code})`,
  }));

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

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">Company</p>
          <p className="mt-2 text-2xl font-black text-brand-green-ink">{settings.company.companyName}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            Updated {formatDate(settings.company.updatedAt)}
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

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <form action={saveStaffAccountAction} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-black text-brand-green-ink">Create or update staff</h2>
            <p className="mt-1 text-sm text-gray-500">
              Use an existing email to update role, branch, status, or password.
            </p>
          </div>
          <div className="grid gap-4">
            <Field label="Name" name="name" placeholder="Owner Name" required />
            <Field label="Email" name="email" type="email" placeholder="owner@krishoe.com" required />
            <Field label="Password" name="password" type="password" placeholder="Required for new staff" />
            <SelectField label="Role" name="role" value="Viewer" options={adminRoles} />
            <SelectField
              label="Branch"
              name="branchId"
              value={settings.company.defaultBranchId}
              options={branchOptions}
            />
            <SelectField label="Status" name="status" value="Active" options={adminStaffStatuses} />
          </div>
          <div className="mt-5">
            <SubmitButton label="Save staff account" />
          </div>
        </form>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-black text-brand-green-ink">Staff accounts</h2>
            <p className="mt-1 text-sm text-gray-500">Password hashes are stored server-side and never shown here.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Staff</th>
                  <th className="py-2 pr-3">Access</th>
                  <th className="py-2 pr-3">Password</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Last login</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {settings.staff.map((staff) => {
                  const branch = settings.branches.find((item) => item.id === staff.branchId);

                  return (
                    <tr key={staff.id}>
                      <td className="py-3 pr-3">
                        <p className="font-black text-brand-green-ink">{staff.name}</p>
                        <p className="text-xs text-gray-500">{staff.email}</p>
                        <p className="mt-1 font-mono text-[11px] text-gray-400">{staff.id}</p>
                      </td>
                      <td className="min-w-[380px] py-3 pr-3">
                        <form action={updateStaffAccessAction} className="grid gap-2 md:grid-cols-[130px_170px_auto]">
                          <input type="hidden" name="id" value={staff.id} />
                          <select name="role" defaultValue={staff.role} className={compactSelectClass}>
                            {adminRoles.map((adminRole) => (
                              <option key={adminRole} value={adminRole}>
                                {adminRole}
                              </option>
                            ))}
                          </select>
                          <select name="branchId" defaultValue={staff.branchId} className={compactSelectClass}>
                            {branchOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className={compactSaveButtonClass}>
                            Save access
                          </button>
                        </form>
                        <p className="mt-2 text-xs text-gray-500">
                          Current branch: {branch?.name ?? staff.branchId}
                        </p>
                      </td>
                      <td className="min-w-[300px] py-3 pr-3">
                        <form action={resetStaffPasswordAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={staff.id} />
                          <input
                            name="password"
                            type="password"
                            minLength={8}
                            required
                            placeholder="New password"
                            className={compactInputClass}
                          />
                          <ConfirmSubmitButton
                            label="Reset"
                            message={`Reset password for ${staff.email}?`}
                            className={compactWarnButtonClass}
                          />
                        </form>
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-full border px-2 py-1 text-xs font-black ${
                          staff.status === "Active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-gray-200 bg-gray-50 text-gray-600"
                        }`}>
                          {staff.status}
                        </span>
                        <form action={updateStaffStatusAction} className="mt-2">
                          <input type="hidden" name="id" value={staff.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={staff.status === "Active" ? "Disabled" : "Active"}
                          />
                          {staff.status === "Active" ? (
                            <ConfirmSubmitButton
                              label="Disable"
                              message={`Disable login for ${staff.email}?`}
                              className={compactDangerButtonClass}
                            />
                          ) : (
                            <button type="submit" className={compactNeutralButtonClass}>
                              Enable
                            </button>
                          )}
                        </form>
                      </td>
                      <td className="py-3 pr-3 text-xs text-gray-500">{formatDate(staff.lastLoginAt)}</td>
                    </tr>
                  );
                })}
                {settings.staff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm font-semibold text-gray-500">
                      No staff login accounts yet. Create the first Owner account before production.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
