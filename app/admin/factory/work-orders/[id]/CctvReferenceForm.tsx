import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { addFactoryCctvReferenceAction } from "@/app/admin/factory/actions";
import {
  factoryCctvIncidentTypes,
  type FactoryStageCode,
} from "@/lib/factory";

export default function CctvReferenceForm({
  workOrderId,
  stages,
}: {
  workOrderId: string;
  stages: Array<{
    code: FactoryStageCode;
    name: string;
    cameraZone: string;
  }>;
}) {
  return (
    <form
      action={addFactoryCctvReferenceAction}
      className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm"
    >
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <p className="text-xs font-black uppercase tracking-wider text-blue-700">
        CCTV timestamp reference
      </p>
      <h2 className="mt-1 text-lg font-black text-blue-950">
        Add footage lookup record
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-blue-950">
          Factory stage
          <select
            required
            name="stageCode"
            className="mt-1 h-11 w-full rounded-xl border border-blue-200 bg-white px-3"
          >
            {stages.map((stage) => (
              <option key={stage.code} value={stage.code}>
                {stage.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-blue-950">
          Camera zone
          <input
            required
            name="cameraZone"
            list={`camera-zones-${workOrderId}`}
            placeholder="Example: Upper Camera 1"
            className="mt-1 h-11 w-full rounded-xl border border-blue-200 bg-white px-3"
          />
          <datalist id={`camera-zones-${workOrderId}`}>
            {stages.filter((stage) => stage.cameraZone).map((stage) => (
              <option key={`${stage.code}-${stage.cameraZone}`} value={stage.cameraZone} />
            ))}
          </datalist>
        </label>
        <label className="text-xs font-bold text-blue-950">
          Footage start
          <input
            required
            type="datetime-local"
            name="startedAt"
            className="mt-1 h-11 w-full rounded-xl border border-blue-200 bg-white px-3"
          />
        </label>
        <label className="text-xs font-bold text-blue-950">
          Footage end
          <input
            required
            type="datetime-local"
            name="endedAt"
            className="mt-1 h-11 w-full rounded-xl border border-blue-200 bg-white px-3"
          />
        </label>
        <label className="text-xs font-bold text-blue-950">
          Incident / verification type
          <select
            name="incidentType"
            className="mt-1 h-11 w-full rounded-xl border border-blue-200 bg-white px-3"
          >
            {factoryCctvIncidentTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-blue-950">
          DVR/cloud reference link
          <input
            name="referenceUrl"
            type="url"
            placeholder="https://… (optional)"
            className="mt-1 h-11 w-full rounded-xl border border-blue-200 bg-white px-3"
          />
        </label>
      </div>
      <label className="mt-3 block text-xs font-bold text-blue-950">
        Lookup / incident note
        <textarea
          name="note"
          rows={3}
          placeholder="DVR channel, exact event, reject evidence or investigation note"
          className="mt-1 w-full rounded-xl border border-blue-200 bg-white p-3"
        />
      </label>
      <FormSubmitButton
        pendingLabel="Saving reference…"
        className="mt-3 min-h-11 w-full rounded-xl bg-blue-800 px-4 text-sm font-black text-white"
      >
        Save CCTV reference
      </FormSubmitButton>
      <p className="mt-2 text-[11px] font-semibold text-blue-800">
        KRISHOE stores only the timestamp/link and note—not the CCTV video file.
      </p>
    </form>
  );
}
