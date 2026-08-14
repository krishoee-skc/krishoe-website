import { redirect } from "next/navigation";
import WorkerPortalShell from "@/components/worker/WorkerPortalShell";
import WorkerPortalUnavailable from "@/components/worker/WorkerPortalUnavailable";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString("en-IN")}`;
}

export default async function WorkerProductionPage() {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) redirect("/worker/login");
  if (!access.linked) return <WorkerPortalUnavailable reason={access.reason} />;

  const { detail } = access;
  const totalPairs = detail.work.reduce((total, entry) => total + entry.pairs, 0);
  const totalEarned = detail.work.reduce((total, entry) => total + entry.amountEarned, 0);

  return (
    <WorkerPortalShell workerName={detail.worker.name}>
      <section className="rounded-lg bg-brand-green-ink p-6 text-white md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-gold-bright">
          मेरो उत्पादन · My production
        </p>
        <h1 className="mt-3 text-3xl font-black md:text-4xl">
          {totalPairs.toLocaleString("en-IN")} जोडी
        </h1>
        <p className="mt-2 text-sm text-white/70">
          पछिल्ला entry · कुल {money(totalEarned)}
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        {detail.work.length === 0 ? (
          <p className="text-sm text-gray-500">
            अझै कुनै काम टिपिएको छैन। काम टिपिएपछि यहाँ देखिन्छ।
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-2 font-semibold">मिति</th>
                  <th className="py-2 font-semibold">सामान</th>
                  <th className="py-2 text-right font-semibold">जोडी</th>
                  <th className="py-2 text-right font-semibold">कमाइ</th>
                </tr>
              </thead>
              <tbody>
                {detail.work.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100">
                    <td className="py-3 font-mono text-xs">{entry.date}</td>
                    <td className="py-3">
                      <span className="font-bold text-brand-green-ink">{entry.itemName}</span>
                      {entry.color || entry.size ? (
                        <span className="ml-2 text-xs text-gray-500">
                          {[entry.color, entry.size].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 text-right font-bold">{entry.pairs}</td>
                    <td className="py-3 text-right font-bold text-brand-green">
                      {money(entry.amountEarned)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </WorkerPortalShell>
  );
}
