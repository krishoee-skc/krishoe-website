import { redirect } from "next/navigation";
import WorkerPortalShell from "@/components/worker/WorkerPortalShell";
import WorkerPortalUnavailable from "@/components/worker/WorkerPortalUnavailable";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";

export default async function ProductionPage() {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) redirect("/worker/login");
  if (!access.linked) return <WorkerPortalUnavailable reason={access.reason} />;

  const tasks = access.detail.workerTasks;
  const target = tasks.reduce((total, task) => total + task.targetPairs, 0);
  const completed = tasks.reduce((total, task) => total + task.completedPairs, 0);
  const remaining = Math.max(0, target - completed);
  const progress = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;

  return (
    <WorkerPortalShell workerName={access.detail.employee.name}>
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-gold-deep">My production</p>
      <h1 className="mt-2 text-3xl font-black text-brand-green-ink">Assigned work</h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[["Target pairs", target], ["Completed", completed], ["Remaining", remaining], ["Progress", `${progress}%`]].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-brand-green-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
            No production task is assigned to your linked employee name.
          </div>
        ) : tasks.map((task) => {
          const taskProgress = task.targetPairs > 0
            ? Math.min(100, Math.round((task.completedPairs / task.targetPairs) * 100))
            : 0;
          return (
            <article key={task.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-lg font-black text-brand-green-ink">{task.design}</h2><p className="mt-1 text-sm text-gray-500">{task.station} · Batch {task.batchId}</p></div>
                <span className="rounded-full bg-brand-mist px-3 py-1 text-xs font-black text-brand-green-ink">{task.status}</span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100"><div className="h-full bg-brand-green" style={{ width: `${taskProgress}%` }} /></div>
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><span>{task.completedPairs} of {task.targetPairs} pairs</span><span className="font-black">{taskProgress}%</span></div>
            </article>
          );
        })}
      </div>
    </WorkerPortalShell>
  );
}
