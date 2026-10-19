import { deleteOperationRecordAction } from "@/app/admin/operations/actions";
import ConfirmDeleteButton from "@/app/admin/operations/ConfirmDeleteButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { money } from "@/lib/format-money";
import type { OperationRecordKind } from "@/lib/operations";
import { PROOF_KINDS, REASON_MIN } from "@/lib/operation-record-rules";
import T from "@/components/T";

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

export function SectionTitle({ title, detail }: { title: React.ReactNode; detail: React.ReactNode }) {
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
    <form action={deleteOperationRecordAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {/* A stock movement or batch goes only with a reason, kept with a full
          copy in the audit log (owner, 2026-10-20, audit 5). */}
      {PROOF_KINDS.includes(kind) ? (
        <label className="grid gap-1 text-sm font-semibold text-brand-muted">
          <T en="Why (Owner only)" ne="किन हटाउने (Owner मात्र)" />
          <input name="reason" required minLength={REASON_MIN} className={compactInputClass} />
        </label>
      ) : null}
      <ConfirmDeleteButton label={label} />
    </form>
  );
}
