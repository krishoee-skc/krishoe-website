import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { postFactoryFinishedStockAction } from "@/app/admin/factory/actions";

export default function FinishedStockPostingForm({
  workOrderId,
  pairs,
  canPost,
  message,
}: {
  workOrderId: string;
  pairs: number;
  canPost: boolean;
  message: string;
}) {
  return (
    <form
      action={postFactoryFinishedStockAction}
      className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3"
    >
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <p className="text-xs font-black uppercase tracking-wider text-emerald-900">
        Finished-stock posting
      </p>
      <p className="mt-2 text-xs font-semibold leading-5 text-emerald-800">
        {message}
      </p>
      <FormSubmitButton
        disabled={!canPost}
        pendingLabel="Posting stock…"
        className="mt-3 min-h-11 w-full rounded-xl bg-emerald-800 px-4 text-sm font-black text-white"
      >
        Post {pairs} pairs to sellable stock
      </FormSubmitButton>
      <p className="mt-2 text-[11px] font-semibold text-emerald-800">
        One-time action: creates size-wise Production In movements and updates shop stock.
      </p>
    </form>
  );
}
