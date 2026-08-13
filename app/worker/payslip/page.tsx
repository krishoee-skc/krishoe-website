import { redirect } from "next/navigation";
import PrintButton from "@/components/admin/PrintButton";
import WorkerPortalShell from "@/components/worker/WorkerPortalShell";
import WorkerPortalUnavailable from "@/components/worker/WorkerPortalUnavailable";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";

type Props = { searchParams?: Promise<{ month?: string }> };

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString("en-IN")}`;
}

export default async function PayslipPage({ searchParams }: Props) {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) redirect("/worker/login");
  if (!access.linked) return <WorkerPortalUnavailable reason={access.reason} />;

  const payroll = access.detail.payrollRecords.filter((record) => record.status !== "Draft");
  const requestedMonth = (await searchParams)?.month || "";
  const selected = payroll.find((record) => record.periodLabel === requestedMonth) ?? payroll[0];

  return (
    <WorkerPortalShell workerName={access.detail.employee.name}>
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-gold-deep">My payroll</p><h1 className="mt-2 text-3xl font-black text-brand-green-ink">Payslips</h1></div>
        {selected ? <PrintButton className="h-11 rounded-full bg-brand-green px-5 text-sm font-bold text-white">Print / Save PDF</PrintButton> : null}
      </div>

      {payroll.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          No approved or paid payslip has been published yet. Draft payroll is never shown in the worker portal.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-lg border border-gray-200 bg-white p-4 print:hidden">
            <h2 className="font-black text-brand-green-ink">Pay periods</h2>
            <div className="mt-3 grid gap-2">
              {payroll.map((record) => (
                <a key={record.id} href={`/worker/payslip?month=${encodeURIComponent(record.periodLabel)}`} className={`rounded-lg px-3 py-3 text-sm font-bold ${selected?.id === record.id ? "bg-brand-green text-white" : "bg-brand-mist text-brand-green-ink"}`}>
                  {record.periodLabel} · {record.status}
                </a>
              ))}
            </div>
          </aside>

          {selected ? (
            <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-5">
                <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-gold-deep">KRISHOE payslip</p><h2 className="mt-2 text-2xl font-black text-brand-green-ink">{selected.periodLabel}</h2></div>
                <span className="rounded-full bg-brand-green-mist px-4 py-2 text-sm font-black text-brand-green">{selected.status}</span>
              </div>
              <dl className="mt-6 grid gap-3 text-sm">
                <div className="flex justify-between gap-3"><dt>Employee</dt><dd className="font-black">{access.detail.employee.name}</dd></div>
                <div className="flex justify-between gap-3"><dt>Base / daily pay</dt><dd className="font-black">{money(selected.baseAmount)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Piece-rate pay</dt><dd className="font-black">{money(selected.pieceAmount)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Attendance bonus</dt><dd className="font-black">{money(selected.attendanceBonus)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Overtime</dt><dd className="font-black">{money(selected.overtimeAmount)}</dd></div>
                <div className="flex justify-between gap-3 text-brand-clay"><dt>Deductions</dt><dd className="font-black">− {money(selected.deduction)}</dd></div>
                <div className="mt-2 flex justify-between gap-3 border-t border-gray-200 pt-4 text-xl text-brand-green"><dt className="font-black">Net pay</dt><dd className="font-black">{money(selected.netPay)}</dd></div>
              </dl>
              {selected.paidAt ? <p className="mt-5 text-xs text-gray-500">Paid/locked at {new Date(selected.paidAt).toLocaleString("en-IN")}</p> : null}
            </article>
          ) : null}
        </div>
      )}
    </WorkerPortalShell>
  );
}
