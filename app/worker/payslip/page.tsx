import { redirect } from "next/navigation";
import WorkerPortalShell from "@/components/worker/WorkerPortalShell";
import WorkerPortalUnavailable from "@/components/worker/WorkerPortalUnavailable";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString("en-IN")}`;
}

export default async function WorkerPayslipPage() {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) redirect("/worker/login");
  if (!access.linked) return <WorkerPortalUnavailable reason={access.reason} />;

  const { detail } = access;

  return (
    <WorkerPortalShell workerName={detail.worker.name}>
      <section className="rounded-lg bg-brand-green-ink p-6 text-white md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-gold-bright">
          मेरो तलब · My pay
        </p>
        <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">{money(detail.balance)}</h1>
        <p className="mt-2 text-sm text-white/70">अहिलेसम्म पाउन बाँकी</p>
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
    </WorkerPortalShell>
  );
}
