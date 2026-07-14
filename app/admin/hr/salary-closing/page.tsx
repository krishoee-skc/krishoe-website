import Link from "next/link";
import type { Metadata } from "next";
import PrintSalaryClosingButton from "@/app/admin/hr/salary-closing/PrintSalaryClosingButton";
import { getHrSnapshot } from "@/lib/hr";

export const metadata: Metadata = {
  title: "Salary Closing Report | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function statusClass(status: string) {
  if (status === "Closed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "Review variance") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (status === "Payment pending") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-gray-200 bg-gray-50 text-gray-700";
}

export default async function SalaryClosingReportPage() {
  const hr = await getHrSnapshot();
  const rows = hr.reports.monthlySalaryClosing;
  const periodLabel = rows[0]?.periodLabel ?? monthKey();
  const totals = rows.reduce(
    (summary, row) => ({
      suggested: summary.suggested + row.suggestedNetPay,
      recorded: summary.recorded + row.recordedNetPay,
      paid: summary.paid + row.paidNetPay,
      pending: summary.pending + row.draftNetPay,
      variance: summary.variance + row.variance,
    }),
    { suggested: 0, recorded: 0, paid: 0, pending: 0, variance: 0 },
  );

  return (
    <section className="p-6 print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/hr"
          className="inline-flex h-10 items-center rounded-full border border-gray-200 bg-white px-4 text-sm font-bold text-[#10231D] transition hover:border-[#0B4D3B]"
        >
          Back to HR
        </Link>
        <PrintSalaryClosingButton />
      </div>

      <div className="mx-auto max-w-6xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0B4D3B]">
              KRISHOE factory and footwear
            </p>
            <h1 className="mt-2 text-3xl font-black text-[#10231D]">Salary closing report</h1>
            <p className="mt-2 text-sm text-gray-500">{periodLabel}</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p className="font-bold text-[#10231D]">{new Date().toLocaleDateString("en-IN")}</p>
            <p>{rows.length} employee row(s)</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Suggested</p>
            <p className="mt-2 font-black text-[#10231D]">{money(totals.suggested)}</p>
          </div>
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Recorded</p>
            <p className="mt-2 font-black text-[#10231D]">{money(totals.recorded)}</p>
          </div>
          <div className="rounded-md bg-emerald-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Paid</p>
            <p className="mt-2 font-black text-emerald-900">{money(totals.paid)}</p>
          </div>
          <div className="rounded-md bg-amber-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Pending</p>
            <p className="mt-2 font-black text-amber-900">{money(totals.pending)}</p>
          </div>
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Variance</p>
            <p className="mt-2 font-black text-[#10231D]">{money(totals.variance)}</p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Employee</th>
                <th className="py-2 pr-3">Department</th>
                <th className="py-2 pr-3">Work</th>
                <th className="py-2 pr-3">Suggested</th>
                <th className="py-2 pr-3">Recorded</th>
                <th className="py-2 pr-3">Paid</th>
                <th className="py-2 pr-3">Pending</th>
                <th className="py-2 pr-3">Variance</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.employeeId}>
                  <td className="py-3 pr-3 font-bold text-[#10231D]">{row.employeeName}</td>
                  <td className="py-3 pr-3">{row.department}</td>
                  <td className="py-3 pr-3">
                    <span className="font-semibold text-[#10231D]">{row.attendanceDays} days</span>
                    <span className="block text-xs text-gray-500">{row.completedPairs} pairs</span>
                  </td>
                  <td className="py-3 pr-3">{money(row.suggestedNetPay)}</td>
                  <td className="py-3 pr-3">{money(row.recordedNetPay)}</td>
                  <td className="py-3 pr-3">{money(row.paidNetPay)}</td>
                  <td className="py-3 pr-3">{money(row.draftNetPay)}</td>
                  <td className="py-3 pr-3 font-black text-[#10231D]">{money(row.variance)}</td>
                  <td className="py-3 pr-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(row.statusSignal)}`}>
                      {row.statusSignal}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="py-8 text-center text-gray-500" colSpan={9}>
                    No salary closing data.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-10 grid gap-6 text-sm md:grid-cols-3">
          <div className="border-t border-gray-300 pt-3 font-bold text-[#10231D]">Prepared by</div>
          <div className="border-t border-gray-300 pt-3 font-bold text-[#10231D]">Checked by</div>
          <div className="border-t border-gray-300 pt-3 font-bold text-[#10231D]">Approved by</div>
        </div>
      </div>
    </section>
  );
}
