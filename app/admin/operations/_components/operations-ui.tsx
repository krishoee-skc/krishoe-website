import { deleteOperationRecordAction } from "@/app/admin/operations/actions";
import ConfirmDeleteButton from "@/app/admin/operations/ConfirmDeleteButton";
import type { OperationRecordKind } from "@/lib/operations";

export const inputClass =
  "h-10 rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-brand-green";
export const textareaClass =
  "min-h-20 rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-green";
export const compactInputClass =
  "h-9 rounded-md border border-gray-200 px-2 text-xs outline-none focus:border-brand-green";

export const workerStationOptions = ["Cutting", "Stitching", "Sole Press", "Finishing", "Packing", "QC"];
export const workerStatusOptions = ["Not Started", "In Progress", "Paused", "Done"];

export function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

export function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
        {detail}
      </p>
    </div>
  );
}

export function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-black text-brand-green-ink">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{detail}</p>
    </div>
  );
}

export function SubmitActionButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="h-10 rounded-full bg-brand-green px-4 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
    >
      {label}
    </button>
  );
}

export function SaveButton({ label = "Save" }: { label?: string }) {
  return (
    <button
      type="submit"
      className="h-9 rounded-full bg-brand-green-ink px-3 text-xs font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
    >
      {label}
    </button>
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
