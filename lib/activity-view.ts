import type { AdminAuditEvent } from "@/lib/admin-audit";

/**
 * How the activity page reads the audit trail, kept pure so the page and its
 * tests agree (owner, 2026-09-30). The trail itself is untouched: every row is
 * kept; this only decides how a row is said, which rows sit together, and
 * which the plain view leaves folded.
 *
 * The page used to be a seven-column English table — "Pos Create Invoice",
 * "Nightly Daily-production", an audit ID on every row — where a night's six
 * routine jobs, twice, sat among the bills.
 */

export type ActivityKind = "sale" | "goods" | "orders" | "security" | "settings" | "factory" | "nightly" | "other";

export const activityKinds: Array<{ kind: ActivityKind; en: string; ne: string }> = [
  { kind: "sale", en: "Selling", ne: "बिक्री" },
  { kind: "goods", en: "Goods & stock", ne: "माल र स्टक" },
  { kind: "orders", en: "Orders", ne: "अर्डर" },
  { kind: "security", en: "Security", ne: "सुरक्षा" },
  { kind: "settings", en: "Settings & backup", ne: "सेटिङ र backup" },
  { kind: "factory", en: "Factory", ne: "कारखाना" },
  { kind: "nightly", en: "Evening jobs", ne: "रातिका काम" },
  { kind: "other", en: "Other", ne: "अरू" },
];

export function activityKind(action: string): ActivityKind {
  const a = action.toLowerCase();
  if (a.startsWith("nightly_")) return "nightly";
  // Before the word checks below: "settings_database_cheques_ready" is a
  // setting, not a sale, though it says "cheque".
  if (a.startsWith("settings") || a.startsWith("backup")) return "settings";
  if (a.startsWith("pos_") || a.includes("cheque") || a.startsWith("ledger_") || a.startsWith("payment_")) return "sale";
  if (a.startsWith("order_") || a.startsWith("customer_")) return "orders";
  if (a.startsWith("counter_item") || a.startsWith("stock_") || a.startsWith("product") || a.startsWith("purchase")) return "goods";
  if (a.startsWith("login") || a.startsWith("passkey") || a.startsWith("staff") || a.startsWith("device") || a.includes("mfa") || a.startsWith("security") || a.startsWith("bootstrap")) return "security";
  if (a.startsWith("settings") || a.startsWith("backup")) return "settings";
  if (a.startsWith("factory") || a.startsWith("operations") || a.startsWith("production") || a.startsWith("worker")) return "factory";
  return "other";
}

/**
 * Left out of the plain view (and always shown under "Everything"): what
 * happens on its own and says nothing new — the code sent before a sign-in
 * (the sign-in itself is shown), and an order list exported for a download.
 * Evening jobs are not hidden but folded into one line per evening.
 */
export function isRoutine(event: Pick<AdminAuditEvent, "action" | "status">) {
  if (event.status === "warning") return false;
  const a = event.action.toLowerCase();
  return a === "login_mfa_challenge" || a === "order_export" || a === "order_conversion_export";
}

const money = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : value;
};

export type Said = { icon: string; en: string; ne: string };

function prettyAction(action: string) {
  return action
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** One row in a line a shopkeeper reads — the bill, the goods, the login. */
export function sayEvent(event: Pick<AdminAuditEvent, "action" | "detail">): Said {
  const a = event.action.toLowerCase();
  const d = event.detail ?? "";
  let m: RegExpMatchArray | null;

  if (a === "pos_create_invoice" && (m = d.match(/^(\S+) (sale|return) invoice recorded for Rs\. ([\d.]+)/i))) {
    return m[2].toLowerCase() === "return"
      ? { icon: "↩️", en: `${m[1]} return · Rs. ${money(m[3])}`, ne: `${m[1]} फिर्ता · रु. ${money(m[3])}` }
      : { icon: "🧾", en: `${m[1]} bill · Rs. ${money(m[3])}`, ne: `${m[1]} बिल · रु. ${money(m[3])}` };
  }
  if (a === "counter_item_added" && (m = d.match(/^(.+?) \((KR-[^)]+)\) added from the (?:(retail|wholesale) )?counter: (\d+) pairs/i))) {
    return { icon: "＋", en: `New goods: ${m[1]} · ${m[4]} pairs`, ne: `नयाँ माल: ${m[1]} · ${m[4]} जोडी` };
  }
  if (a === "counter_item_reviewed") return { icon: "✓", en: "New goods looked at and marked right", ne: "नयाँ माल हेरेर ठीक भनियो" };
  if (a === "pos_cheque_marked" && (m = d.match(/^Cheque on (\S+) .*?Rs\. ([\d.]+)\) marked (\w+)/i))) {
    const states: Record<string, { en: string; ne: string }> = {
      cleared: { en: "bank paid", ne: "साटियो" },
      bounced: { en: "bounced", ne: "बाउन्स भयो" },
      recovered: { en: "money collected", ne: "रकम उठ्यो" },
    };
    const state = states[m[3].toLowerCase()] ?? { en: m[3], ne: m[3] };
    return { icon: "🏦", en: `Cheque on ${m[1]} · Rs. ${money(m[2])} · ${state.en}`, ne: `चेक ${m[1]} · रु. ${money(m[2])} · ${state.ne}` };
  }
  if (a === "login_success") return { icon: "🔓", en: "Signed in", ne: "Login ✓" };
  if (a === "login_failed") return { icon: "🔐", en: "Sign-in refused", ne: "Login भएन (password वा email मिलेन)" };
  if (a === "login_mfa_challenge") return { icon: "✉️", en: "Sign-in code sent", ne: "Login कोड पठाइयो" };
  if (a === "passkey_registered") return { icon: "🔑", en: "Passkey added", ne: "Passkey दर्ता भयो" };
  if (a === "passkey_removed") return { icon: "🔑", en: "Passkey removed", ne: "Passkey हटाइयो" };
  if (a === "stock_place_count" && (m = d.match(/^(.+?) counted at (Shop|Factory): (\d+) pairs/i))) {
    return { icon: "🔢", en: `Counted: ${m[1]} · ${m[2]} ${m[3]} pairs`, ne: `गन्ती: ${m[1]} · ${m[2] === "Shop" ? "पसल" : "कारखाना"} ${m[3]} जोडी` };
  }
  if (a.startsWith("settings_database_")) return { icon: "⚙️", en: "Database prepared from Settings", ne: "Settings बाट database तयार गरियो" };
  if (a === "backup_export") return { icon: "💾", en: "Backup downloaded", ne: "Backup डाउनलोड गरियो" };
  if (a === "order_export" || a === "order_conversion_export") return { icon: "📄", en: "Orders exported", ne: "अर्डर export गरियो" };
  if (a.startsWith("order_")) return { icon: "📦", en: prettyAction(a), ne: `अर्डर: ${prettyAction(a.replace(/^order_/, ""))}` };
  if (a.startsWith("product")) return { icon: "👟", en: prettyAction(a), ne: `जुत्ता: ${prettyAction(a.replace(/^products?_/, ""))}` };
  if (a.startsWith("factory") || a.startsWith("operations")) return { icon: "🏭", en: prettyAction(a), ne: `कारखाना: ${prettyAction(a.replace(/^(factory|operations)_/, ""))}` };
  return { icon: "•", en: prettyAction(a), ne: prettyAction(a) };
}

export type ActivityLine = {
  key: string;
  /** Newest time in the line. */
  at: string;
  said: Said;
  /** The rows in it — more than one when repeats or an evening's jobs were folded together. */
  events: AdminAuditEvent[];
  warning: boolean;
  /** An evening's jobs: all ran, or some failed. */
  nightly?: { ran: number; failed: number };
};

const MINUTE = 60_000;
const at = (event: AdminAuditEvent) => Date.parse(event.createdAt);

/**
 * Rows made into lines, newest first. An evening's jobs within ten minutes are
 * one line ("6 evening jobs ran ✓", or which failed); the same action by the
 * same person within two minutes is one line with a count — four goods marked
 * right read as four rows before.
 */
export function activityLines(events: AdminAuditEvent[]): ActivityLine[] {
  const sorted = [...events].sort((left, right) => at(right) - at(left));
  const lines: ActivityLine[] = [];
  for (const event of sorted) {
    const last = lines[lines.length - 1];
    const lastEvent = last?.events[last.events.length - 1];
    const close = (minutes: number) => lastEvent && at(lastEvent) - at(event) <= minutes * MINUTE;
    if (activityKind(event.action) === "nightly") {
      if (last?.nightly && close(10)) {
        last.events.push(event);
        last.nightly.ran += 1;
        if (event.status === "warning" || /^failed/i.test(event.detail)) last.nightly.failed += 1;
        last.warning = last.nightly.failed > 0;
        continue;
      }
      const failed = event.status === "warning" || /^failed/i.test(event.detail) ? 1 : 0;
      lines.push({ key: event.id, at: event.createdAt, said: { icon: "🌙", en: "", ne: "" }, events: [event], warning: failed > 0, nightly: { ran: 1, failed } });
      continue;
    }
    if (
      last &&
      !last.nightly &&
      lastEvent &&
      lastEvent.action === event.action &&
      lastEvent.actorEmail === event.actorEmail &&
      lastEvent.status === event.status &&
      close(2) &&
      !/^pos_create_invoice$|^counter_item_added$/.test(event.action)
    ) {
      last.events.push(event);
      continue;
    }
    lines.push({ key: event.id, at: event.createdAt, said: sayEvent(event), events: [event], warning: event.status === "warning" });
  }
  for (const line of lines) {
    if (line.nightly) {
      const { ran, failed } = line.nightly;
      line.said = failed
        ? { icon: "🌙", en: `Evening jobs: ${failed} of ${ran} failed`, ne: `रातिका काम: ${ran} मध्ये ${failed} असफल` }
        : { icon: "🌙", en: `${ran} evening jobs ran ✓`, ne: `रातिका ${ran} काम ठीक चले ✓` };
    } else if (line.events.length > 1) {
      line.said = { ...line.said, en: `${line.said.en} ×${line.events.length}`, ne: `${line.said.ne} ×${line.events.length}` };
    }
  }
  return lines;
}

/** Kathmandu calendar day of an instant, as YYYY-MM-DD. */
export function kathmanduDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date(iso));
}

/** Lines grouped by Kathmandu day, newest day first. */
export function linesByDay(lines: ActivityLine[]) {
  const days: Array<{ day: string; lines: ActivityLine[] }> = [];
  for (const line of lines) {
    const day = kathmanduDay(line.at);
    const last = days[days.length - 1];
    if (last && last.day === day) last.lines.push(line);
    else days.push({ day, lines: [line] });
  }
  return days;
}

export type ExplainedWarning = { event: AdminAuditEvent; en: string; ne: string; worry: boolean };

/**
 * What a warning was, in words, and whether it is worth a worry. A failed
 * sign-in followed within ten minutes by a sign-in that worked is a typing
 * slip, not an attack — "Login Failed" three times, unexplained, read as one.
 */
export function explainWarnings(warnings: AdminAuditEvent[], all: AdminAuditEvent[]): ExplainedWarning[] {
  const successes = all.filter((event) => event.action === "login_success");
  return warnings.map((event) => {
    const a = event.action.toLowerCase();
    if (a === "login_failed") {
      const after = successes
        .filter((ok) => at(ok) >= at(event) && at(ok) - at(event) <= 10 * MINUTE)
        .sort((left, right) => at(left) - at(right))[0];
      if (after) {
        const minutes = Math.max(1, Math.round((at(after) - at(event)) / MINUTE));
        const sameEmail = (after.actorEmail || "").toLowerCase() === (event.actorEmail || "").toLowerCase();
        return sameEmail
          ? { event, worry: false, en: `Wrong password, then signed in ${minutes} min later — a typing slip.`, ne: `Password गलत, अनि ${minutes} मिनेटमा login ✓ — टाइप गल्ती जस्तो।` }
          : { event, worry: false, en: `Mistyped email "${event.actorEmail}", then signed in with the right one ${minutes} min later.`, ne: `गलत email "${event.actorEmail}", अनि ${minutes} मिनेटमा सही email ले login ✓।` };
      }
      return { event, worry: true, en: "A sign-in was refused and nobody signed in after it. If it was not you, look.", ne: "Login भएन र त्यसपछि कसैले login गरेन। तपाईं होइन भने हेर्नुहोस्।" };
    }
    if (a === "login_rate_limited") {
      return { event, worry: true, en: "Sign-in paused after repeated wrong passwords.", ne: "धेरै पटक गलत password भएकाले login केही बेर रोकियो।" };
    }
    if (a === "passkey_removed") {
      const self = (event.actorEmail || "") !== "";
      return { event, worry: !self, en: "A passkey was removed from the account's own sign-in.", ne: "Passkey हटाइयो — आफ्नै खाताबाट।" };
    }
    if (a === "product_ai_draft" && /\b50[023]\b/.test(event.detail)) {
      return { event, worry: false, en: "The AI description was not made: Google's side was busy.", ne: "AI विवरण बनेन — Google तर्फको समस्या, हाम्रो होइन।" };
    }
    return { event, worry: true, en: event.detail, ne: event.detail };
  });
}
