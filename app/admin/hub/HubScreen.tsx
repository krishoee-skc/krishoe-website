"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { PageHead } from "@/components/admin/PageKit";
import { HUB_PAGES, HUBS, type HubId } from "@/app/admin/hubs";

type Props = {
  id: HubId;
  big: string[];
  rest: string[];
  groups: Array<{ en: string; ne: string; pages: string[] }>;
  counts: Record<string, number>;
};

/** A count on a button: what waits behind it (workers' photos). */
function Waiting({ count }: { count: number }) {
  const { text } = useLanguage();
  if (count <= 0) return null;
  return (
    <>
      <span aria-hidden="true" className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-brand-clay px-1.5 text-xs font-black text-white">
        {count > 99 ? "99+" : count}
      </span>
      <span className="sr-only">{text(`${count} waiting`, `${count} बाँकी`)}</span>
    </>
  );
}

function BigButton({ href, count }: { href: string; count: number }) {
  const { language, text } = useLanguage();
  const page = HUB_PAGES[href];
  if (!page) return null;
  const Icon = page.icon;
  return (
    <Link
      href={href}
      className="relative grid min-h-28 content-center gap-2 rounded-3xl border-2 border-brand-green/40 bg-brand-green-wash p-4 text-brand-green-ink shadow-sm transition hover:-translate-y-0.5 hover:border-brand-green hover:shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-gold dark:text-white"
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-green text-white">
        <Icon className="h-6 w-6" />
      </span>
      <span className="grid leading-tight">
        <span className="text-lg font-black sm:text-xl">{language === "ne" ? page.ne : page.en}</span>
        {language === "ne" ? <span className="text-xs font-bold text-brand-muted">{page.en}</span> : null}
      </span>
      <Waiting count={count} />
      <span className="sr-only">{text("Open", "खोल्ने")}</span>
    </Link>
  );
}

function SmallButton({ href, count }: { href: string; count: number }) {
  const { language } = useLanguage();
  const page = HUB_PAGES[href];
  if (!page) return null;
  const Icon = page.icon;
  return (
    <Link
      href={href}
      className="relative flex min-h-16 items-center gap-3 rounded-2xl border border-brand-green-line bg-brand-paper px-3 py-2 text-brand-green-ink transition hover:border-brand-green focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-gold dark:text-white"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-mist text-brand-green dark:bg-white/10 dark:text-[#6FD3A8]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="grid min-w-0 leading-tight">
        <span className="truncate font-black">{language === "ne" ? page.ne : page.en}</span>
        {language === "ne" ? <span className="truncate text-xs font-semibold text-brand-muted">{page.en}</span> : null}
      </span>
      <Waiting count={count} />
    </Link>
  );
}

export default function HubScreen({ id, big, rest, groups, counts }: Props) {
  const { text } = useLanguage();
  const hub = HUBS.find((h) => h.id === id)!;
  const [find, setFind] = useState("");
  // Letters typed before the page came alive stay in the box; read them once
  // it has, or the list would ignore them until the next key.
  const findBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const typed = findBox.current?.value ?? "";
    if (typed) setFind(typed);
  }, []);
  const shownGroups = useMemo(() => {
    const words = find.trim().toLowerCase();
    if (!words) return groups;
    return groups
      .map((group) => ({
        ...group,
        pages: group.pages.filter((href) => {
          const page = HUB_PAGES[href];
          return page && (page.en.toLowerCase().includes(words) || page.ne.includes(find.trim()));
        }),
      }))
      .filter((group) => group.pages.length > 0);
  }, [find, groups]);
  const count = (href: string) => counts[href.split("?")[0]] ?? 0;
  const label = "text-xs font-black uppercase tracking-[0.14em] text-brand-muted-soft dark:text-white/60";

  return (
    <section className="p-4 sm:p-6">
      <PageHead eyebrow={text("Menu", "मेनु")} title={text(hub.en, hub.ne)} />

      {id === "all" ? (
        <div className="mt-4 grid gap-5">
          <input
            ref={findBox}
            type="search"
            value={find}
            onChange={(event) => setFind(event.target.value)}
            placeholder={text("Find a page", "page खोज्नुहोस्")}
            aria-label={text("Find a page", "page खोज्नुहोस्")}
            className="h-12 w-full max-w-xl rounded-2xl border border-brand-green-line bg-brand-paper px-4 text-base outline-none focus:border-brand-green"
          />
          {shownGroups.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-brand-green-line p-6 text-center font-semibold text-brand-muted">
              {text("No page by that name.", "त्यो नामको page छैन।")}
            </p>
          ) : (
            shownGroups.map((group) => (
              <div key={group.en} className="grid gap-2">
                <p className={label}>{text(group.en, group.ne)}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.pages.map((href) => <SmallButton key={href} href={href} count={count(href)} />)}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-5">
          {big.length > 0 ? (
            <div className="grid gap-2">
              {id === "home" ? <p className={label}>{text("Today's work", "आजको काम")}</p> : null}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {big.map((href) => <BigButton key={href} href={href} count={count(href)} />)}
              </div>
            </div>
          ) : null}
          {rest.length > 0 ? (
            <div className="grid gap-2">
              <p className={label}>{text("More", "थप")}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rest.map((href) => <SmallButton key={href} href={href} count={count(href)} />)}
              </div>
            </div>
          ) : null}
          {big.length === 0 && rest.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-brand-green-line p-6 text-center font-semibold text-brand-muted">
              {text("Nothing here is open to your role.", "यहाँका page तपाईंको role लाई खुला छैनन्।")}
            </p>
          ) : null}
          <Link href="/admin/hub/all" className="justify-self-start text-sm font-black text-brand-green underline underline-offset-4">
            {text("All pages →", "सबै page →")}
          </Link>
        </div>
      )}
    </section>
  );
}
