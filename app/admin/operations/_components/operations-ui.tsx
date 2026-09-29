import { deleteOperationRecordAction } from "@/app/admin/operations/actions";
import ConfirmDeleteButton from "@/app/admin/operations/ConfirmDeleteButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { money } from "@/lib/format-money";
import type { OperationRecordKind } from "@/lib/operations";

export const inputClass =
  "h-10 rounded-md border border-brand-green-line px-3 text-base outline-none focus:border-brand-green";
export const textareaClass =
  "min-h-20 rounded-md border border-brand-green-line px-3 py-2 text-base outline-none focus:border-brand-green";
export const compactInputClass =
  "h-9 rounded-md border border-brand-green-line px-2 text-sm outline-none focus:border-brand-green";

export const workerStationOptions = ["Upper", "Fiber Preparation", "Fiber Silai", "Bottom Final"];
export const workerStatusOptions = ["Not Started", "In Progress", "Paused", "Done"];

// Re-exported so the panels that already read `money` from this file keep
// working, while there is still only one implementation of it.
export { money };

export function StatCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  detail: React.ReactNode;
  /** "warn" when the figure is known to be incomplete. */
  tone?: "default" | "warn";
}) {
  return (
    <div className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <p className="text-base font-medium text-brand-muted">{label}</p>
      <p className="mt-2 text-3xl font-black text-brand-green-ink">{value}</p>
      <p className={`mt-2 text-sm font-semibold ${tone === "warn" ? "text-brand-gold-ink" : "uppercase tracking-[0.16em] text-brand-muted-soft"}`}>
        {detail}
      </p>
    </div>
  );
}

export function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-black text-brand-green-ink">{title}</h2>
      <p className="mt-1 text-base text-brand-muted">{detail}</p>
    </div>
  );
}

export function SubmitActionButton({ label }: { label: string }) {
  return (
    <FormSubmitButton
      className="h-10 rounded-full bg-brand-green px-4 text-base font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
      pendingLabel="Saving…"
    >
      {label}
    </FormSubmitButton>
  );
}

export function SaveButton({ label = "Save" }: { label?: string }) {
  return (
    <FormSubmitButton
      className="h-9 rounded-full bg-brand-green-ink px-3 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
      pendingLabel="Saving…"
    >
      {label}
    </FormSubmitButton>
  );
}

export function DeleteRecordForm({
  kind,
  id,
  label = "Delete",
  returnTo,
}: {
  kind: OperationRecordKind;
  id: string;
  label?: string;
  returnTo?: string;
}) {
  return (
    <form action={deleteOperationRecordAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <ConfirmDeleteButton label={label} />
    </form>
  );
}
