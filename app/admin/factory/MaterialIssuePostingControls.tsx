import FormSubmitButton from "@/components/admin/FormSubmitButton";
import {
  finalizeFactoryMaterialIssueAction,
  postFactoryMaterialIssueAction,
  returnFactoryMaterialIssueAction,
} from "@/app/admin/factory/actions";
import type { FactoryMaterialIssue } from "@/lib/factory";

export default function MaterialIssuePostingControls({
  issue,
}: {
  issue: FactoryMaterialIssue;
}) {
  if (issue.status === "Draft") {
    return (
      <form action={postFactoryMaterialIssueAction} className="mt-2">
        <input type="hidden" name="issueId" value={issue.id} />
        <FormSubmitButton
          pendingLabel="Posting…"
          className="min-h-10 w-full rounded-lg bg-orange-700 px-3 text-xs font-black text-white"
        >
          Confirm issue & deduct raw stock
        </FormSubmitButton>
      </form>
    );
  }

  if (issue.status !== "Posted") return null;
  if (issue.finalizedAt) {
    return (
      <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs font-bold text-emerald-800">
        Final: consumed {issue.consumedQuantity} · wastage {issue.wastageQuantity}
        {" · "}approved by {issue.finalizedBy}
      </p>
    );
  }

  const remaining = Math.max(
    0,
    issue.quantity -
      issue.returnedQuantity -
      issue.consumedQuantity -
      issue.wastageQuantity,
  );

  return (
    <div className="mt-2 grid gap-2 lg:grid-cols-2">
      <form action={returnFactoryMaterialIssueAction} className="rounded-lg border border-blue-100 bg-blue-50 p-2">
        <input type="hidden" name="issueId" value={issue.id} />
        <p className="text-[11px] font-black uppercase text-blue-900">
          Return unused material
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            required
            name="quantity"
            type="number"
            min="0.0001"
            max={remaining}
            step="0.0001"
            placeholder={`Max ${remaining}`}
            className="h-10 rounded-lg border border-blue-200 px-2 text-xs"
          />
          <input
            required
            name="note"
            placeholder="Return reason"
            className="h-10 rounded-lg border border-blue-200 px-2 text-xs"
          />
        </div>
        <FormSubmitButton
          disabled={remaining <= 0}
          pendingLabel="Returning…"
          className="mt-2 min-h-10 w-full rounded-lg bg-blue-700 px-3 text-xs font-black text-white"
        >
          Return to raw stock
        </FormSubmitButton>
      </form>

      <form action={finalizeFactoryMaterialIssueAction} className="rounded-lg border border-emerald-100 bg-emerald-50 p-2">
        <input type="hidden" name="issueId" value={issue.id} />
        <p className="text-[11px] font-black uppercase text-emerald-900">
          Finalize consumption · balance {remaining}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            required
            name="consumedQuantity"
            type="number"
            min="0"
            step="0.0001"
            defaultValue={remaining}
            aria-label="Consumed quantity"
            className="h-10 rounded-lg border border-emerald-200 px-2 text-xs"
          />
          <input
            required
            name="wastageQuantity"
            type="number"
            min="0"
            step="0.0001"
            defaultValue={0}
            aria-label="Wastage quantity"
            className="h-10 rounded-lg border border-emerald-200 px-2 text-xs"
          />
        </div>
        <input
          name="note"
          placeholder="Wastage/verification note"
          className="mt-2 h-10 w-full rounded-lg border border-emerald-200 px-2 text-xs"
        />
        <FormSubmitButton
          disabled={remaining <= 0}
          pendingLabel="Finalizing…"
          className="mt-2 min-h-10 w-full rounded-lg bg-emerald-700 px-3 text-xs font-black text-white"
        >
          Finalize consumption
        </FormSubmitButton>
      </form>
    </div>
  );
}
