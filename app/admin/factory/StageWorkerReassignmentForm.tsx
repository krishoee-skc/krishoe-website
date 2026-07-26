import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { reassignFactoryStageWorkerAction } from "@/app/admin/factory/actions";

export default function StageWorkerReassignmentForm({
  assignmentId,
  currentWorkerId,
  currentRate,
  cameraZone,
  workers,
}: {
  assignmentId: string;
  currentWorkerId: string;
  currentRate: number;
  cameraZone: string;
  workers: Array<{ id: string; name: string }>;
}) {
  return (
    <details className="mt-3 rounded-xl border border-blue-100 bg-white p-3">
      <summary className="cursor-pointer text-xs font-black text-blue-800">
        Change worker / future wage rate
      </summary>
      <p className="mt-2 text-[11px] leading-5 text-gray-500">
        Existing production and wages remain under the previous worker. This
        change applies only to new entries.
      </p>
      <form
        action={reassignFactoryStageWorkerAction}
        className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
      >
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <select
          name="workerId"
          defaultValue={currentWorkerId}
          required
          className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm"
        >
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.name} ({worker.id})
            </option>
          ))}
        </select>
        <label className="text-[11px] font-bold text-gray-600">
          Future rate / good pair
          <input
            name="ratePerGoodPair"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={currentRate}
            className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
          />
        </label>
        <label className="text-[11px] font-bold text-gray-600">
          Camera zone
          <input
            name="cameraZone"
            defaultValue={cameraZone}
            className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
          />
        </label>
        <FormSubmitButton
          pendingLabel="Updating..."
          className="min-h-11 self-end rounded-lg bg-blue-700 px-4 text-xs font-black text-white"
        >
          Confirm reassignment
        </FormSubmitButton>
      </form>
    </details>
  );
}
