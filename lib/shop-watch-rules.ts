/**
 * How the monitoring screen reads what it finds, kept pure so the screen and
 * its tests agree (owner, 2026-09-30: the page said "Nothing needs attention"
 * while a customer's order mail had been refused and the outside check had
 * been silent for three days).
 */

export type ErrorKind = "broke" | "refused" | "browser";

/**
 * What a logged problem was.
 *
 *  - "browser": a shopper's browser blocked something by the page's security
 *    rule (Google Translate, an extension) — nothing on the shop failed.
 *  - "refused": the shop's own rule turned an entry down, as it should — "bantu
 *    hill wholesale minimum order is 6 pairs" was logged as an error twice.
 *  - "broke": everything else — something that should have worked did not.
 */
export function errorKind(entry: { level: string; message: string }): ErrorKind {
  const message = entry.message ?? "";
  if (/^CSP blocked /i.test(message)) return "browser";
  if (
    /minimum order is \d+ pairs|Cannot bill|not enough (stock|pairs)|only \d+ (pair|left)|is required|must be (greater|at least|above)|already (saved|exists|on the books)|Choose |Type the /i.test(
      message,
    )
  ) {
    return "refused";
  }
  return entry.level === "warning" ? "browser" : "broke";
}

/** A logged failure that is a customer's mail not going out. */
export function isCustomerMailFailure(message: string) {
  return /^(confirm order .* to the customer|deliver order confirmation|deliver review request|send review request) /i.test(message ?? "");
}

export type Freshness = "fresh" | "late" | "stale" | "never";

/**
 * How recent the last outside check is. The checker files a few readings a
 * day when all is well, so three hours without one is late and a day is
 * stopped — "100%" over a check that stopped on the 27th was not news.
 */
export function outsideCheckFreshness(lastCheckAt: string | null, now = Date.now()): Freshness {
  if (!lastCheckAt) return "never";
  const hours = (now - Date.parse(lastCheckAt)) / 3_600_000;
  if (!Number.isFinite(hours)) return "never";
  if (hours >= 24) return "stale";
  if (hours >= 3) return "late";
  return "fresh";
}

export type WatchItem = { key: string; en: string; ne: string; href?: string };

/** What needs doing, most urgent first — the red strip at the top of the screen. */
export function thingsToDo(watch: {
  notificationKindsMissing: string[];
  customerMailFailures7d: number;
  outsideCheck: Freshness;
  brokeIn7d: number;
}): WatchItem[] {
  const items: WatchItem[] = [];
  if (watch.notificationKindsMissing.length > 0) {
    items.push({
      key: "notification-kinds",
      en: "Customers are not getting their order mail. Put the rule right in Settings.",
      ne: "ग्राहकलाई अर्डरको email गइरहेको छैन। Settings मा नियम मिलाउनुहोस्।",
      href: "/admin/settings#notification-types",
    });
  } else if (watch.customerMailFailures7d > 0) {
    items.push({
      key: "customer-mail",
      en: `${watch.customerMailFailures7d} customer mail(s) failed in 7 days. See the list below.`,
      ne: `७ दिनमा ${watch.customerMailFailures7d} ग्राहक email पठाउन सकिएन। तलको सूची हेर्नुहोस्।`,
    });
  }
  if (watch.outsideCheck === "stale" || watch.outsideCheck === "never") {
    items.push({
      key: "outside-check",
      en: "The outside check has stopped: if the shop went down, nobody would be told. Look at GitHub → Actions → Uptime.",
      ne: "बाहिरबाट हुने जाँच रोकिएको छ: पसल बन्द भए कसैलाई थाहा हुँदैन। GitHub → Actions → Uptime हेर्नुहोस्।",
    });
  }
  if (watch.brokeIn7d > 0) {
    items.push({
      key: "broke",
      en: `${watch.brokeIn7d} thing(s) broke in 7 days. See the list below.`,
      ne: `७ दिनमा ${watch.brokeIn7d} कुरा बिग्रियो। तलको सूची हेर्नुहोस्।`,
    });
  }
  return items;
}
