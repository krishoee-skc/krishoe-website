"use client";

// A submit button that asks first. Delete actions across the admin sat one
// mis-tap away from removing a record with no undo; this puts a confirm in
// front of any of them. Pass className to keep each button's existing look.
type ConfirmDeleteButtonProps = {
  label?: string;
  message?: string;
  className?: string;
};

const defaultClass =
  "h-9 rounded-full border border-red-200 px-3 text-xs font-bold text-red-700 transition hover:bg-red-50";

export default function ConfirmDeleteButton({
  label = "Delete",
  message = "Delete this record? This cannot be undone.",
  className = defaultClass,
}: ConfirmDeleteButtonProps) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
      className={className}
    >
      {label}
    </button>
  );
}
