"use client";

import { useSyncExternalStore } from "react";

/**
 * Bills and work kept on this phone while the internet is away (owner,
 * 2026-10-20, rule 4).
 *
 * In Narayangadh the light or the Wi-Fi goes, and a bill or a day's work used
 * to fail with "check the connection" — written on paper and typed again
 * later. Now a new cash bill or a new work entry waits here, with the same key
 * it would have been sent with, and goes when the internet is back. The key is
 * what makes a second send harmless: the bill's sourceSubmissionKey and the
 * work's Idempotency-Key are each kept once by the server, so a bill that did
 * reach the shop before the line dropped is not made twice.
 *
 * Only new things wait: returns, exchanges and credit need the shop's own
 * records at that moment, and are made with the internet.
 *
 * Kept in this browser's storage, so a phone's queue is its own. Nothing here
 * talks to the server; components/admin/OfflineSync.tsx sends.
 */

export type QueueStatus = "waiting" | "needs-you";

type QueuedBase = {
  id: string;
  savedAt: string;
  /** "1 pair · Rs 950", "Ranjita · 60 pairs": what the list says. */
  label: { en: string; ne: string };
  status: QueueStatus;
  /** Why the shop did not take it, when status is needs-you. */
  message?: string;
};

export type QueuedBill = QueuedBase & {
  kind: "bill";
  /** The bill form's fields, as it would have been sent. */
  entries: [string, string][];
  /**
   * The bill as it stood, to open it again on the counter: its key, so a bill
   * that did reach the shop is not made twice, and what was typed on it.
   */
  snapshot: { cart: unknown; channel: string; kind: string; key?: string; bill?: Record<string, unknown> };
};

export type QueuedWork = QueuedBase & {
  kind: "work";
  body: string;
  idempotencyKey: string;
};

export type Queued = QueuedBill | QueuedWork;

export type NewQueued = Omit<QueuedBill, "id" | "savedAt" | "status"> | Omit<QueuedWork, "id" | "savedAt" | "status">;

const STORE_KEY = "krishoe-offline-queue-v1";
const CHANGED = "krishoe:offline-queue";
const EMPTY: Queued[] = [];

let cachedRaw: string | null = null;
let cachedList: Queued[] = EMPTY;

function readRaw() {
  try {
    return window.localStorage.getItem(STORE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function readQueue(): Queued[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = readRaw();
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    cachedList = Array.isArray(parsed) ? (parsed.filter(isQueued) as Queued[]) : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

function isQueued(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Queued>;
  return typeof item.id === "string" && (item.kind === "bill" || item.kind === "work");
}

function writeQueue(list: Queued[]) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    // A private window keeps nothing. The caller is told by the return value.
    return false;
  }
  window.dispatchEvent(new Event(CHANGED));
  return true;
}

/** Keep one more on this phone. False when the browser will not keep it. */
export function enqueue(item: NewQueued): boolean {
  const next = addToQueue(readQueue(), item, new Date().toISOString(), `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  return writeQueue(next);
}

export function removeQueued(id: string) {
  writeQueue(readQueue().filter((item) => item.id !== id));
}

export function holdForYou(id: string, message: string) {
  writeQueue(readQueue().map((item) => (item.id === id ? { ...item, status: "needs-you" as const, message } : item)));
}

/** Back to waiting: the owner asks for one held to be sent again. */
export function waitAgain(id: string) {
  writeQueue(readQueue().map((item) => (item.id === id ? { ...item, status: "waiting" as const, message: undefined } : item)));
}

/** Pure: the queue with one more, waiting, oldest first. */
export function addToQueue(list: Queued[], item: NewQueued, savedAt: string, id: string): Queued[] {
  return [...list, { ...item, id, savedAt, status: "waiting" } as Queued];
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  // Another tab of the admin on the same phone.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useOfflineQueue(): Queued[] {
  return useSyncExternalStore(subscribe, readQueue, () => EMPTY);
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether the browser believes it has a connection. True on the server. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/**
 * A send that never reached the server, as opposed to one the server refused.
 * Only the first kind may wait on the phone: a refusal says something is
 * wrong with the bill, and sending it again later would not change that.
 */
export function isNetworkFailure(error: unknown, online = typeof navigator === "undefined" ? true : navigator.onLine) {
  if (!online) return true;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message);
}

export type SendResult = { ok: true } | { ok: false; message: string };

/**
 * Send what waits, oldest first, one at a time. Stops at the first send that
 * does not reach the server — the internet went again — and leaves the rest.
 * A refusal is held for the owner with its reason; it does not stop the rest.
 */
export async function sendQueue(
  list: Queued[],
  send: (item: Queued) => Promise<SendResult>,
  online: () => boolean = () => true,
): Promise<{ sent: string[]; held: { id: string; message: string }[]; stopped: boolean }> {
  const sent: string[] = [];
  const held: { id: string; message: string }[] = [];
  const waiting = list.filter((item) => item.status === "waiting").sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  for (const item of waiting) {
    let result: SendResult;
    try {
      result = await send(item);
    } catch (error) {
      if (isNetworkFailure(error, online())) return { sent, held, stopped: true };
      held.push({ id: item.id, message: error instanceof Error ? error.message : String(error) });
      continue;
    }
    if (result.ok) sent.push(item.id);
    else held.push({ id: item.id, message: result.message });
  }
  return { sent, held, stopped: false };
}

/** Where the counter finds a held bill to open again. */
export const POS_RESTORE_KEY = "krishoe-pos-restore-v1";
/** Said when one is put there, for a counter already open. */
export const POS_RESTORE_EVENT = "krishoe:pos-restore";
