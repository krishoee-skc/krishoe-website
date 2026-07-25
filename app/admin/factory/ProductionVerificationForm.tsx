import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { verifyFactoryProductionEntryAction } from "@/app/admin/factory/actions";
import { factoryRejectReasons } from "@/lib/factory";

export default function ProductionVerificationForm({
  entryId,
  hasQualityIssue,
  workers,
}: {
  entryId: string;
  hasQualityIssue: boolean;
  workers: Array<{ id: string; name: string }>;
}) {
  return (
    <form action={verifyFactoryProductionEntryAction} className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
      <input type="hidden" name="entryId" value={entryId} />
      <p className="text-xs font-black uppercase tracking-wider text-blue-900">
        Owner / Supervisor verification
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-blue-950">
          QC reason {hasQualityIssue ? "(required)" : "(if applicable)"}
          <select name="rejectReason" required={hasQualityIssue} className="mt-1 h-11 w-full rounded-lg border border-blue-200 bg-white px-3 font-normal">
            <option value="">No QC issue</option>
            {factoryRejectReasons.map((reason) => <option key={reason}>{reason}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-blue-950">
          Responsible worker
          <select name="responsibleWorkerId" className="mt-1 h-11 w-full rounded-lg border border-blue-200 bg-white px-3 font-normal">
            <option value="">Not worker-related / select</option>
            {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
          </select>
        </label>
      </div>
      <label className="mt-3 flex min-h-11 items-center gap-3 rounded-lg border border-blue-200 bg-white px-3 text-xs font-bold text-blue-950">
        <input type="checkbox" name="reworkPossible" className="h-4 w-4 accent-brand-green" />
        Rework is possible
      </label>
      <label className="mt-3 block text-xs font-bold text-blue-950">
        Verification note
        <input name="verificationNote" placeholder="QC observation or rejection explanation" className="mt-1 h-11 w-full rounded-lg border border-blue-200 bg-white px-3 font-normal" />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-blue-950">
          Decision
          <select name="decision" className="mt-1 h-11 w-full rounded-lg border border-blue-200 bg-white px-3 font-normal">
            <option>Verified</option>
            <option>Rejected</option>
          </select>
        </label>
        <FormSubmitButton
          pendingLabel="Verifying…"
          className="min-h-11 rounded-xl bg-brand-green px-4 text-sm font-black text-white"
        >
          Save verification
        </FormSubmitButton>
      </div>
    </form>
  );
}
