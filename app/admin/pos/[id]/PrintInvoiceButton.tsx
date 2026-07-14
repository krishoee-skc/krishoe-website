"use client";

export default function PrintInvoiceButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-[#10231D] px-4 py-2 text-sm font-bold text-white"
    >
      Print bill
    </button>
  );
}
