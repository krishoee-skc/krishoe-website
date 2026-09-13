"use client";

import { useEffect, useState } from "react";
import { toBikramSambatNepali } from "@/lib/bikram-sambat";
import { formatAdminDate } from "@/lib/format-date";

/**
 * The date a sheet was printed, in both calendars.
 *
 * These reports change between one printing and the next — a worker does more
 * work, a customer pays part of what they owe — so two copies a week apart are
 * different documents, and only the date says which one is current. A worker
 * being shown their own wages should be able to see which day the figures are
 * from.
 *
 * Held empty until the browser has it. Rendering `new Date()` during the
 * server pass and again in the browser is a hydration mismatch: the two runs
 * happen at different instants, so React finds different text than it rendered
 * and replaces the node — and on a slow connection the reader can see the date
 * flicker. Empty first, filled in an effect, is the same pattern NowClock
 * uses.
 *
 * The first reading is scheduled rather than set in the effect body, because
 * a synchronous setState there is what `react-hooks/set-state-in-effect`
 * forbids — and the rule is right: it renders twice for no reason.
 */
export default function PrintedOn() {
  const [stamp, setStamp] = useState<{ bs: string; ad: string } | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const now = new Date();
      setStamp({ bs: toBikramSambatNepali(now), ad: formatAdminDate(now, { time: true }) });
    }, 0);

    return () => clearTimeout(timeout);
  }, []);

  if (!stamp) return null;

  return (
    <span>
      {stamp.bs} · {stamp.ad}
    </span>
  );
}
