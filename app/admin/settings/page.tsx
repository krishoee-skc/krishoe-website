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
} from "./actions";
import { getBusinessGoal, currentGoalMonthKey } from "@/lib/business-goals";
import { MAX_DELIVERY_ZONES, deliveryPolicySentence } from "@/lib/delivery-fee";
import { getDeliveryPricing } from "@/lib/delivery-settings";
import { deliveryDatabaseStatus } from "@/lib/delivery-database";
import { reportError } from "@/lib/report-error";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import StaffAccessManager from "@/components/admin/StaffAccessManager";
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

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
            Access control
          </p>
          <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink">Company and staff settings</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
            Manage branch identity, staff login accounts, and role-based admin access for the
            factory, shop, POS, inventory, HR, and reports modules.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm">
          <p className="font-black text-emerald-950">{role}</p>
          <p className="text-xs font-semibold text-emerald-700">current permission role</p>
        </div>
      </div>

      {/* The screens that are set up once and then not opened again.
          They used to sit in the main menu beside Factory Entry and Orders,
          which are opened fifty times a day — ten of the twenty-five a
          shopkeeper saw were things like "Getting Started" and "Login devices",
          and the daily work had to be found among them. Nothing is unreachable:
          they are here, and Search finds them by name. */}
      <div className="mt-8">
        <h2 className="text-lg font-black text-brand-green-ink">
          ⚙️ <T en="Setup and system" ne="सेटअप र प्रणाली" />
        </h2>
        <p className="mt-1 text-sm leading-6 text-brand-muted">
          <T
            en="The screens you set up once and then never open again — they all live here."
            ne="एकपटक मिलाएपछि फेरि खोल्नु नपर्ने पानाहरू — यहीँ भेटिन्छन्।"
          />
        </p>

        <div className="mt-4 grid gap-5 md:grid-cols-3">
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
        <div className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
          <p className="text-sm font-semibold text-brand-muted">Company</p>
          <p className="mt-2 text-2xl font-black text-brand-green-ink">{settings.company.companyName}</p>
          <p className="mt-1 text-xs font-semibold text-brand-muted">
            Updated {settings.company.updatedAt ? <DateDisplayAdmin date={settings.company.updatedAt} time={true} /> : "Never"}
          </p>
        </div>
        <div className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
          <p className="text-sm font-semibold text-brand-muted">Active branches</p>
          <p className="mt-2 text-2xl font-black text-brand-green-ink">{activeBranches.length}</p>
          <p className="mt-1 text-xs font-semibold text-brand-muted">
            {settings.branches.length} total branch records
          </p>
        </div>
        <div className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
          <p className="text-sm font-semibold text-brand-muted">Active staff</p>
          <p className="mt-2 text-2xl font-black text-brand-green-ink">{activeStaff.length}</p>
          <p className="mt-1 text-xs font-semibold text-brand-muted">
            {settings.staff.length} staff login accounts
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <form action={saveCompanySettingsAction} className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-black text-brand-green-ink">Company profile</h2>
            <p className="mt-1 text-sm text-brand-muted">Used for billing identity, SEO, reports, and branch defaults.</p>
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
                className="min-h-11 rounded-lg border border-brand-green-line px-3 py-2 text-sm font-normal outline-none focus:border-brand-green"
              />
            </label>

            {/* The line printed at the foot of every POS bill.
                The bill leaves in the customer's bag and is the paper they
                still have three days later, when the shoe turns out to be a
                size small — so the return window belongs on it, not only on
                the website. Kept here rather than in the code because the
                window is the shop's decision: seven days today, and if it ever
                becomes fifteen the owner changes it here.
                Blank prints nothing, and the bill reads as it did before. */}
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink md:col-span-2">
              Bill footer note
              <input
                name="billFooterNote"
                defaultValue={settings.company.billFooterNote}
                maxLength={200}
                placeholder="e.g. Exchange or return within 7 days — unworn, with tags and box"
                className="min-h-11 rounded-lg border border-brand-green-line px-3 py-2 text-sm font-normal outline-none focus:border-brand-green"
              />
              <span className="text-xs font-semibold text-brand-muted">
                Printed at the foot of every bill, above the shop&apos;s phone and web
                address. Leave blank to print nothing.
              </span>
            </label>

            {/* The line shown across the top of the shop. The owner writes it —
                a welcome code, a Dashain offer, a delivery line — and turns it on
                or off. Off or blank shows the built-in line instead. */}
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink md:col-span-2">
              Shop top-bar message
              <input
                name="promoText"
                defaultValue={settings.company.promoText}
                maxLength={160}
                placeholder="e.g. First order? Use WELCOME10 for 10% off — write it in any language"
                className="min-h-11 rounded-lg border border-brand-green-line px-3 py-2 text-sm font-normal outline-none focus:border-brand-green"
              />
              <span className="flex items-center gap-2 text-xs font-semibold text-brand-muted">
                <input
                  type="checkbox"
                  name="promoEnabled"
                  defaultChecked={settings.company.promoEnabled}
                  className="h-4 w-4 accent-brand-green"
                />
                Show this message on the shop (off = the built-in line)
              </span>
            </label>

            {/* Public review links. After an order the app asks for a rating; a
                happy one (4-5 stars) is offered these so a kind word reaches
                Google or Facebook and brings new customers. Blank = not offered;
                the rating still reaches you in the inbox either way. The
                placeholders show the real address to copy so the owner is not
                left guessing the format. */}
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink md:col-span-2">
              Google review link
              <input
                name="googleReviewUrl"
                type="url"
                defaultValue={settings.company.googleReviewUrl}
                maxLength={400}
                placeholder="From Google Business, e.g. https://g.page/r/… (leave blank to skip)"
                className="min-h-11 rounded-lg border border-brand-green-line px-3 py-2 text-sm font-normal outline-none focus:border-brand-green"
              />
              <span className="text-xs font-semibold text-brand-muted">
                On Google, search your shop → your business profile → &ldquo;Ask for reviews&rdquo; → copy the link.
              </span>
            </label>
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink md:col-span-2">
              Facebook review link
              <input
                name="facebookReviewUrl"
                type="url"
                defaultValue={settings.company.facebookReviewUrl}
                maxLength={400}
                placeholder="https://www.facebook.com/krishoe.np/reviews (leave blank to skip)"
                className="min-h-11 rounded-lg border border-brand-green-line px-3 py-2 text-sm font-normal outline-none focus:border-brand-green"
              />
              <span className="text-xs font-semibold text-brand-muted">
                Your KRISHOE Facebook page address with /reviews on the end.
              </span>
            </label>

            {/* Bank details for customer transfers. Checkout showed an invented
                account number for months because there was nowhere for the real
                one to live. The account number is what makes the panel useful,
                so leaving it blank hides the whole bank panel at checkout —
                better than showing half an account to someone about to send
                money. Cash on delivery is unaffected either way. */}
            <div className="md:col-span-2">
              <h3 className="text-sm font-black text-brand-green-ink">Bank details for customer payments</h3>
              <p className="mt-1 text-xs font-semibold text-brand-muted">
                Shown on checkout for bank transfer / QR. Leave the account number blank and the bank
                panel is hidden completely — customers then see only Cash on delivery and the other options.
              </p>
            </div>
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
              Bank name
              <input
                name="bankName"
                defaultValue={settings.company.bankName}
                maxLength={120}
                placeholder="e.g. Nabil Bank Ltd."
                className="min-h-11 rounded-lg border border-brand-green-line px-3 py-2 text-sm font-normal outline-none focus:border-brand-green"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
              Account name
              <input
                name="bankAccountName"
                defaultValue={settings.company.bankAccountName}
                maxLength={120}
                placeholder="The name on the account"
                className="min-h-11 rounded-lg border border-brand-green-line px-3 py-2 text-sm font-normal outline-none focus:border-brand-green"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
              Account number
              <input
                name="bankAccountNumber"
                inputMode="numeric"
                defaultValue={settings.company.bankAccountNumber}
                maxLength={40}
                placeholder="Digits only (leave blank to hide the bank panel)"
                className="min-h-11 rounded-lg border border-brand-green-line px-3 py-2 text-sm font-normal outline-none focus:border-brand-green"
              />
              <span className="text-xs font-semibold text-brand-muted">
                Check this digit by digit — a customer types it into their banking app.
              </span>
            </label>
            <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
              Branch
              <input
                name="bankBranch"
                defaultValue={settings.company.bankBranch}
                maxLength={120}
                placeholder="e.g. Narayangadh, Chitwan"
                className="min-h-11 rounded-lg border border-brand-green-line px-3 py-2 text-sm font-normal outline-none focus:border-brand-green"
              />
            </label>
          </div>
          <div className="mt-5">
            <SubmitButton label="Save company settings" />
          </div>
        </form>

        {/* This month's goal — sales, profit and pairs the owner is aiming at.
            The dashboard's goal card links here (#goals). Leaving a line at 0
            means it is not tracked; the card shows "Set a goal" for it. */}
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

        {/* The live database needs its delivery columns before the charges
            below can be saved. Shown only while something is missing; gone
            for good once it is done. The preview must be opened to reach OK. */}
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

        {/* What delivery costs. The header, the home page, the assistant and
            checkout all read these two numbers, so the shop makes one promise
            and the order total keeps it. */}
        <form
          id="delivery"
          action={saveDeliveryPricingAction}
          className="scroll-mt-24 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm"
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

      <StaffAccessManager
        staff={settings.staff}
        safety={staffSafety}
        branches={settings.branches.map(({ id, name, code }) => ({ id, name, code }))}
        factoryWorkers={factoryWorkers}
        permissionMap={permissionMap}
        defaultBranchId={settings.company.defaultBranchId}
      />

      <section className="mt-8 rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Immutable security trail</p>
          <h2 className="mt-2 text-xl font-black text-brand-green-ink">Recent staff access changes</h2>
          <p className="mt-1 text-sm text-brand-muted">Every sensitive change records the actor, time, device and safe before/after values.</p>
        </div>
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
      </section>
    </section>
  );
}
