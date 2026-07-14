"use client";

export default function ConfirmDeleteButton({
  label = "Delete",
  message = "Delete this record? This action cannot be undone.",
}: {
  label?: string;
  message?: string;
}) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
      className="h-9 rounded-full border border-red-200 px-3 text-xs font-bold text-red-700 transition hover:bg-red-50"
    >
      {label}
    </button>
  );
}
