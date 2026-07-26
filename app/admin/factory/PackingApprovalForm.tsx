import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { approveFactoryPackingAction } from "@/app/admin/factory/actions";

export default function PackingApprovalForm({
  workOrderId,
  rows,
  pendingEntries,
  ready,
}: {
  workOrderId: string;
  rows: Array<{
    size: string;
    plannedPairs: number;
    verifiedGood: number;
    shortagePairs: number;
  }>;
  pendingEntries: number;
  ready: boolean;
}) {
  return (
    <form action={approveFactoryPackingAction} className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <p className="text-xs font-black uppercase tracking-wider text-teal-900">
        Final packing reconciliation
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {rows.map((row) => (
          <span
            key={row.size}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
              row.shortagePairs === 0
                ? "bg-white text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {row.size}: {row.verifiedGood}/{row.plannedPairs}
            {row.shortagePairs > 0 ? ` · short ${row.shortagePairs}` : " ✓"}
          </span>
        ))}
      </div>
      {pendingEntries > 0 ? (
        <p className="mt-2 text-xs font-bold text-amber-700">
          {pendingEntries} packing entries still need verification.
        </p>
      ) : null}
      <label className="mt-3 block text-xs font-bold text-teal-950">
        Packing approval note
        <input
          name="note"
          placeholder="Final packing check or label note"
          className="mt-1 h-11 w-full rounded-lg border border-teal-200 bg-white px-3 font-normal"
        />
      </label>
      <FormSubmitButton
        disabled={!ready}
        pendingLabel="Approving…"
        className="mt-3 min-h-11 w-full rounded-xl bg-teal-700 px-5 text-sm font-black text-white"
      >
        Mark Ready for Stock
      </FormSubmitButton>
      <p className="mt-2 text-[11px] font-semibold text-teal-800">
        This approval does not increase sellable stock.
      </p>
    </form>
  );
}
