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
      className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#0B4D3B] px-6 text-sm font-black text-white transition hover:bg-[#D4AF37] hover:text-[#10231D] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isDisabled ? pendingLabel : idleLabel}
    </button>
  );
}
