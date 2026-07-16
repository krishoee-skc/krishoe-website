"use client";

export default function PrintSupplierLedgerButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center rounded-full bg-brand-green px-4 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink print:hidden"
    >
      Print statement
    </button>
  );
}
