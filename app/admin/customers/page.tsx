import Link from "next/link";
import T from "@/components/T";
import { customerStage, STAGE_META, followUpMessage, type CustomerStage } from "@/lib/customer-stage";
import { whatsappToUrl } from "@/lib/commerce";
import { PageHead, PageTabs, StatStrip } from "@/components/admin/PageKit";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import {
  invalidateCustomerSessionsAction,
  markCustomerPhoneVerifiedAction,
  sendCustomerEmailVerificationAction,
  sendCustomerPasswordResetAction,
} from "@/app/admin/customers/actions";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import { getNotificationDeliveryConfig } from "@/lib/notifications";
import {
  getOrders,
  orderMatchesCustomer,
  type OrderSubmission,
} from "@/lib/submissions";
import { getSafeUsers, type SafeUser } from "@/lib/user-store";

export const metadata = {
  title: "Customers | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

type CustomerRow = {
  user: SafeUser;
  linkedOrders: OrderSubmission[];
  directOrders: OrderSubmission[];
  guestMatches: OrderSubmission[];
  openOrders: OrderSubmission[];
  pendingPayments: OrderSubmission[];
  latestOrder?: OrderSubmission;
  closedOrders: number;
  stage: CustomerStage;
};

function trustClass(verified: boolean) {
  return verified
    ? "bg-brand-green-tint text-brand-green"
    : "bg-brand-cream-soft text-brand-gold-ink";
}

function buttonClass(tone: "primary" | "quiet" | "danger" = "quiet") {
  if (tone === "primary") {
    return "inline-flex min-h-9 items-center justify-center rounded-full bg-brand-green px-3 text-xs font-black text-white transition hover:bg-brand-green-ink";
  }

  if (tone === "danger") {
    return "inline-flex min-h-9 items-center justify-center rounded-full border border-brand-clay/30 bg-brand-paper px-3 text-xs font-black text-brand-clay transition hover:bg-brand-clay-mist";
  }

  return "inline-flex min-h-9 items-center justify-center rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs font-black text-brand-green-ink transition hover:border-brand-green hover:text-brand-green";
}

function buildCustomerRows(users: SafeUser[], orders: OrderSubmission[]): CustomerRow[] {
  return users.map((user) => {
    const linkedOrders = orders.filter((order) => orderMatchesCustomer(order, user));
    const directOrders = linkedOrders.filter((order) => order.customerUserId === user.id);
    const guestMatches = linkedOrders.filter((order) => order.customerUserId !== user.id);
    const openOrders = linkedOrders.filter((order) => order.status !== "Closed" && order.status !== "Cancelled");
    const pendingPayments = linkedOrders.filter(
      (order) => order.paymentStatus === "Pending" || order.paymentStatus === "Unpaid",
    );
    const closedOrders = linkedOrders.filter((order) => order.status === "Closed").length;
    const stage = customerStage(closedOrders, linkedOrders.length > 0);

    return {
      user,
      linkedOrders,
      directOrders,
      guestMatches,
      openOrders,
      pendingPayments,
      latestOrder: linkedOrders[0],
      closedOrders,
      stage,
    };
  });
}

export default async function AdminCustomersPage() {
  const [users, orders, deliveryConfig] = await Promise.all([
    getSafeUsers(),
    getOrders(),
    Promise.resolve(getNotificationDeliveryConfig()),
  ]);
  const rows = buildCustomerRows(users, orders);
  const verifiedEmail = users.filter((user) => user.emailVerifiedAt).length;
  const verifiedPhone = users.filter((user) => user.phoneVerifiedAt).length;
  const customersWithOrders = rows.filter((row) => row.linkedOrders.length > 0).length;
  // How the customers spread across the CRM ladder, for the summary strip.
  const stageCounts = rows.reduce(
    (counts, row) => {
      counts[row.stage] += 1;
      return counts;
    },
    { New: 0, Interested: 0, Ordered: 0, Repeat: 0, VIP: 0 } as Record<CustomerStage, number>,
  );
  const emailChannel = deliveryConfig.channels.find((channel) => channel.id === "email-http");

  // The account actions, the same on the phone card and the table row.
  const actions = (row: CustomerRow) => (
    <>
      <form action={sendCustomerEmailVerificationAction}>
        <input type="hidden" name="userId" value={row.user.id} />
        <FormSubmitButton className={buttonClass("quiet")} pendingLabel="…" disabled={Boolean(row.user.emailVerifiedAt)}>
          <T en="Verify email" ne="Email verify" />
        </FormSubmitButton>
      </form>
      <form action={markCustomerPhoneVerifiedAction}>
        <input type="hidden" name="userId" value={row.user.id} />
        <FormSubmitButton
          className={buttonClass("primary")}
          pendingLabel="…"
          disabled={!row.user.phone || Boolean(row.user.phoneVerifiedAt)}
        >
          <T en="Verify phone" ne="फोन verify" />
        </FormSubmitButton>
      </form>
      <form action={sendCustomerPasswordResetAction}>
        <input type="hidden" name="userId" value={row.user.id} />
        <FormSubmitButton className={buttonClass("quiet")} pendingLabel="…">
          <T en="Reset password" ne="Password reset" />
        </FormSubmitButton>
      </form>
      <form action={invalidateCustomerSessionsAction}>
        <input type="hidden" name="userId" value={row.user.id} />
        <FormSubmitButton className={buttonClass("danger")} pendingLabel="…">
          <T en="End sessions" ne="Login बन्द गर्ने" />
        </FormSubmitButton>
      </form>
    </>
  );

  const whatsapp = (row: CustomerRow) =>
    row.user.phone ? (
      // Follow up on WhatsApp — a stage-aware greeting the owner can send in
      // one tap to keep a customer close.
      <a
        href={whatsappToUrl(row.user.phone, followUpMessage(row.stage, row.user.name))}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full bg-[#25D366] px-3 text-xs font-black text-white transition hover:brightness-95"
      >
        💬 <T en="WhatsApp" ne="WhatsApp" />
      </a>
    ) : null;

  const stagePill = (row: CustomerRow) => (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black ${STAGE_META[row.stage].className}`}>
      <span aria-hidden="true">{STAGE_META[row.stage].icon}</span>
      <T en={STAGE_META[row.stage].en} ne={STAGE_META[row.stage].ne} />
    </span>
  );

  // Phone: two lines a customer, the rarer buttons one press away (owner,
  // 2026-10-12: each customer was a card of seven lines).
  const cards = (list: CustomerRow[]) => (
    <ul className="grid list-none gap-2 pl-0 md:hidden">
      {list.map((row) => (
        <li key={`card-${row.user.id}`} className="grid gap-1.5 rounded-2xl border border-brand-green-line bg-brand-paper p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <b className="truncate text-brand-green-ink">{row.user.name}</b>
              {stagePill(row)}
            </span>
            <span className="shrink-0 text-sm font-black text-brand-green-ink">
              <T en={`${row.linkedOrders.length} order(s)`} ne={`${row.linkedOrders.length} अर्डर`} />
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted">
            <span className="min-w-0 truncate">
              {row.user.phone ? `📞 ${row.user.phone}` : <T en="No phone saved" ne="फोन छैन" />} · {row.user.email}
            </span>
            {row.pendingPayments.length > 0 ? (
              <span className="rounded-full bg-brand-cream-soft px-2 py-0.5 font-black text-brand-gold-ink">
                <T en={`${row.pendingPayments.length} to pay`} ne={`${row.pendingPayments.length} तिर्न बाँकी`} />
              </span>
            ) : row.closedOrders > 0 ? (
              <span className="rounded-full bg-brand-green-tint px-2 py-0.5 font-black text-brand-green">
                <T en="paid ✓" ne="तिरेको ✓" />
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {whatsapp(row)}
            {row.latestOrder ? (
              <Link href={`/admin/orders#${row.latestOrder.id}`} className="text-xs font-bold text-brand-green underline underline-offset-4">
                <T en="Latest order →" ne="पछिल्लो अर्डर →" />
              </Link>
            ) : null}
            <details className="ml-auto">
              <summary className="cursor-pointer list-none rounded-full border border-brand-green-line px-3 py-1 text-xs font-black text-brand-green-ink [&::-webkit-details-marker]:hidden">
                ⋯ <T en="Account" ne="खाता" />
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">{actions(row)}</div>
            </details>
          </div>
        </li>
      ))}
    </ul>
  );

  // Computer: the table, every column as it was, in both languages.
  const table = (list: CustomerRow[]) => (
    <div className="hidden overflow-x-auto md:block">
      <table className="reflow-table min-w-full text-sm">
        <thead className="border-b text-left text-brand-muted">
          <tr>
            <th className="py-2 pr-3"><T en="Customer" ne="ग्राहक" /></th>
            <th className="py-2 pr-3"><T en="Trust" ne="भरोसा" /></th>
            <th className="py-2 pr-3"><T en="Orders" ne="अर्डर" /></th>
            <th className="py-2 pr-3"><T en="Open" ne="खुला" /></th>
            <th className="py-2 pr-3"><T en="Payment" ne="भुक्तानी बाँकी" /></th>
            <th className="py-2 pr-3"><T en="Latest" ne="पछिल्लो" /></th>
            <th className="py-2 pr-3"><T en="Actions" ne="काम" /></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {list.map((row) => (
            <tr key={row.user.id}>
              <td className="reflow-primary py-3 pr-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-brand-green-ink">{row.user.name}</p>
                  {stagePill(row)}
                </div>
                <p className="mt-1 text-xs font-semibold text-brand-muted">{row.user.email}</p>
                <p className="mt-1 text-xs text-brand-muted">
                  {row.user.phone || <T en="No phone saved" ne="फोन छैन" />}
                  {row.closedOrders > 0 ? (
                    <span className="ml-1 text-brand-green">
                      · <T en={`${row.closedOrders} bought`} ne={`${row.closedOrders} पटक किन्यो`} />
                    </span>
                  ) : null}
                </p>
              </td>
              <td data-label="Trust" data-label-ne="भरोसा" className="py-3 pr-3">
                <div className="grid gap-1.5">
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${trustClass(Boolean(row.user.emailVerifiedAt))}`}>
                    {row.user.emailVerifiedAt ? <T en="Email verified" ne="Email पक्का" /> : <T en="Email pending" ne="Email बाँकी" />}
                  </span>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${trustClass(Boolean(row.user.phoneVerifiedAt))}`}>
                    {row.user.phoneVerifiedAt ? <T en="Phone verified" ne="फोन पक्का" /> : <T en="Phone pending" ne="फोन बाँकी" />}
                  </span>
                </div>
              </td>
              <td data-label="Orders" data-label-ne="अर्डर" className="py-3 pr-3 text-brand-muted">
                <p className="font-black text-brand-green-ink">{row.linkedOrders.length}</p>
                <p className="mt-1 text-xs">
                  <T
                    en={`${row.directOrders.length} direct / ${row.guestMatches.length} trusted guest`}
                    ne={`${row.directOrders.length} खाताबाट / ${row.guestMatches.length} विना खाता`}
                  />
                </p>
              </td>
              <td data-label="Open" data-label-ne="खुला" className="py-3 pr-3 font-bold text-brand-green-ink">
                {row.openOrders.length}
              </td>
              <td data-label="Payment" data-label-ne="भुक्तानी बाँकी" className="py-3 pr-3 font-bold text-brand-green-ink">
                {row.pendingPayments.length}
              </td>
              <td data-label="Latest" data-label-ne="पछिल्लो" className="py-3 pr-3 text-xs text-brand-muted">
                {row.latestOrder ? (
                  <Link href={`/admin/orders#${row.latestOrder.id}`} className="font-bold text-brand-green underline underline-offset-4">
                    {row.latestOrder.id}
                  </Link>
                ) : (
                  "-"
                )}
                <p className="mt-1">{row.latestOrder?.createdAt ? <DateDisplayAdmin date={row.latestOrder.createdAt} time={true} /> : "-"}</p>
              </td>
              <td data-label="Actions" data-label-ne="काम" className="py-3 pr-3">
                <div className="flex min-w-56 flex-wrap gap-2">
                  {whatsapp(row)}
                  {actions(row)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const list = (rowsShown: CustomerRow[]) =>
    rowsShown.length === 0 ? (
      <p className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-4 text-sm font-semibold text-brand-muted">
        <T en="Nobody here." ne="यहाँ कोही छैन।" />
      </p>
    ) : (
      <>
        {cards(rowsShown)}
        {table(rowsShown)}
      </>
    );

  const withOrders = rows.filter((row) => row.linkedOrders.length > 0);
  const owing = rows.filter((row) => row.pendingPayments.length > 0);
  const notVerified = rows.filter((row) => !row.user.emailVerifiedAt || !row.user.phoneVerifiedAt);

  return (
    <section className="p-4 sm:p-6">
      <PageHead
        eyebrow={<T en="Customers" ne="ग्राहक" />}
        title={<T en="Customers" ne="ग्राहक" />}
        actions={
          <Link
            href="/admin/notifications"
            className="inline-flex h-9 items-center rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
          >
            <T en="Notification queue" ne="सूचनाको लाइन" />
          </Link>
        }
      />
      <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
        <T en="Website accounts, their orders, and checking their email and phone." ne="वेबसाइटमा खाता खोलेका ग्राहक, उनका अर्डर, र email/फोनको जाँच।" />
      </p>

      <div className="mt-4">
        <StatStrip
          items={[
            { en: "customers", ne: "ग्राहक", value: users.length },
            { en: "with orders", ne: "अर्डर गरेका", value: customersWithOrders },
            { en: "payment to come", ne: "भुक्तानी बाँकी", value: owing.length, tone: owing.length > 0 ? "warn" : undefined },
          ]}
        />
      </div>

      {/* The CRM ladder at a glance — how many customers sit at each stage, so
          the owner sees who to keep close (VIP, Repeat) and who to welcome (New)
          without reading the whole list. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {(["VIP", "Repeat", "Ordered", "Interested", "New"] as const).map((stage) => (
          <span key={stage} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${STAGE_META[stage].className}`}>
            <span aria-hidden="true">{STAGE_META[stage].icon}</span>
            <T en={STAGE_META[stage].en} ne={STAGE_META[stage].ne} />
            <span className="tabular-nums">{stageCounts[stage]}</span>
          </span>
        ))}
      </div>

      <div className="mt-5">
        <PageTabs
          id="customers"
          tabs={[
            { key: "all", en: "All", ne: "सबै", content: list(rows) },
            { key: "orders", en: "With orders", ne: "अर्डर गरेका", content: list(withOrders) },
            { key: "owing", en: "Payment to come", ne: "भुक्तानी बाँकी", count: owing.length, content: list(owing) },
            {
              key: "verify",
              en: "Not verified",
              ne: "Verify नभएका",
              content: (
                <>
                  <p className="text-sm text-brand-muted">
                    <T
                      en={`Email verified ${verifiedEmail} · phone verified ${verifiedPhone} of ${users.length}.`}
                      ne={`${users.length} मध्ये email पक्का ${verifiedEmail} · फोन पक्का ${verifiedPhone}।`}
                    />
                  </p>
                  {list(notVerified)}
                </>
              ),
            },
            {
              key: "email",
              en: "Account email",
              ne: "खाताको email",
              content: (
                <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-black text-brand-green-ink">
                        <T en="Account email delivery" ne="खाताको email पुग्यो कि पुगेन" />
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-brand-muted">
                        <T
                          en="Verification and password reset messages use the Email HTTP channel."
                          ne="Verify र password reset का सन्देश Email HTTP बाट जान्छन्।"
                        />
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        emailChannel?.configured ? "bg-brand-green-tint text-brand-green" : "bg-brand-clay-tint text-brand-clay"
                      }`}
                    >
                      {emailChannel?.configured ? <T en="Ready" ne="तयार" /> : <T en="Missing" ne="छैन" />}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-brand-muted">
                    {emailChannel?.detail ?? <T en="Set EMAIL_PROVIDER_URL for customer account emails." ne="ग्राहकको email का लागि EMAIL_PROVIDER_URL राख्नुहोस्।" />}
                  </p>
                </section>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}
