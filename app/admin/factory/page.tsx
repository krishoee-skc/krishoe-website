import type { Metadata } from "next";
import Link from "next/link";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getProductionFactoryEntrySnapshot } from "@/lib/production-accounting";
import { productionStages } from "@/lib/production-accounting-rules";
import {
  createCctvReferenceAction,
  createHandoverAction,
  createWorkOrderAction,
} from "@/app/admin/operations/production-accounts/actions";

export const metadata: Metadata = { title: "Factory Entry | KRISHOE Admin" };
export const dynamic = "force-dynamic";

const input = "min-h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-brand-green-ink outline-none focus:border-brand-green";
const card = "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5";
const button = "min-h-12 rounded-xl bg-brand-green px-5 text-sm font-black text-white";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

function dateTime() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((row) => row.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export default async function FactoryEntryPage() {
  const { role } = await requireAdminPermission("production:entry");
  const data = await getProductionFactoryEntrySnapshot();

  return (
    <section className="mx-auto max-w-6xl space-y-5 p-4 pb-28 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">Restricted factory desk</p>
          <h1 className="mt-1 text-2xl font-black text-brand-green-ink">Factory watcher entry</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Work Order, stage handover and camera reference only. Wage, cash, costing and stock approval remain Owner-only.
          </p>
        </div>
        <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{role}</span>
      </header>

      <div className="grid gap-5 xl:grid-cols-2">
        <form action={createWorkOrderAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">New Work Order / Lot</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select name="itemId" className={input} required defaultValue="">
              <option value="" disabled>Select item</option>
              {data.items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sizeGroup}</option>)}
            </select>
            <input name="colour" className={input} placeholder="Colour" required />
            <input name="plannedPairs" type="number" min="1" className={input} placeholder="Total pairs" required />
            <input name="sizeBreakdown" className={input} placeholder="36:10, 37:15" required />
            <input name="dueDate" type="date" min={today()} className={input} />
            <select name="priority" className={input} defaultValue="Normal">
              <option>Normal</option><option>High</option><option>Urgent</option>
            </select>
            <input name="note" className={`${input} sm:col-span-2`} placeholder="Production note" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Creating…">Create Work Order</FormSubmitButton>
        </form>

        <form action={createHandoverAction} className={card}>
          <h2 className="text-lg font-black text-brand-green-ink">Stage handover</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select name="workOrderId" className={`${input} sm:col-span-2`} required defaultValue="">
              <option value="" disabled>Select Work Order</option>
              {data.workOrders.map((order) => <option key={order.id} value={order.id}>{order.workOrderNumber} · {order.itemName}</option>)}
            </select>
            <select name="fromStage" className={input}>{productionStages.map((stage) => <option key={stage}>{stage}</option>)}</select>
            <input name="handoverDate" type="date" defaultValue={today()} className={input} required />
            <select name="fromEmployeeId" className={input} defaultValue=""><option value="">Sender</option>{data.employees.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
            <select name="toEmployeeId" className={input} defaultValue=""><option value="">Receiver</option>{data.employees.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
            <input name="sentPairs" type="number" min="1" className={input} placeholder="Sent pairs" required />
            <input name="receivedPairs" type="number" min="0" className={input} placeholder="Received pairs" required />
            <input name="receivedSizeBreakdown" className={`${input} sm:col-span-2`} placeholder="Received sizes: 36:10, 37:15" />
            <input name="note" className={`${input} sm:col-span-2`} placeholder="Difference / note" />
          </div>
          <FormSubmitButton className={`${button} mt-4`} pendingLabel="Saving…">Save handover</FormSubmitButton>
        </form>
      </div>

      <form action={createCctvReferenceAction} className={`${card} border-sky-200`}>
        <h2 className="text-lg font-black text-brand-green-ink">CCTV time reference</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <select name="workOrderId" className={input} required defaultValue="">
            <option value="" disabled>Select Work Order</option>
            {data.workOrders.map((order) => <option key={order.id} value={order.id}>{order.workOrderNumber} · {order.itemName}</option>)}
          </select>
          <select name="stage" className={input}>{[...productionStages, "Packing / QC"].map((stage) => <option key={stage}>{stage}</option>)}</select>
          <input name="cameraZone" className={input} placeholder="Camera zone" required />
          <input name="windowStart" type="datetime-local" defaultValue={dateTime()} className={input} required />
          <input name="windowEnd" type="datetime-local" defaultValue={dateTime()} className={input} required />
          <input name="cctvReference" className={input} placeholder="DVR / camera reference" />
          <input name="evidenceReference" className={input} placeholder="Evidence link/reference" />
          <input name="note" className={`${input} sm:col-span-2`} placeholder="Verification / incident note" />
          <FormSubmitButton className={button} pendingLabel="Saving…">Save CCTV reference</FormSubmitButton>
        </div>
      </form>

      <div className={card}>
        <h2 className="text-lg font-black text-brand-green-ink">Open Work Orders</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.workOrders.map((order) => (
            <article key={order.id} className="rounded-xl bg-gray-50 p-3 text-sm">
              <p className="font-black text-brand-green-ink">{order.workOrderNumber} · {order.itemName}</p>
              <p className="mt-1 text-gray-500">{order.colour} · {order.plannedPairs} pairs · {order.currentStage}</p>
              {role !== "Factory" ? <Link href={`/admin/operations/production-accounts/work-order/${order.id}`} className="mt-2 inline-block text-xs font-black text-brand-green underline">Owner detail</Link> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
