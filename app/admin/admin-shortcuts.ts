"use client";

import { useSyncExternalStore } from "react";
import { adminNavLinks, adminSetupLinks, navLinkForPath, type AdminNavLink } from "@/app/admin/nav-links";

/**
 * ★ Favourites and the pages opened last (owner, 2026-10-14, the menu sample):
 * the screens someone opens fifty times a day, at the top of the menu, chosen
 * by them. Kept on the device — a phone and a computer each remember their
 * own — and only ever menu destinations, so a stale or hand-edited entry can
 * never become a link to somewhere that is not a page.
 */
const PINS_KEY = "krishoe-admin-pins";
const RECENT_KEY = "krishoe-admin-recent";
const MAX_PINS = 8;
const MAX_RECENT = 4;
const CHANGED = "krishoe:admin-shortcuts";

const everyLink: AdminNavLink[] = [...adminNavLinks, ...adminSetupLinks];

/** The menu entry for an href, or undefined when it is not one. */
export function shortcutLink(href: string): AdminNavLink | undefined {
  return everyLink.find((link) => link.href === href);
}

function read(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((href): href is string => typeof href === "string" && Boolean(shortcutLink(href))) : [];
  } catch {
    return [];
  }
}

function write(key: string, hrefs: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(hrefs));
  } catch {
    // A private window keeps nothing; the list still changes for this visit.
  }
  cache.delete(key);
  window.dispatchEvent(new Event(CHANGED));
}

// One array per key until it changes, so useSyncExternalStore sees the same
// value between renders.
const cache = new Map<string, string[]>();
const NONE: string[] = [];

function snapshot(key: string) {
  if (typeof window === "undefined") return NONE;
  const cached = cache.get(key);
  if (cached) return cached;
  const fresh = read(key);
  cache.set(key, fresh);
  return fresh;
}

function subscribe(listener: () => void) {
  const onChange = () => {
    cache.clear();
    listener();
  };
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function usePins(): string[] {
  return useSyncExternalStore(subscribe, () => snapshot(PINS_KEY), () => NONE);
}

export function useRecent(): string[] {
  return useSyncExternalStore(subscribe, () => snapshot(RECENT_KEY), () => NONE);
}

/** ★ on, or off again. */
export function togglePin(href: string) {
  if (!shortcutLink(href)) return;
  const pins = read(PINS_KEY);
  write(PINS_KEY, pins.includes(href) ? pins.filter((pin) => pin !== href) : [...pins, href].slice(-MAX_PINS));
}

/**
 * The menu entry a screen sits under — the longest href it starts with, the
 * setup screens included, so /admin/activity is Activity and not the Dashboard
 * every admin path also starts with.
 */
export function shortcutForPath(pathname: string): AdminNavLink | undefined {
  let best: AdminNavLink | undefined = navLinkForPath(pathname);
  for (const link of adminSetupLinks) {
    const matches = pathname === link.href || pathname.startsWith(`${link.href}/`);
    if (matches && link.href.length > (best?.href.length ?? -1)) best = link;
  }
  return best;
}

/** The menu entry a screen sits under, newest first, each once. */
export function rememberVisit(pathname: string) {
  const section = shortcutForPath(pathname)?.href;
  if (!section) return;
  const recent = read(RECENT_KEY);
  if (recent[0] === section) return;
  write(RECENT_KEY, [section, ...recent.filter((href) => href !== section)].slice(0, MAX_RECENT));
}
