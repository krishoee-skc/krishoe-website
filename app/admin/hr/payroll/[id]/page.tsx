import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrintSalarySlipButton from "@/app/admin/hr/payroll/[id]/PrintSalarySlipButton";
import { getHrData, getPayrollRecordById } from "@/lib/hr";

type SalarySlipPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  if (!value) {
    return "Not paid";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export async function generateMetadata({ params }: SalarySlipPageProps): Promise<Metadata> {
  const { id } = await params;
  const payroll = await getPayrollRecordById(id);

  return {
    title: payroll ? `${payroll.employeeName} Salary Slip | KRISHOE Admin` : "Salary Slip Not Found",
  };
}

export default async function SalarySlipPage({ params }: SalarySlipPageProps) {
  const { id } = await params;
  const [payroll, hr] = await Promise.all([getPayrollRecordById(id), getHrData()]);

  if (!payroll) {
    notFound();
  }

  const employee = hr.employees.find((item) => item.id === payroll.employeeId);
  const grossPay =
    payroll.baseAmount + payroll.attendanceBonus + payroll.pieceAmount + payroll.overtimeAmount;

  return (
    <section className="p-6 print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/hr"
          className="inline-flex h-10 items-center rounded-full border border-gray-200 bg-white px-4 text-sm font-bold text-[#10231D] transition hover:border-[#0B4D3B]"
        >
          Back to HR
        </Link>
        <PrintSalarySlipButton />
      </div>

      <div className="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0B4D3B]">
              KRISHOE factory and footwear
            </p>
            <h1 className="mt-2 text-3xl font-black text-[#10231D]">Salary slip</h1>
            <p className="mt-2 text-sm text-gray-500">{payroll.periodLabel}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-black text-[#10231D]">{payroll.id}</p>
            <p className="mt-2 rounded-full border border-gray-200 px-3 py-1 text-xs font-black text-gray-600">
              {payroll.status}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Employee</p>
            <p className="mt-2 font-black text-[#10231D]">{payroll.employeeName}</p>
            <p className="mt-1 text-sm text-gray-500">{employee?.phone || "No phone"}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Department</p>
            <p className="mt-2 font-black text-[#10231D]">{employee?.department || "Not linked"}</p>
            <p className="mt-1 text-sm text-gray-500">{employee?.role || "No role"}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Paid date</p>
            <p className="mt-2 font-black text-[#10231D]">{formatDate(payroll.paidAt)}</p>
            <p className="mt-1 text-sm text-gray-500">{employee?.salaryType || "Salary"}</p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <tbody className="divide-y">
              <tr>
                <td className="py-3 pr-3 font-semibold text-gray-600">Base amount</td>
                <td className="py-3 text-right font-black text-[#10231D]">{money(payroll.baseAmount)}</td>
              </tr>
              <tr>
                <td className="py-3 pr-3 font-semibold text-gray-600">Attendance bonus</td>
                <td className="py-3 text-right font-black text-[#10231D]">{money(payroll.attendanceBonus)}</td>
              </tr>
              <tr>
                <td className="py-3 pr-3 font-semibold text-gray-600">Piece amount</td>
                <td className="py-3 text-right font-black text-[#10231D]">{money(payroll.pieceAmount)}</td>
              </tr>
              <tr>
                <td className="py-3 pr-3 font-semibold text-gray-600">Overtime amount</td>
                <td className="py-3 text-right font-black text-[#10231D]">{money(payroll.overtimeAmount)}</td>
              </tr>
              <tr>
                <td className="py-3 pr-3 font-semibold text-gray-600">Gross pay</td>
                <td className="py-3 text-right font-black text-[#10231D]">{money(grossPay)}</td>
              </tr>
              <tr>
                <td className="py-3 pr-3 font-semibold text-gray-600">Deduction</td>
                <td className="py-3 text-right font-black text-[#7B3128]">{money(payroll.deduction)}</td>
              </tr>
              <tr>
                <td className="py-4 pr-3 text-lg font-black text-[#10231D]">Net pay</td>
                <td className="py-4 text-right text-2xl font-black text-[#0B4D3B]">{money(payroll.netPay)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Note</p>
          <p className="mt-2 text-sm leading-6 text-gray-600">{payroll.note || "No note."}</p>
        </div>

        <div className="mt-10 grid gap-6 text-sm md:grid-cols-2">
          <div className="border-t border-gray-300 pt-3 font-bold text-[#10231D]">Prepared by</div>
          <div className="border-t border-gray-300 pt-3 font-bold text-[#10231D]">Received by</div>
        </div>
      </div>
    </section>
  );
}
