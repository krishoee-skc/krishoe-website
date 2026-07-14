import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PasswordChangeForm from "@/components/account/PasswordChangeForm";
import ProfileEditForm from "@/components/account/ProfileEditForm";
import { logoutCustomerAction } from "@/app/account/actions";
import { getCurrentCustomer } from "@/lib/customer-auth";
import {
  getOrdersForCustomer,
  type OrderSubmission,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/submissions";

export const metadata: Metadata = {
  title: "My Account | KRISHOE",
  description: "Manage your KRISHOE customer account.",
};

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function orderStatusClass(status: OrderStatus) {
  if (status === "Closed") return "bg-[#EAF5EF] text-[#0B4D3B]";
  if (status === "Contacted") return "bg-[#EEF2FF] text-[#3730A3]";
  return "bg-[#FFF7DF] text-[#7A5A00]";
}

function paymentStatusClass(status: PaymentStatus) {
  if (status === "Paid") return "bg-[#EAF5EF] text-[#0B4D3B]";
  if (status === "Failed" || status === "Refunded") return "bg-[#FBEAE8] text-[#7B3128]";
  if (status === "Pending") return "bg-[#FFF7DF] text-[#7A5A00]";
  return "bg-gray-100 text-gray-700";
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-[#5F6B66]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#10231D]">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8A958F]">
        {detail}
      </p>
    </div>
  );
}

function OrderHistory({ orders }: { orders: OrderSubmission[] }) {
  return (
    <section className="mt-6 rounded-lg border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#10231D]">Order history</h2>
          <p className="mt-1 text-sm leading-6 text-[#5F6B66]">
            Requests linked to your account email or saved phone number.
          </p>
        </div>
        <Link
          href="/shop"
          className="inline-flex h-9 items-center rounded-full border border-[#0B4D3B] px-3 text-xs font-bold text-[#0B4D3B] transition hover:bg-[#F5F7F4]"
        >
          Shop again
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-black/10 bg-[#F5F7F4] p-5">
          <p className="text-sm font-semibold text-[#10231D]">No linked order request yet.</p>
          <p className="mt-1 text-sm leading-6 text-[#5F6B66]">
            Use the same email or save your phone number here before checkout to see future orders in this account.
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-[#5F6B66]">
              <tr>
                <th className="py-2 pr-3">Reference</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Order</th>
                <th className="py-2 pr-3">Payment</th>
                <th className="py-2 pr-3">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.slice(0, 8).map((order) => (
                <tr key={order.id}>
                  <td className="whitespace-nowrap py-3 pr-3 font-mono text-xs text-[#10231D]">{order.id}</td>
                  <td className="whitespace-nowrap py-3 pr-3 text-xs text-[#5F6B66]">{formatDate(order.createdAt)}</td>
                  <td className="whitespace-nowrap py-3 pr-3 font-bold text-[#10231D]">{order.total || "-"}</td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${orderStatusClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${paymentStatusClass(order.paymentStatus)}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 text-right">
                    <Link
                      href={`/order/${order.id}`}
                      className="inline-flex h-8 items-center rounded-full border border-black/10 px-3 text-xs font-bold text-[#0B4D3B] transition hover:bg-[#F5F7F4]"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function AccountPage() {
  const user = await getCurrentCustomer();

  if (!user) {
    redirect("/account/login");
  }

  const orders = await getOrdersForCustomer({ userId: user.id, email: user.email, phone: user.phone });
  const openOrders = orders.filter((order) => order.status !== "Closed");
  const pendingPayments = orders.filter((order) => order.paymentStatus === "Pending" || order.paymentStatus === "Unpaid");
  const latestOrder = orders[0];

  return (
    <main className="bg-[#F5F7F4]">
      <Navbar isLoggedIn />
      <section className="mx-auto max-w-5xl px-5 py-16 md:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">
              My account
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-[#10231D] md:text-5xl">
              Namaste, {user.name}.
            </h1>
            <p className="mt-3 text-sm leading-7 text-[#5F6B66]">
              Manage your saved checkout details for faster KRISHOE order requests.
            </p>
          </div>
          <form action={logoutCustomerAction}>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-full border border-black/10 bg-white px-5 text-sm font-bold text-[#0B4D3B] transition hover:bg-[#F5F7F4]"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard label="Linked orders" value={orders.length} detail="account history" />
          <StatCard label="Open orders" value={openOrders.length} detail="new or contacted" />
          <StatCard label="Payment review" value={pendingPayments.length} detail="unpaid or pending" />
          <StatCard
            label="Latest order"
            value={latestOrder ? formatDate(latestOrder.createdAt) : "-"}
            detail={latestOrder?.id ?? "no order"}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-6">
            <ProfileEditForm user={user} />
            <PasswordChangeForm />
          </div>
          <div className="grid content-start gap-6">
            <aside className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-[#10231D]">Account status</h2>
              <dl className="mt-5 grid gap-4 text-sm">
                <div>
                  <dt className="font-semibold text-[#5F6B66]">Email</dt>
                  <dd className="mt-1 font-bold text-[#10231D]">{user.email}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#5F6B66]">Member since</dt>
                  <dd className="mt-1 font-bold text-[#10231D]">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </div>

        <OrderHistory orders={orders} />
      </section>
      <Footer />
    </main>
  );
}
