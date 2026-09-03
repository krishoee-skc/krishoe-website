"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  disabled?: boolean;
};

export default function SubmitButton({ idleLabel, pendingLabel, disabled = false }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className="inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full bg-brand-green px-6 py-3 text-sm font-black text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 md:min-h-12"
    >
      {pending ? <span className="krishoe-spinner" aria-hidden="true" /> : null}
      {isDisabled ? pendingLabel : idleLabel}
    </button>
  );
}
