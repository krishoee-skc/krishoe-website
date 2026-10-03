import { sendPushToStaff } from "@/lib/push-notifications";
import { reportError } from "@/lib/report-error";
import { workerInboxCounts } from "@/lib/worker-portal";

/**
 * A word on the admin phones the moment a worker sends something (owner,
 * 2026-10-03: a photo came and nobody knew). One notification per kind,
 * replaced as more arrive, so ten photos make one line that says ten, not ten
 * buzzes. It tells only; the books still change when the owner presses ✓.
 */

/** Both languages; the Nepali is what is sent. {name}, {n} are filled in. */
const words = {
  photo: { en: "📷 {name}'s work photo", ne: "📷 {name}को कामको फोटो" },
  request: { en: "💬 {name} asks", ne: "💬 {name}को कुरा" },
  pairs: { en: "{n} pairs", ne: "{n} जोडी" },
  advance: { en: "Advance Rs. {n}", ne: "पेस्की Rs. {n}" },
  waiting: { en: "To check: {photos} photo(s), {requests} to answer", ne: "जाँच्न बाँकी: {photos} फोटो, {requests} कुरा" },
};

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));

/** "✅ काम सकियो · 60 जोडी" — what the photo is, from the worker's own choice. */
export function photoLine(icon: string, kindNe: string, pairs: number | null) {
  return `${icon} ${kindNe}${pairs ? ` · ${fill(words.pairs.ne, { n: pairs })}` : ""}`.trim();
}

/** "पेस्की Rs. 2000", or the start of what they wrote. */
export function requestLine(advance: number | null, message: string) {
  return advance ? fill(words.advance.ne, { n: advance }) : message.slice(0, 80);
}

export function workerInboxPush(kind: "photo" | "request", name: string, line: string, waiting: { photos: number; requests: number }) {
  return {
    title: fill(words[kind].ne, { name }),
    body: [line, fill(words.waiting.ne, waiting)].filter(Boolean).join("\n"),
    url: "/admin/factory/photos",
    tag: `worker-inbox-${kind}`,
  };
}

/** Never throws: a phone that cannot be told must not lose the worker's send. */
export async function tellOwnerWorkerSent(kind: "photo" | "request", name: string, line: string) {
  try {
    const waiting = await workerInboxCounts().catch(() => ({ photos: 0, requests: 0 }));
    await sendPushToStaff(workerInboxPush(kind, name, line, waiting));
  } catch (error) {
    reportError(`push a worker's ${kind}`, error);
  }
}
