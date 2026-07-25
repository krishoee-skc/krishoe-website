import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { releaseFactoryWorkOrderAction } from "@/app/admin/factory/actions";
import { factoryStages, type FactoryStageCode } from "@/lib/factory";

type ReleaseStage = {
  code: FactoryStageCode;
  rate: number | null;
  workers: Array<{ id: string; name: string }>;
};

export default function WorkOrderReleaseForm({
  workOrderId,
  stages,
  bomReady,
}: {
  workOrderId: string;
  stages: ReleaseStage[];
  bomReady: boolean;
}) {
  const ready = bomReady && stages.every((stage) => stage.rate !== null && stage.workers.length > 0);

  return (
    <form action={releaseFactoryWorkOrderAction} className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <p className="text-xs font-black uppercase tracking-wider text-brand-green-ink">
        Stage assignment
      </p>
      <div className="mt-3 space-y-3">
        {stages.map((stage) => {
          const definition = factoryStages.find((entry) => entry.code === stage.code);
          return (
            <div key={stage.code} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-black text-brand-green-ink">
                  {definition?.name ?? stage.code}
                </label>
                <span className={`text-xs font-black ${stage.rate === null ? "text-red-600" : "text-emerald-700"}`}>
                  {stage.rate === null ? "Rate missing" : `Rs. ${stage.rate}/good pair`}
                </span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <select
                  name={`worker__${stage.code}`}
                  required
                  disabled={stage.workers.length === 0}
                  className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm disabled:bg-gray-100"
                >
                  <option value="">Select worker</option>
                  {stage.workers.map((worker) => (
                    <option key={worker.id} value={worker.id}>{worker.name}</option>
                  ))}
                </select>
                <input
                  name={`camera__${stage.code}`}
                  placeholder="Camera zone (optional)"
                  className="h-11 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </div>
              {stage.workers.length === 0 ? (
                <p className="mt-2 text-xs font-bold text-red-600">No eligible worker linked to this stage.</p>
              ) : null}
            </div>
          );
        })}
      </div>
      {!bomReady ? <p className="mt-3 text-xs font-bold text-red-600">Add at least one BOM material before release.</p> : null}
      <FormSubmitButton
        disabled={!ready}
        pendingLabel="Releasing…"
        className="mt-4 min-h-11 w-full rounded-xl bg-brand-green px-4 text-sm font-black text-white"
      >
        Release Work Order
      </FormSubmitButton>
    </form>
  );
}
