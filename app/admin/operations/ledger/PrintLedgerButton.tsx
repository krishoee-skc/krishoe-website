"use client";

export default function PrintLedgerButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center rounded-full bg-[#0B4D3B] px-4 text-sm font-bold text-white transition hover:bg-[#D4AF37] hover:text-[#10231D] print:hidden"
    >
      Print ledger
    </button>
  );
}
