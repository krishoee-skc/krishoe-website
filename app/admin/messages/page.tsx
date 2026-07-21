import { getContactMessages } from "@/lib/submissions";
import { formatAdminDate } from "@/lib/format-date";
import { updateMessageStatusAction } from "@/app/admin/messages/actions";

export const metadata = {
  title: "Messages | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return formatAdminDate(value, { time: true });
}

function statusClass(status: string) {
  return status === "Replied"
    ? "bg-brand-green-tint text-brand-green"
    : "bg-brand-cream-soft text-brand-gold-ink";
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
        {detail}
      </p>
    </div>
  );
}

export default async function AdminMessagesPage() {
  const messages = await getContactMessages();
  const newMessages = messages.filter((message) => message.status === "New");
  const repliedMessages = messages.filter((message) => message.status === "Replied");
  const latestMessage = messages[0];

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">Messages</h1>
          <p className="mt-1 text-sm text-gray-500">Customer contact form submissions.</p>
        </div>
        <a
          href="/api/messages/export"
          className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
        >
          Export CSV
        </a>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Total messages" value={messages.length} detail="contact inbox" />
        <StatCard label="New" value={newMessages.length} detail="needs reply" />
        <StatCard label="Replied" value={repliedMessages.length} detail="closed follow-up" />
        <StatCard
          label="Latest"
          value={latestMessage ? formatDate(latestMessage.createdAt) : "-"}
          detail={latestMessage ? latestMessage.name : "no messages"}
        />
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Date</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Customer</th>
              <th className="px-4 py-3 text-left font-medium text-gray-900">Message</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Status</th>
              <th className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {messages.map((message) => (
              <tr key={message.id}>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                  {formatDate(message.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <p className="font-medium text-gray-900">{message.name}</p>
                  <a className="text-xs font-semibold text-brand-green" href={`mailto:${message.email}`}>
                    {message.email}
                  </a>
                </td>
                <td className="max-w-xl px-4 py-3 leading-6 text-gray-700">{message.message}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(message.status)}`}>
                    {message.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <form action={updateMessageStatusAction}>
                    <input type="hidden" name="id" value={message.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={message.status === "New" ? "Replied" : "New"}
                    />
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center rounded-full border border-gray-200 px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
                    >
                      {message.status === "New" ? "Mark replied" : "Reopen"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  No messages yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
