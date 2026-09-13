import PrintButton from "@/components/admin/PrintButton";
import PrintedOn from "@/components/admin/PrintedOn";
import { businessContact } from "@/lib/seo";
import { redirect } from "next/navigation";
import WorkerPortalShell from "@/components/worker/WorkerPortalShell";
import WorkerPortalUnavailable from "@/components/worker/WorkerPortalUnavailable";
import { money } from "@/lib/format-money";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";


export default async function WorkerPayslipPage() {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) redirect("/worker/login");
  if (!access.linked) return <WorkerPortalUnavailable reason={access.reason} />;

  const { detail } = access;

  return (
    <WorkerPortalShell workerName={detail.worker.name}>
      <div className="report-print">
      {/* Paper only: the shop's name, the worker's own name, and the date this
          sheet was printed. A worker who keeps a payslip needs to be able to
          tell one month's from another's, and a sheet with no shop on it is
          not a payslip. */}
      <div className="report-head mb-4 hidden border-b border-brand-green-line pb-3 print:block">
        <p className="text-base font-black uppercase tracking-[0.16em] text-brand-green-ink">KRISHOE</p>
        <p className="text-[11px] text-brand-muted">
          {businessContact.streetAddress}, {businessContact.addressLocality} · {businessContact.phoneDisplay}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-base font-black text-brand-green-ink">{detail.worker.name}</p>
            <p className="text-[12px] text-brand-muted">Payslip</p>
          </div>
          <p className="text-[11px] text-brand-muted">
            Printed: <PrintedOn />
          </p>
        </div>
      </div>

      {/* The dark green panel is right on a screen and wrong on paper: it
          either eats the shop's ink or comes out as grey mud on a mono
          printer. On paper it turns into plain text on white. */}
      <section className="rounded-lg bg-brand-green-ink p-6 text-white md:p-8 print:bg-transparent print:p-0 print:text-brand-green-ink">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-gold-bright print:text-brand-muted">
              मेरो तलब · My pay
            </p>
            <h1 className="mt-3 text-3xl font-black text-white md:text-4xl print:text-brand-green-ink">
              {money(detail.balance)}
            </h1>
            <p className="mt-2 text-sm text-white/70 print:text-brand-muted">अहिलेसम्म पाउन बाँकी</p>
          </div>
          <PrintButton className="mt-1 inline-flex min-h-11 items-center rounded-full bg-white/15 px-5 text-sm font-black text-white transition hover:bg-white/25 print:hidden">
            🖨️ Print
          </PrintButton>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-brand-green-line bg-brand-paper p-5">
        <h2 className="text-xl font-black text-brand-green-ink">महिना अनुसार</h2>
        {detail.months.length === 0 ? (
          <p className="mt-4 text-sm text-brand-muted">
            अझै कुनै महिनाको हिसाब बनेको छैन।
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-green-line text-brand-muted">
                  <th className="py-2 font-semibold">महिना</th>
                  <th className="py-2 text-right font-semibold">जोडी</th>
                  <th className="py-2 text-right font-semibold">कमाइ</th>
                  <th className="py-2 text-right font-semibold">पाएको</th>
                  <th className="py-2 text-right font-semibold">बाँकी</th>
                </tr>
              </thead>
              <tbody>
                {detail.months.map((month) => (
                  <tr key={month.month} className="border-b border-brand-green-line">
                    <td className="py-3 font-mono text-xs">{month.month}</td>
                    <td className="py-3 text-right font-bold">{month.totalPairs}</td>
                    <td className="py-3 text-right font-bold text-brand-green">
                      {money(month.totalEarned)}
                    </td>
                    <td className="py-3 text-right">{money(month.totalPaid)}</td>
                    <td className="py-3 text-right font-black text-brand-gold-ink">
                      {money(month.finalBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 rounded-lg bg-brand-mist px-4 py-3 text-xs leading-5 text-brand-muted">
          &quot;बाँकी&quot; भनेको त्यो महिनासम्मको जम्मा हिसाब हो। रकम नमिलेको लागे
          मालिक वा HR लाई देखाउनुहोस्।
        </p>
      </section>
    </div>
    </WorkerPortalShell>
  );
}
