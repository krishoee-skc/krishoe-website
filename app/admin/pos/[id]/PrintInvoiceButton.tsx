"use client";

import T from "@/components/T";

export default function PrintInvoiceButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-brand-green-ink px-4 py-2 text-sm font-bold text-white"
    >
      🖨️ <T en="Print bill" ne="बिल छाप्ने" />
    </button>
  );
}
