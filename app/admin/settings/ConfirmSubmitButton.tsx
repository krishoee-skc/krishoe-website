"use client";

export default function ConfirmSubmitButton({
  label,
  message,
  className,
}: {
  label: string;
  message: string;
  className: string;
}) {
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
