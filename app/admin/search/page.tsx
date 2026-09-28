import type { Metadata } from "next";
import Link from "next/link";
import OpenSearchOnArrive from "@/app/admin/search/OpenSearchOnArrive";
import T from "@/components/T";
import { ADMIN_SEARCH_GROUPS, ADMIN_SEARCH_PAGES } from "@/lib/admin-search";

export const metadata: Metadata = {
  title: "Search | KRISHOE Admin",
};

/**
 * Every page of the admin, in four parts — and no search box of its own.
 *
 * This page had a big search box under the small one at the top of every
 * screen, and the owner asked for one (2026-09-28): the top one. Arriving here
 * opens that box; behind it, the page lists every screen by where it belongs,
 * for anyone who would rather look than type.
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
      <h1 className="font-display text-3xl font-black text-brand-green-ink">
        <T en="Every page" ne="सबै पेज" />
      </h1>
      <p className="mt-1 text-sm leading-6 text-brand-muted">
        <T
          en="To find a worker, a shoe, a customer or a bill, use the search box at the top (or press /)."
          ne="कामदार, जुत्ता, ग्राहक वा बिल खोज्न माथिको खोज बक्स प्रयोग गर्नुहोस् (वा / थिच्नुहोस्)।"
        />
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_SEARCH_GROUPS.map((group) => (
          <section key={group.id} className="rounded-xl border border-brand-green-line bg-brand-paper p-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-brand-muted">
              {group.icon} <T en={group.labelEn} ne={group.label} />
            </h2>
            <ul className="mt-2 divide-y divide-brand-green-line">
              {ADMIN_SEARCH_PAGES.filter((page) => page.group === group.id).map((page) => (
                <li key={`${page.href}-${page.title}`}>
                  <Link href={page.href} className="block py-2 hover:text-brand-green">
                    <span className="block text-sm font-bold text-brand-green-ink">
                      <T en={page.titleEn ?? page.title} ne={page.title} />
                    </span>
                    <span className="block text-xs text-brand-muted">
                      <T en={page.detailEn ?? page.detail} ne={page.detail} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
