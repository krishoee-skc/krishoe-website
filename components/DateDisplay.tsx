"use client";

import { formatAdminDate } from "@/lib/format-date";
import { toBikramSambatNumeric, toBikramSambatNepali, toBikramSambatRoman } from "@/lib/bikram-sambat";

export type DateFormat = "short" | "verbose" | "nepali" | "roman" | "admin";

interface DateDisplayProps {
  date: Date | string;
  format?: DateFormat;
  separator?: string;
  className?: string;
  time?: boolean;
}

/**
 * Bilingual Date Display Component
 * Shows both English and Nepali dates side by side
 * Uses nepali-date-converter library for accuracy
 *
 * @example
 * <DateDisplay date={new Date()} /> // "Aug 7, 2026 · B.S 2083/04/22"
 * <DateDisplay date={new Date()} format="verbose" /> // "07 Shrawan 2083"
 * <DateDisplay date={new Date()} format="nepali" /> // "०७ श्रावण २०८३"
 */
export default function DateDisplay({
  date,
  format = "admin",
  separator = " · ",
  className = "",
  time = false,
}: DateDisplayProps) {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (Number.isNaN(dateObj.getTime())) {
    return <span className={className}>Invalid date</span>;
  }

  let displayText = "";

  switch (format) {
    case "nepali":
      displayText = toBikramSambatNepali(dateObj);
      break;

    case "roman":
      displayText = toBikramSambatRoman(dateObj);
      break;

    case "verbose":
      const ad = new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: time ? "short" : undefined,
      }).format(dateObj);
      const bs = toBikramSambatRoman(dateObj);
      displayText = `${ad}${separator}${bs}`;
      break;

    case "short":
      const adShort = new Intl.DateTimeFormat("en-IN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(dateObj);
      const bsShort = toBikramSambatNumeric(dateObj);
      displayText = `${adShort}${separator}${bsShort}`;
      break;

    case "admin":
    default:
      displayText = formatAdminDate(dateObj, { time });
      break;
  }

  return (
    <span className={className}>
      {displayText}
    </span>
  );
}

/**
 * Just the Nepali date (B.S. numeric format)
 */
export function DateDisplayNepaliOnly({
  date,
  className = "",
}: Omit<DateDisplayProps, "format" | "separator" | "time">) {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const formatted = toBikramSambatNumeric(dateObj);
  return <span className={className}>{formatted}</span>;
}

/**
 * Standard admin format: "Aug 7, 2026 · B.S 2083/04/22"
 */
export function DateDisplayAdmin({
  date,
  time = false,
  className = "",
}: Omit<DateDisplayProps, "format" | "separator">) {
  return <DateDisplay date={date} format="admin" time={time} className={className} />;
}

/**
 * Verbose format: "07 Shrawan 2083 · Aug 7, 2026"
 */
export function DateDisplayVerbose({
  date,
  time = false,
  className = "",
}: Omit<DateDisplayProps, "format" | "separator">) {
  return <DateDisplay date={date} format="verbose" time={time} className={className} />;
}

/**
 * Nepali script: "०७ श्रावण २०८३"
 */
export function DateDisplayNepaliScript({
  date,
  className = "",
}: Omit<DateDisplayProps, "format" | "separator" | "time">) {
  return <DateDisplay date={date} format="nepali" className={className} />;
}

/**
 * Roman format: "07 Shrawan 2083"
 */
export function DateDisplayRoman({
  date,
  className = "",
}: Omit<DateDisplayProps, "format" | "separator" | "time">) {
  return <DateDisplay date={date} format="roman" className={className} />;
}
