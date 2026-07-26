import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { cancelFactoryWorkOrderAction } from "@/app/admin/factory/actions";

export default function WorkOrderCancellationForm({
  workOrderId,
}: {
  workOrderId: string;
}) {
  return (
    <details className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
      <summary className="cursor-pointer text-xs font-black text-red-800">
        Cancel this Work Order
      </summary>
      <p className="mt-2 text-[11px] leading-5 text-red-700">
        Use only when this lot will not be produced. Records are retained for
        audit; nothing is deleted.
      </p>
      <form action={cancelFactoryWorkOrderAction} className="mt-3 space-y-2">
        <input type="hidden" name="workOrderId" value={workOrderId} />
        <label className="block text-xs font-bold text-red-900">
          Cancellation reason
          <textarea
            name="reason"
            required
            minLength={5}
            maxLength={500}
            placeholder="Why is this lot being cancelled?"
            className="mt-1 min-h-20 w-full rounded-lg border border-red-200 bg-white p-3 font-normal"
          />
        </label>
        <label className="flex items-start gap-2 text-xs font-bold text-red-900">
          <input type="checkbox" required className="mt-0.5 h-4 w-4" />
          I confirm production has not started and posted material has not been consumed.
        </label>
        <FormSubmitButton
          pendingLabel="Cancelling..."
          className="min-h-11 rounded-lg bg-red-700 px-4 text-xs font-black text-white"
        >
          Confirm cancellation
        </FormSubmitButton>
      </form>
    </details>
  );
}
