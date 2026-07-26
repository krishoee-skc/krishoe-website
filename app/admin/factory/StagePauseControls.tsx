import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { changeFactoryStagePauseStateAction } from "@/app/admin/factory/actions";

export default function StagePauseControls({
  assignmentId,
  status,
  pauseReason,
  pausedBy,
  pausedAt,
}: {
  assignmentId: string;
  status: string;
  pauseReason?: string;
  pausedBy?: string;
  pausedAt?: string;
}) {
  if (status === "Paused") {
    return (
      <div className="mt-3 rounded-xl border border-amber-300 bg-amber-100 p-3 text-amber-950">
        <p className="text-xs font-black">Stage paused: {pauseReason}</p>
        <p className="mt-1 text-[11px]">
          By {pausedBy || "Admin"}
          {pausedAt ? ` at ${new Date(pausedAt).toLocaleString("en-NP")}` : ""}
        </p>
        <form action={changeFactoryStagePauseStateAction} className="mt-2">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="stageAction" value="resume" />
          <FormSubmitButton
            pendingLabel="Resuming..."
            className="min-h-10 rounded-lg bg-emerald-700 px-4 text-xs font-black text-white"
          >
            Problem solved - resume stage
          </FormSubmitButton>
        </form>
      </div>
    );
  }
  if (!["Ready", "In Progress"].includes(status)) return null;
  return (
    <details className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
      <summary className="cursor-pointer text-xs font-black text-amber-800">
        Pause blocked work
      </summary>
      <form action={changeFactoryStagePauseStateAction} className="mt-3 space-y-2">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="stageAction" value="pause" />
        <textarea
          name="reason"
          required
          minLength={5}
          maxLength={500}
          placeholder="Machine issue, material shortage, worker absent..."
          className="min-h-20 w-full rounded-lg border border-amber-200 p-3 text-xs"
        />
        <FormSubmitButton
          pendingLabel="Pausing..."
          className="min-h-10 rounded-lg bg-amber-700 px-4 text-xs font-black text-white"
        >
          Confirm pause
        </FormSubmitButton>
      </form>
    </details>
  );
}
