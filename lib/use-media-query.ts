"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, kept in step as the window changes.
 *
 * useSyncExternalStore, so hydration renders the server's answer (false) and
 * then the real one without a mismatch.
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** A tablet held either way: wider than a phone, narrower than the desktop sidebar. */
export const TABLET_QUERY = "(min-width: 768px) and (max-width: 1023.98px)";
