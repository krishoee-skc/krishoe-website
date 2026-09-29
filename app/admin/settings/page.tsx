import type { Metadata } from "next";
import Link from "next/link";
import T from "@/components/T";
import { adminSetupGroups } from "@/app/admin/nav-links";
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
  saveBusinessGoalAction,
  saveDeliveryPricingAction,
  prepareDeliveryDatabaseAction,
  preparePosDatabaseAction,
  prepareOrderDispatchDatabaseAction,
  prepareCounterItemsDatabaseAction,
} from "./actions";
import { getBusinessGoal, currentGoalMonthKey } from "@/lib/business-goals";
import { MAX_DELIVERY_ZONES, deliveryPolicySentence } from "@/lib/delivery-fee";
import { getDeliveryPricing } from "@/lib/delivery-settings";
import { deliveryDatabaseStatus } from "@/lib/delivery-database";
import { posDatabaseStatus } from "@/lib/pos-database";
import { orderDispatchDatabaseStatus } from "@/lib/order-dispatch-database";
import { counterItemsDatabaseStatus } from "@/lib/counter-items-database";
import { reportError } from "@/lib/report-error";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import StaffAccessManager from "@/components/admin/StaffAccessManager";
import SettingsSections, { type SettingsSection, type SettingsTodo } from "./SettingsSections";
import { listFactoryWorkerOptions } from "@/lib/factory-worker-portal";
import { getAdminStaffAccessHistory } from "@/lib/admin-staff-security";
import { staffSafetyOverview } from "@/lib/staff-idle";

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
  id,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
      {label}
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="h-11 rounded-lg border border-brand-green-line px-3 text-sm font-normal outline-none focus:border-brand-green"
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
        className="h-11 rounded-lg border border-brand-green-line px-3 text-sm font-normal outline-none focus:border-brand-green"
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

const card = "rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm";
const textBox =
  "min-h-11 rounded-lg border border-brand-green-line px-3 py-2 text-sm font-normal outline-none focus:border-brand-green";

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
  const goalMonthKey = currentGoalMonthKey();
  const [settings, accessHistory, factoryWorkers, businessGoal, deliveryPricing] = await Promise.all([
    getAdminSettings(),
    getAdminStaffAccessHistory(undefined, 40),
    listFactoryWorkerOptions(),
    getBusinessGoal(goalMonthKey),
    getDeliveryPricing(),
  ]);
  // Only asked here, on the Owner's settings page: one small catalog read.
  const deliveryDatabase = await deliveryDatabaseStatus().catch((error) => {
    reportError("check the delivery columns", error);
    return null;
  });
  const orderDispatchDatabase = await orderDispatchDatabaseStatus().catch((error) => {
    reportError("check the order dispatch columns", error);
    return null;
  });
  const counterItemsDatabase = await counterItemsDatabaseStatus().catch((error) => {
    reportError("check the counter items table", error);
    return null;
  });
  const posDatabase = await posDatabaseStatus().catch((error) => {
    reportError("check the bill columns", error);
    return null;
  });
  const notice = await searchParams;
  const staffSafety = await staffSafetyOverview(settings.staff);
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

  const c = settings.company;
  const deliverySet = deliveryPricing.feePaisa > 0 || deliveryPricing.freeOverPaisa > 0 || (deliveryPricing.zones?.length ?? 0) > 0;
  const todos: SettingsTodo[] = [
    { en: "Shop phone", ne: "पसलको फोन", section: "shop", field: "set-phone", done: Boolean(c.phone) },
    { en: "PAN / VAT number", ne: "PAN / VAT नम्बर", section: "shop", field: "set-pan", done: Boolean(c.panVatNumber) },
    { en: "Address", ne: "ठेगाना", section: "shop", field: "set-address", done: Boolean(c.address) },
    { en: "Bill footer note", ne: "बिलको तलको सन्देश", section: "bill", field: "set-footer", done: Boolean(c.billFooterNote) },
    { en: "Bank account", ne: "बैंक खाता", section: "bill", field: "set-bank", done: Boolean(c.bankAccountNumber) },
    { en: "Google review link", ne: "Google review link", section: "bill", field: "set-google", done: Boolean(c.googleReviewUrl) },
    { en: "Shop name", ne: "पसलको नाम", section: "shop", done: Boolean(c.companyName) },
    { en: "Main branch", ne: "मुख्य शाखा", section: "shop", done: Boolean(c.defaultBranchId) },
    { en: "Delivery rule", ne: "डेलिभरी नियम", section: "delivery", done: deliverySet },
  ];
  const missingIn = (section: string) => todos.filter((todo) => todo.section === section && !todo.done).length;

  const shopBody = (
    <form action={saveCompanySettingsAction} className={card}>
      <div className="mb-5">
        <h2 className="text-lg font-black text-brand-green-ink">🏪 <T en="Shop details" ne="पसलको विवरण" /></h2>
        <p className="mt-1 text-sm text-brand-muted"><T en="Printed on bills and shown on the shop." ne="बिलमा छापिने र पसलको website मा देखिने।" /></p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Company name" name="companyName" defaultValue={c.companyName} required />
        <Field label="Legal name" name="legalName" defaultValue={c.legalName} required />
        <Field id="set-phone" label="Phone" name="phone" defaultValue={c.phone} placeholder="98XXXXXXXX" />
        <Field label="Email" name="email" type="email" defaultValue={c.email} />
        <Field id="set-pan" label="PAN / VAT number" name="panVatNumber" defaultValue={c.panVatNumber} />
        <SelectField label="Default branch" name="defaultBranchId" value={c.defaultBranchId} options={branchOptions} />
        <label className="grid gap-2 text-sm font-bold text-brand-green-ink md:col-span-2">
          Address
          <textarea id="set-address" name="address" defaultValue={c.address} rows={3} className={textBox} />
        </label>
      </div>
      {/* Set once and never changed, so read rather than offered as boxes;
          the values still travel with every save. */}
      <p className="mt-4 text-xs font-semibold text-brand-muted">
        <T en={`Currency ${c.currency} · Time ${c.timezone}`} ne={`मुद्रा ${c.currency} · समय ${c.timezone}`} />
      </p>
      <p className="mt-1 text-xs text-brand-muted">
        <T en="Last saved" ne="पछिल्लो पटक सेभ" />: {c.updatedAt ? <DateDisplayAdmin date={c.updatedAt} time={true} /> : "—"}
      </p>
      <div className="mt-5"><SubmitButton label="Save shop details" /></div>
    </form>
  );

  const billBody = (
    <>
      {/* The line printed at the foot of every POS bill: the return window
          belongs on the paper the customer still has three days later. Blank
          prints nothing. */}
      <form action={saveCompanySettingsAction} className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">🧾 <T en="Bill" ne="बिल" /></h2>
        <label className="mt-4 grid gap-2 text-sm font-bold text-brand-green-ink">
          Bill footer note
          <input
            id="set-footer"
            name="billFooterNote"
            defaultValue={settings.company.billFooterNote}
            maxLength={200}
            placeholder="e.g. Exchange or return within 7 days — unworn, with tags and box"
            className={textBox}
          />
          <span className="text-xs font-semibold text-brand-muted">
            Printed at the foot of every bill, above the shop&apos;s phone and web
            address. Leave blank to print nothing.
          </span>
        </label>
        <div className="mt-5"><SubmitButton label="Save bill note" /></div>
      </form>

      {/* Bank details for customer transfers. The account number is what makes
          the panel useful, so leaving it blank hides the whole bank panel at
          checkout. Cash on delivery is unaffected either way. */}
      <form action={saveCompanySettingsAction} className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">🏦 <T en="Bank for customer payments" ne="ग्राहकले पैसा पठाउने बैंक" /></h2>
        <p className="mt-1 text-xs font-semibold text-brand-muted">
          Shown on checkout for bank transfer / QR. Leave the account number blank and the bank
          panel is hidden completely — customers then see only Cash on delivery and the other options.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            Bank name
            <input name="bankName" defaultValue={c.bankName} maxLength={120} placeholder="e.g. Nabil Bank Ltd." className={textBox} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            Account name
            <input name="bankAccountName" defaultValue={c.bankAccountName} maxLength={120} placeholder="The name on the account" className={textBox} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            Account number
            <input id="set-bank" name="bankAccountNumber" inputMode="numeric" defaultValue={c.bankAccountNumber} maxLength={40} placeholder="Digits only (leave blank to hide the bank panel)" className={textBox} />
            <span className="text-xs font-semibold text-brand-muted">
              Check this digit by digit — a customer types it into their banking app.
            </span>
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            Branch
            <input name="bankBranch" defaultValue={c.bankBranch} maxLength={120} placeholder="e.g. Narayangadh, Chitwan" className={textBox} />
          </label>
        </div>
        <div className="mt-5"><SubmitButton label="Save bank details" /></div>
      </form>

      {/* Public review links, and the line across the top of the shop. */}
      <form action={saveCompanySettingsAction} className={card}>
        <input type="hidden" name="promoEnabledShown" value="1" />
        <h2 className="text-lg font-black text-brand-green-ink">⭐ <T en="Reviews and the shop's top line" ne="Review र पसलको माथिको सन्देश" /></h2>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            Google review link
            <input id="set-google" name="googleReviewUrl" type="url" defaultValue={c.googleReviewUrl} maxLength={400} placeholder="From Google Business, e.g. https://g.page/r/… (leave blank to skip)" className={textBox} />
            <span className="text-xs font-semibold text-brand-muted">
              On Google, search your shop → your business profile → &ldquo;Ask for reviews&rdquo; → copy the link.
            </span>
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            Facebook review link
            <input name="facebookReviewUrl" type="url" defaultValue={c.facebookReviewUrl} maxLength={400} placeholder="https://www.facebook.com/krishoe.np/reviews (leave blank to skip)" className={textBox} />
            <span className="text-xs font-semibold text-brand-muted">
              Your KRISHOE Facebook page address with /reviews on the end.
            </span>
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            Shop top-bar message
            <input name="promoText" defaultValue={c.promoText} maxLength={160} placeholder="e.g. First order? Use WELCOME10 for 10% off — write it in any language" className={textBox} />
            <span className="flex items-center gap-2 text-xs font-semibold text-brand-muted">
              <input type="checkbox" name="promoEnabled" defaultChecked={c.promoEnabled} className="h-4 w-4 accent-brand-green" />
              Show this message on the shop (off = the built-in line)
            </span>
          </label>
        </div>
        <div className="mt-5"><SubmitButton label="Save reviews and message" /></div>
      </form>
    </>
  );

  const deliveryBody = (
    <>
        <form
          id="delivery"
          action={saveDeliveryPricingAction}
          className={`scroll-mt-24 ${card}`}
        >
          <div className="mb-5">
            <h2 className="text-lg font-black text-brand-green-ink">🚚 Delivery charge</h2>
            <p className="mt-1 text-sm text-brand-muted">
              Customers see this in the header, on the home page and at checkout, and it is added to the
              order total. Store pickup is always free.
            </p>
            <p className="mt-2 rounded-lg bg-brand-mist px-3 py-2 text-sm font-semibold text-brand-green-ink">
              Now: {deliveryPolicySentence(deliveryPricing)}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
              Delivery charge (Rs.)
              <input
                name="deliveryFee"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                defaultValue={deliveryPricing.feePaisa > 0 ? deliveryPricing.feePaisa / 100 : ""}
                placeholder="e.g. 150"
                className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3 text-sm font-normal outline-none focus:border-brand-green"
              />
              <span className="text-xs font-semibold text-brand-muted">
                Leave blank or 0 to confirm the charge on the call, as before.
              </span>
            </label>
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
              Free delivery on orders of (Rs.)
              <input
                name="freeDeliveryOver"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                defaultValue={deliveryPricing.freeOverPaisa > 0 ? deliveryPricing.freeOverPaisa / 100 : ""}
                placeholder="e.g. 2000"
                className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3 text-sm font-normal outline-none focus:border-brand-green"
              />
              <span className="text-xs font-semibold text-brand-muted">
                Orders at or above this amount, after any discount, go free. Blank or 0 = no free delivery
                (unless the charge is also 0, which makes delivery free for everyone).
              </span>
            </label>
          </div>

          {/* Charge by area. With any area named, the customer picks theirs at
              checkout and the single charge above steps aside; the free-delivery
              amount still applies to every area. Blank rows are ignored. */}
          <fieldset className="mt-6 grid gap-3 rounded-lg border border-brand-green-line p-4">
            <legend className="px-1 text-sm font-black text-brand-green-ink">
              <T en="Charge by area (optional)" ne="ठाउँअनुसार शुल्क (चाहे मात्र)" />
            </legend>
            <p className="text-xs font-semibold leading-5 text-brand-muted">
              <T
                en="Name up to 8 areas with their own charge. The customer chooses their area at checkout, and the single charge above is then not used. 0 = free to that area. Leave every row blank to keep one charge for all of Nepal."
                ne="बढीमा ८ ठाउँ र तिनको शुल्क लेख्नुहोस्। ग्राहकले checkout मा आफ्नो ठाउँ रोज्छ, अनि माथिको एउटै शुल्क लाग्दैन। 0 = त्यो ठाउँमा Free। सबै खाली छोडे पूरै नेपालमा एउटै शुल्क रहन्छ।"
              />
            </p>
            <div className="grid gap-2">
              {Array.from({ length: MAX_DELIVERY_ZONES }, (_, index) => {
                const zone = deliveryPricing.zones?.[index];
                // Examples only on an empty list — beside saved areas they read as more rows to fill.
                const example = deliveryPricing.zones?.length
                  ? undefined
                  : [
                      ["Inside Chitwan", "0"],
                      ["Nearby districts", "100"],
                      ["Kathmandu valley", "150"],
                      ["Rest of Nepal", "200"],
                    ][index];
                return (
                  <div key={index} className="grid grid-cols-[1fr_8.5rem] gap-2">
                    <input
                      name={`zoneName${index + 1}`}
                      aria-label={`Area ${index + 1} name`}
                      defaultValue={zone?.name ?? ""}
                      maxLength={40}
                      placeholder={example ? `e.g. ${example[0]}` : "Area name"}
                      className="min-h-11 rounded-lg border border-brand-green-line bg-brand-paper px-3 text-sm outline-none focus:border-brand-green"
                    />
                    <input
                      name={`zoneFee${index + 1}`}
                      aria-label={`Area ${index + 1} charge in rupees`}
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      defaultValue={zone ? zone.feePaisa / 100 : ""}
                      placeholder={example ? `Rs. ${example[1]}` : "Rs."}
                      className="min-h-11 rounded-lg border border-brand-green-line bg-brand-paper px-3 text-sm tabular-nums outline-none focus:border-brand-green"
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5">
            <SubmitButton label="Save delivery charge" />
          </div>
        </form>

    </>
  );

  const goalBody = (
    <>
        <form
          id="goals"
          action={saveBusinessGoalAction}
          className="scroll-mt-24 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm"
        >
          <input type="hidden" name="monthKey" value={goalMonthKey} />
          <div className="mb-5">
            <h2 className="text-lg font-black text-brand-green-ink">🎯 This month's goal ({goalMonthKey})</h2>
            <p className="mt-1 text-sm text-brand-muted">
              Set a monthly sales, profit and production target. The dashboard shows how close you are. Leave any at 0 to skip it.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
              Sales goal (Rs.)
              <input
                name="salesGoal"
                type="number"
                min="0"
                defaultValue={businessGoal.salesGoal || ""}
                placeholder="e.g. 200000"
                className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3 text-sm font-normal outline-none focus:border-brand-green"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
              Profit goal (Rs.)
              <input
                name="profitGoal"
                type="number"
                min="0"
                defaultValue={businessGoal.profitGoal || ""}
                placeholder="e.g. 60000"
                className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3 text-sm font-normal outline-none focus:border-brand-green"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
              Production goal (pairs)
              <input
                name="productionGoal"
                type="number"
                min="0"
                defaultValue={businessGoal.productionGoal || ""}
                placeholder="e.g. 1500"
                className="min-h-12 rounded-lg border border-brand-green-line bg-brand-paper px-3 text-sm font-normal outline-none focus:border-brand-green"
              />
            </label>
          </div>
          <div className="mt-5">
            <SubmitButton label="Save this month's goal" />
          </div>
        </form>

    </>
  );

  const branchBody = (
    <div className={card}>
      <h2 className="text-lg font-black text-brand-green-ink">🏭 <T en="Branches" ne="शाखा" /></h2>
      <ul className="mt-3 grid list-none divide-y divide-brand-green-line pl-0">
        {settings.branches.map((branch) => (
          <li key={branch.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span>
              <b className="text-brand-green-ink">{branch.name}</b>{" "}
              <span className="text-brand-muted">{branch.code} · {branch.type}{branch.id === c.defaultBranchId ? " · main" : ""}</span>
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-black ${branch.status === "Active" ? "bg-emerald-50 text-emerald-800" : "bg-brand-mist text-brand-muted"}`}>{branch.status}</span>
          </li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-black text-brand-green">➕ <T en="Add a branch" ne="नयाँ शाखा थप्ने" /></summary>
        <div className="mt-3">
        <form action={createBranchAction} className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-black text-brand-green-ink">Add branch</h2>
            <p className="mt-1 text-sm text-brand-muted">Create factory, wholesale, retail, online, or office branch records.</p>
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
                className="min-h-11 rounded-lg border border-brand-green-line px-3 py-2 text-sm font-normal outline-none focus:border-brand-green"
              />
            </label>
          </div>
          <div className="mt-5">
            <SubmitButton label="Create branch" />
          </div>
        </form>
        </div>
      </details>
    </div>
  );

  const staffBody = (
    <>
      <StaffAccessManager
        staff={settings.staff}
        safety={staffSafety}
        branches={settings.branches.map(({ id, name, code }) => ({ id, name, code }))}
        factoryWorkers={factoryWorkers}
        permissionMap={permissionMap}
        defaultBranchId={settings.company.defaultBranchId}
      />


      {/* Who changed a staff account, when, from where, before and after.
          It stood as a large section at the foot of the page; it is kept in
          full, folded, beside the accounts it is about. */}
      <details className={card}>
        <summary className="cursor-pointer text-sm font-black text-brand-green">
          🕘 <T en={`Staff access history (${accessHistory.length})`} ne={`कर्मचारीको पहुँच-इतिहास (${accessHistory.length})`} />
        </summary>
        <p className="mt-2 text-sm text-brand-muted">Every sensitive change records the actor, time, device and safe before/after values.</p>
        <div className="mt-5 grid gap-3">
          {accessHistory.map((entry) => {
            const member = settings.staff.find((staff) => staff.id === entry.staffId);
            return (
              <details key={entry.id} className="rounded-xl border border-brand-green-line bg-brand-paper-deep/50 p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-black text-brand-green-ink">{entry.action.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs text-brand-muted">{member?.name ?? entry.staffId} · by {entry.actorEmail || entry.actorRole || "System"}</p>
                    </div>
                    <time className="text-xs font-semibold text-brand-muted">{entry.createdAt ? <DateDisplayAdmin date={entry.createdAt} time={true} /> : "Never"}</time>
                  </div>
                </summary>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-brand-green-line bg-brand-paper p-3"><p className="text-xs font-black uppercase text-brand-muted">Before</p><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-brand-muted-deep">{JSON.stringify(entry.beforeState, null, 2)}</pre></div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"><p className="text-xs font-black uppercase text-emerald-700">After</p><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-emerald-900">{JSON.stringify(entry.afterState, null, 2)}</pre></div>
                </div>
                <p className="mt-3 text-[11px] text-brand-muted">IP {entry.ipAddress || "not available"} · {entry.userAgent ? entry.userAgent.slice(0, 100) : "device not available"}</p>
              </details>
            );
          })}
          {accessHistory.length === 0 ? <p className="rounded-xl border border-dashed border-brand-green-line p-6 text-center text-sm font-semibold text-brand-muted">No staff access changes recorded yet.</p> : null}
        </div>
      </details>
    </>
  );

  // The screens set up once and then not opened again. Nothing is
  // unreachable: they are here, and Search finds them by name.
  const systemBody = (
    <div className={card}>
      <h2 className="text-lg font-black text-brand-green-ink">
        🛠️ <T en="Setup and system" ne="सेटअप र प्रणाली" />
      </h2>
      <p className="mt-1 text-sm leading-6 text-brand-muted">
        <T
          en="The screens you set up once and then never open again — they all live here."
          ne="एकपटक मिलाएपछि फेरि खोल्नु नपर्ने पानाहरू — यहीँ भेटिन्छन्।"
        />
      </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {adminSetupGroups.map((group) => (
            <div key={group.titleEn} className="rounded-2xl border border-brand-green-line bg-brand-paper p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-green">
                <T en={group.titleEn} ne={group.titleNe} />
              </p>
              <ul className="mt-3 grid gap-1">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block rounded-lg px-3 py-2 hover:bg-brand-mist"
                    >
                      <span className="block text-sm font-bold text-brand-green-ink">
                        <T en={link.label} ne={link.nepali} />
                      </span>
                      <span className="block text-xs text-brand-muted">
                        <T en="" ne={link.label} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      <Link href="/admin/settings/whatsapp" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-brand-green-line px-4 text-sm font-bold text-brand-green-ink hover:bg-brand-mist">
        💬 <T en="WhatsApp settings" ne="WhatsApp सेटिङ" />
      </Link>
    </div>
  );

  const sections: SettingsSection[] = [
    { id: "shop", icon: "🏪", en: "Shop details", ne: "पसलको विवरण", missing: missingIn("shop"), body: shopBody },
    { id: "bill", icon: "🧾", en: "Bill and payment", ne: "बिल र भुक्तानी", missing: missingIn("bill"), body: billBody },
    { id: "delivery", icon: "🚚", en: "Delivery", ne: "डेलिभरी", missing: missingIn("delivery"), body: deliveryBody },
    { id: "goal", icon: "🎯", en: "This month's goal", ne: "यो महिनाको लक्ष्य", body: goalBody },
    { id: "branch", icon: "🏭", en: "Branches", ne: "शाखा", count: activeBranches.length, body: branchBody },
    { id: "staff", icon: "👥", en: "Staff and logins", ne: "कर्मचारी र login", count: activeStaff.length, body: staffBody },
    { id: "system", icon: "🛠️", en: "Setup and system", ne: "सेटअप र प्रणाली", body: systemBody },
  ];

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-black leading-tight text-brand-green-ink">
            ⚙️ <T en="Settings" ne="सेटिङ" />
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
            <T
              en="The shop, bills and payment, delivery, branches and staff — one part at a time."
              ne="पसल, बिल र भुक्तानी, डेलिभरी, शाखा र कर्मचारी — एकपटकमा एउटा भाग।"
            />
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

      {/* A database step the owner has to OK, shown only while it is needed,
          and above everything else so it is not found halfway down. */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {deliveryDatabase && !deliveryDatabase.ready ? (
          <section className="self-start rounded-lg border-2 border-brand-gold-bright/60 bg-brand-cream-soft p-5 shadow-sm">
            <h2 className="text-lg font-black text-brand-green-ink">
              🚚 <T en="Prepare the database for delivery charges" ne="Delivery को लागि database तयार गर्ने" />
            </h2>
            <p className="mt-1 text-sm leading-6 text-brand-muted">
              <T
                en="New columns for the delivery charge are added to the database. Nothing that is already there is changed or removed. Take a backup first (Activity → Export backup)."
                ne="Database मा delivery शुल्कका नयाँ कोठा थपिन्छन्। पहिलेदेखि भएको कुनै पनि data बदलिँदैन वा मेटिँदैन। पहिले backup लिनुहोस् (Activity → Export backup)।"
              />
            </p>
            <details className="mt-4 rounded-lg border border-brand-green-line bg-brand-paper p-4">
              <summary className="cursor-pointer text-sm font-black text-brand-green">
                👀 <T en="Preview first" ne="पहिले हेर्ने" />
              </summary>
              <p className="mt-3 text-sm font-bold text-brand-green-ink">
                <T en="This is added:" ne="यति थपिन्छ:" />
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-brand-green-ink">
                {deliveryDatabase.pending.map((item) => (
                  <li key={item.name}>
                    <T en={item.label.en} ne={item.label.ne} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm font-bold text-emerald-800">
                <T en="Removed or changed: nothing ✅" ne="मेटिने वा बदलिने: केही छैन ✅" />
              </p>
              <form action={prepareDeliveryDatabaseAction} className="mt-4">
                <input type="hidden" name="confirm" value="yes" />
                <SubmitButton label="✅ OK, add them" />
              </form>
            </details>
          </section>
        ) : null}

        {posDatabase && !posDatabase.ready ? (
          <section className="self-start rounded-lg border-2 border-brand-gold-bright/60 bg-brand-cream-soft p-5 shadow-sm">
            <h2 className="text-lg font-black text-brand-green-ink">
              🧾 <T en="Prepare the database for the new counter bill" ne="नयाँ बिलको लागि database तयार गर्ने" />
            </h2>
            <p className="mt-1 text-sm leading-6 text-brand-muted">
              <T
                en="Adds one column so a bill can be paid part cash and part QR, an exchange can be one bill, and old credit can be cleared on a bill. Nothing that is already there is changed or removed. Take a backup first (Activity → Export backup)."
                ne="एउटा नयाँ कोठा थपिन्छ, जसले गर्दा बिल आधा नगद आधा QR मा तिर्न, साटफेर एउटै बिलमा गर्न, र पुरानो बाँकी बिलमै लिन मिल्छ। पहिलेदेखि भएको कुनै पनि data बदलिँदैन वा मेटिँदैन। पहिले backup लिनुहोस् (Activity → Export backup)।"
              />
            </p>
            <details className="mt-4 rounded-lg border border-brand-green-line bg-brand-paper p-4">
              <summary className="cursor-pointer text-sm font-black text-brand-green">
                👀 <T en="Preview first" ne="पहिले हेर्ने" />
              </summary>
              <p className="mt-3 text-sm font-bold text-brand-green-ink">
                <T en="This is added:" ne="यति थपिन्छ:" />
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-brand-green-ink">
                {posDatabase.pending.map((item) => (
                  <li key={item.name}>
                    <T en={item.label.en} ne={item.label.ne} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm font-bold text-emerald-800">
                <T en="Removed or changed: nothing ✅" ne="मेटिने वा बदलिने: केही छैन ✅" />
              </p>
              <form action={preparePosDatabaseAction} className="mt-4">
                <input type="hidden" name="confirm" value="yes" />
                <SubmitButton label="✅ OK, add it" />
              </form>
            </details>
          </section>
        ) : null}

        {orderDispatchDatabase && !orderDispatchDatabase.ready ? (
          <section className="self-start rounded-lg border-2 border-brand-gold-bright/60 bg-brand-cream-soft p-5 shadow-sm">
            <h2 className="text-lg font-black text-brand-green-ink">
              🚚 <T en="Prepare the database for sending orders" ne="अर्डर पठाउने कामको लागि database तयार गर्ने" />
            </h2>
            <p className="mt-1 text-sm leading-6 text-brand-muted">
              <T
                en="Adds five columns to orders: when it was sent, who took it, the delivery charge, the courier's number, and why an order was cancelled. No order, status or stock changes. Take a backup first (Activity → Export backup)."
                ne="अर्डरमा ५ नयाँ कोठा थपिन्छन्: कहिले पठाइयो, कसले लग्यो, डेलिभरी शुल्क, कुरियरको नम्बर, र रद्दको कारण। कुनै अर्डर, अवस्था वा स्टक बदलिँदैन। पहिले backup लिनुहोस् (Activity → Export backup)।"
              />
            </p>
            <details className="mt-4 rounded-lg border border-brand-green-line bg-brand-paper p-4">
              <summary className="cursor-pointer text-sm font-black text-brand-green">
                👀 <T en="Preview first" ne="पहिले हेर्ने" />
              </summary>
              <p className="mt-3 text-sm font-bold text-brand-green-ink">
                <T en="This is added:" ne="यति थपिन्छ:" />
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-brand-green-ink">
                {orderDispatchDatabase.pending.map((item) => (
                  <li key={item.name}>
                    <T en={item.label.en} ne={item.label.ne} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm font-bold text-emerald-800">
                <T en="Removed or changed: nothing ✅" ne="मेटिने वा बदलिने: केही छैन ✅" />
              </p>
              <form action={prepareOrderDispatchDatabaseAction} className="mt-4">
                <input type="hidden" name="confirm" value="yes" />
                <SubmitButton label="✅ OK, add them" />
              </form>
            </details>
          </section>
        ) : null}

        {counterItemsDatabase && !counterItemsDatabase.ready ? (
          <section className="self-start rounded-lg border-2 border-brand-gold-bright/60 bg-brand-cream-soft p-5 shadow-sm">
            <h2 className="text-lg font-black text-brand-green-ink">
              🛒 <T en="Prepare the database for new goods from the counter" ne="बिल काट्ने पेजबाट नयाँ माल थप्नका लागि database तयार गर्ने" />
            </h2>
            <p className="mt-1 text-sm leading-6 text-brand-muted">
              <T
                en="Adds one new table that remembers goods added from the counter bill: how they came, the cost of a pair, who added them, and whether you have looked. No product, bill or stock changes. Take a backup first (Activity → Export backup)."
                ne="एउटा नयाँ तालिका थपिन्छ, जसले बिल काट्ने पेजबाट थपिएका माल सम्झन्छ: कसरी आयो, एक जोडीको लागत, कसले थप्यो, र तपाईंले हेर्नुभयो कि भएन। कुनै माल, बिल वा स्टक बदलिँदैन। पहिले backup लिनुहोस् (Activity → Export backup)।"
              />
            </p>
            <details className="mt-4 rounded-lg border border-brand-green-line bg-brand-paper p-4">
              <summary className="cursor-pointer text-sm font-black text-brand-green">
                👀 <T en="Preview first" ne="पहिले हेर्ने" />
              </summary>
              <p className="mt-3 text-sm font-bold text-brand-green-ink">
                <T en="This is added:" ne="यति थपिन्छ:" />
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-brand-green-ink">
                {counterItemsDatabase.pending.map((item) => (
                  <li key={item.name}>
                    <T en={item.label.en} ne={item.label.ne} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm font-bold text-emerald-800">
                <T en="Removed or changed: nothing ✅" ne="मेटिने वा बदलिने: केही छैन ✅" />
              </p>
              <form action={prepareCounterItemsDatabaseAction} className="mt-4">
                <input type="hidden" name="confirm" value="yes" />
                <SubmitButton label="✅ OK, add it" />
              </form>
            </details>
          </section>
        ) : null}
      </div>

      <SettingsSections sections={sections} todos={todos} />
    </section>
  );
}
