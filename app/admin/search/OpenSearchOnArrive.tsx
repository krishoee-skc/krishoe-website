"use client";

import { useEffect } from "react";
import { OPEN_SEARCH_EVENT } from "@/app/admin/AdminCommandBar";

/**
 * Opens the one search box, at the top of every admin screen, on arrival.
 *
 * This page had a second search box of its own under that one — two boxes for
 * one job, on the same screen. The menu's "Search", the dashboard tile and old
 * bookmarks still land here, and are handed straight to the top box, with
 * whatever ?q= they carried.
 */
export default function OpenSearchOnArrive({ query }: { query: string }) {
  useEffect(() => {
    // After the top bar has mounted and is listening.
    const id = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT, { detail: { q: query } }));
    }, 50);
    return () => window.clearTimeout(id);
  }, [query]);

  return null;
}
