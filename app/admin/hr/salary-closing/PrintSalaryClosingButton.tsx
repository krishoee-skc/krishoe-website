"use client";

export default function PrintSalaryClosingButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-[#10231D] px-4 py-2 text-sm font-bold text-white"
    >
      Print report
    </button>
  );
}
