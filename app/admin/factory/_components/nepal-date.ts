const NEPAL_TIME_ZONE = "Asia/Kathmandu";

const nepalDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: NEPAL_TIME_ZONE,
  calendar: "gregory",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function datePartsInNepal(value: Date) {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError("A valid date is required.");
  }

  const parts = new Map(
    nepalDateFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const year = parts.get("year");
  const month = parts.get("month");
  const day = parts.get("day");

  if (!year || !month || !day) {
    throw new RangeError("Could not determine the Nepal calendar date.");
  }

  return { year, month, day };
}

export function nepalDateKey(value = new Date()) {
  const { year, month, day } = datePartsInNepal(value);
  return `${year}-${month}-${day}`;
}

export function nepalMonthKey(value = new Date()) {
  const { year, month } = datePartsInNepal(value);
  return `${year}-${month}`;
}
