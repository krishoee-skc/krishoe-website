import type { Metadata } from "next";
import OpenSearchOnArrive from "@/app/admin/search/OpenSearchOnArrive";
import T from "@/components/T";

export const metadata: Metadata = {
  title: "Search | KRISHOE Admin",
};

/**
 * The one search box, opened — and nothing else.
 *
 * This page had a second search box, and then a list of every page, both of
 * which read as clutter (2026-09-28). Old links and bookmarks that land here
 * open the box at the top of the screen, with whatever ?q= they carried; the
 * menu's "Search" opens that box without coming here at all.
 */
export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const query = ((await searchParams)?.q ?? "").trim();

  return (
    <section className="p-6">
      <OpenSearchOnArrive query={query} />
      <p className="text-sm text-brand-muted">
        <T en="Search is the box at the top of every screen (or press /)." ne="खोज्ने बक्स हरेक पेजको माथि छ (वा / थिच्नुहोस्)।" />
      </p>
    </section>
  );
}
