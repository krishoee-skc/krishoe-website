"use client";

export default function PrintSalaryClosingButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-brand-green-ink px-4 py-2 text-sm font-bold text-white"
    >
      Print report
    </button>
  );
}
