"use client";

import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  className?: string;
  children: React.ReactNode;
  pendingLabel?: string;
  // Extra condition that keeps the button disabled even when idle (e.g. a row
  // whose payroll is already recorded). ORed with the submitting state.
  disabled?: boolean;
};

// A submit button that disables itself the moment the form is submitting, so a
// second tap does nothing. Without it, a save gave no sign it was working, the
// owner tapped again thinking the first had not registered, and the record was
// created twice — a duplicate employee, a duplicate supplier. This closes that
// on any server-action form it is dropped into.
export default function FormSubmitButton({
  className,
  children,
  pendingLabel,
  disabled,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel ?? "Saving…" : children}
    </button>
  );
}
