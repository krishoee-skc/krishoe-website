"use client";

import { useSearchParams } from "next/navigation";

/**
 * The supplier account's own "no", said on the form that asked (KR-BUG-013,
 * owner 2026-10-27). Paying more than was owed went to an error page: the
 * money was refused, rightly, but the counter saw a broken screen instead of
 * "Test Supplier has only Rs. 800 due".
 */
export default function RefusedNote({ className = "" }: { className?: string }) {
  const said = useSearchParams().get("said");
  if (!said) return null;
  return (
    <p role="alert" className={`${className} rounded-xl bg-brand-clay-tint px-3 py-2 text-sm font-bold text-brand-clay`}>
      ✕ {said}
    </p>
  );
}
