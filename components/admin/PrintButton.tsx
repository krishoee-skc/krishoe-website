"use client";

type PrintButtonProps = {
  className?: string;
  children?: React.ReactNode;
};

// Opens the browser's print dialog for the current page. The admin nav and the
// data-entry forms are hidden on paper (print:hidden), so what prints is the
// report itself — the same sheet the owner would otherwise screenshot.
export default function PrintButton({ className, children = "Print" }: PrintButtonProps) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {children}
    </button>
  );
}
