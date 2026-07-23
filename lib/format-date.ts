import { toBikramSambatNumeric } from "@/lib/bikram-sambat";

// One date format for the whole admin: the English date, then the Bikram Sambat
// date after it, so every bill, list and record reads the way a Nepali reader
// reads a date — no converting in the head. The BS part is plain numbers
// ("B.S 2083/04/07") because that is how the owner reads them fastest. A blank
// or unparseable value comes back empty rather than throwing, and if the BS
// conversion cannot be made the English date still shows on its own.
export function formatAdminDate(value: string | Date, options?: { time?: boolean }): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const ad = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    ...(options?.time ? { timeStyle: "short" as const } : {}),
  }).format(date);

  const bs = toBikramSambatNumeric(date);
  return bs ? `${ad} · B.S ${bs}` : ad;
}
