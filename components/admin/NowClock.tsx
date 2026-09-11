"use client";

import { useEffect, useState } from "react";
import { formatAdminDate } from "@/lib/format-date";
import { toBikramSambatNepali, toBikramSambatRoman } from "@/lib/bikram-sambat";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * The time, on the screens where work is entered against it.
 *
 * The admin shows a date in thirty-three places and never the clock. That is
 * fine on a report, and thin on the factory board: the person standing there is
 * writing down work that happened at a particular hour, closing a day, and
 * deciding whether "today" still means today. The wall clock in the workshop
 * and the clock the shop records against should be the same one.
 *
 * Kathmandu time, always — the same rule formatAdminDate follows. The server
 * runs five hours forty-five minutes behind, and a screen that quietly showed
 * the server's hour would have the shop closing its day at the wrong moment.
 *
 * It ticks once a minute, not once a second. Seconds on a wall clock are noise,
 * and a component that re-renders sixty times a minute on a workshop phone
 * spends battery to tell nobody anything.
 */
export default function NowClock({ className = "" }: { className?: string }) {
  const { text } = useLanguage();
  // Null until the browser has it. Rendering a time during the server pass
  // would put one clock in the HTML and a different one a moment later, which
  // React reports as a hydration mismatch — and which is, in fact, two answers
  // to the same question.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    // The first reading is scheduled rather than set in the effect body: React
    // treats a synchronous setState there as a cascading render, and the lint
    // rule is right to refuse it. A zero-delay timeout puts it in the next tick
    // instead, which the reader cannot perceive.
    const first = setTimeout(() => setNow(new Date()), 0);

    // Then line up with the top of the next minute and tick each minute, so the
    // displayed time changes when the clock does rather than up to 59 seconds
    // late.
    const timeout = setTimeout(
      () => {
        setNow(new Date());
        interval = setInterval(() => setNow(new Date()), 60_000);
      },
      (60 - new Date().getSeconds()) * 1000,
    );

    return () => {
      clearTimeout(first);
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  if (!now) {
    // The date alone until the browser takes over — never a blank line that
    // shifts the heading when it fills in.
    return <span className={className}>{formatAdminDate(new Date())}</span>;
  }

  const bikram = text(toBikramSambatRoman(now), toBikramSambatNepali(now));

  return (
    <span className={className}>
      <time dateTime={now.toISOString()}>{formatAdminDate(now, { time: true })}</time>
      <span className="text-brand-muted-soft"> · {bikram}</span>
    </span>
  );
}
