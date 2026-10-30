"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { PageHead } from "@/components/admin/PageKit";
import { HUB_PAGES, HUBS, type HubId } from "@/app/admin/hubs";
import { usePins } from "@/app/admin/admin-shortcuts";
import { AllPagesIcon, GROUP_COLOURS, hasAllPagesIcon } from "@/app/admin/hub/all-pages-icons";
import { SearchIcon } from "@/components/Icons";

type Props = {
  id: HubId;
  big: string[];
  rest: string[];
  groups: Array<{ en: string; ne: string; pages: string[] }>;
  counts: Record<string, number>;
};

/** What a count on a button stands for, said in words beside the number. */
const WAIT_WORDS: Record<string, (n: number) => { en: string; ne: string }> = {
  "/admin/orders": (n) => ({ en: `${n} not billed yet`, ne: `${n} बिल काट्न बाँकी` }),
  "/admin/cheques": (n) => ({ en: `${n} bounced`, ne: `${n} बाउन्स` }),
  "/admin/dues": (n) => ({ en: `${n} owing over 30 days`, ne: `${n} खाता ३० दिन नाघे` }),
  "/admin/factory/photos": (n) => ({ en: `${n} waiting`, ne: `${n} बाँकी` }),
};

function waitWords(href: string, count: number) {
  const words = WAIT_WORDS[href.split("?")[0]];
  return words ? words(count) : { en: `${count} waiting`, ne: `${count} बाँकी` };
}

/** A count on a button: what waits behind it, as a number and in words. */
function Waiting({ href, count }: { href: string; count: number }) {
  const { text } = useLanguage();
  if (count <= 0) return null;
  const words = waitWords(href, count);
  return (
    <>
      <span aria-hidden="true" className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-brand-clay px-1.5 text-xs font-black text-white">
        {count > 99 ? "99+" : count}
      </span>
      <span className="text-xs font-black text-brand-clay">{text(words.en, words.ne)}</span>
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
      className="relative grid h-full min-h-28 content-center gap-2 rounded-3xl border-2 border-brand-green/40 bg-brand-green-wash p-4 text-brand-green-ink shadow-sm transition hover:-translate-y-0.5 hover:border-brand-green hover:shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-gold dark:text-white"
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-green text-white">
        <Icon className="h-6 w-6" />
      </span>
      <span className="grid leading-tight">
        <span className="text-lg font-black sm:text-xl">{language === "ne" ? page.ne : page.en}</span>
        {language === "ne" ? <span className="text-xs font-bold text-brand-muted">{page.en}</span> : null}
        <Waiting href={href} count={count} />
      </span>
      <span className="sr-only">{text("Open", "खोल्ने")}</span>
    </Link>
  );
}

/** The four at the top of All pages when this phone has no ★ favourites yet. */
const USUAL_FOUR = ["/admin/pos", "/admin/purchasing", "/admin/factory/add-work", "/admin/stock"];

/** A page on All pages: its own drawing in its group's colour, the name under it. */
function GlassTile({ href, colour, count }: { href: string; colour: string; count: number }) {
  const { language, text } = useLanguage();
  const page = HUB_PAGES[href];
  if (!page) return null;
  const Fallback = page.icon;
  const words = count > 0 ? waitWords(href, count) : null;
  return (
    <Link
      href={href}
      className="grid min-h-[76px] min-w-0 content-start justify-items-center gap-1.5 rounded-2xl px-0 py-1.5 text-center text-brand-green-ink transition hover:bg-white/70 focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-gold active:scale-95 motion-reduce:transform-none motion-reduce:transition-none dark:text-white dark:hover:bg-white/10"
    >
      <span className="relative grid h-11 w-11 place-items-center rounded-[14px] text-white shadow-sm" style={{ backgroundColor: colour }}>
        {hasAllPagesIcon(href) ? <AllPagesIcon href={href} className="h-[22px] w-[22px]" /> : <Fallback className="h-[22px] w-[22px]" />}
        {count > 0 ? (
          <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-brand-clay px-1 text-xs font-black text-white dark:border-[#0F1A17]">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </span>
      <span lang={language === "ne" ? "ne" : "en"} className="line-clamp-2 w-full hyphens-auto text-xs font-bold leading-tight tracking-tight [overflow-wrap:anywhere]">{language === "ne" ? page.ne : page.en}</span>
      {words ? <span className="-mt-1 text-xs font-black leading-tight text-brand-clay">{text(words.en, words.ne)}</span> : null}
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
        <Waiting href={href} count={count} />
      </span>
    </Link>
  );
}

export default function HubScreen({ id, big, rest, groups, counts }: Props) {
  const { language, text } = useLanguage();
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
  // The four big buttons on All pages: this phone's ★ favourites first, then
  // the counter's usual four, only ever pages this role may open.
  const pins = usePins();
  const quick = useMemo(() => {
    const open = new Set(groups.flatMap((group) => group.pages));
    return [...new Set([...pins, ...USUAL_FOUR])].filter((href) => open.has(href) && HUB_PAGES[href]).slice(0, 4);
  }, [pins, groups]);
  const label = "text-xs font-black uppercase tracking-[0.14em] text-brand-muted-soft dark:text-white/60";

  return (
    <section className="p-4 sm:p-6">
      <PageHead eyebrow={text("Menu", "मेनु")} title={text(hub.en, hub.ne)} />

      {id === "all" ? (
        // The glass namuna (owner, 2026-10-30, "cha garau"): a soft green-gold
        // ground, the day's four as big buttons, then each group on a pane of
        // its own with every page in its group's colour, four to a row on a
        // phone. The list had read 55 rows of one pale icon.
        <div className="-mx-2 mt-4 grid gap-3 rounded-[28px] p-2 [background:radial-gradient(120%_60%_at_0%_0%,#CDEBDD_0%,transparent_60%),radial-gradient(90%_50%_at_100%_10%,#F6E2B3_0%,transparent_60%),radial-gradient(80%_60%_at_50%_100%,#D7E4F3_0%,transparent_70%),#F5F3EC] sm:mx-0 sm:p-4 dark:[background:radial-gradient(120%_60%_at_0%_0%,#123F31_0%,transparent_60%),radial-gradient(90%_50%_at_100%_10%,#3A2F12_0%,transparent_60%),#0F1A17]">
          <label className="flex h-12 w-full max-w-xl items-center gap-2 rounded-2xl border border-white/90 bg-white/65 px-4 backdrop-blur-md focus-within:border-brand-green dark:border-white/10 dark:bg-white/5">
            <SearchIcon className="h-5 w-5 shrink-0 text-brand-muted" />
            <input
              ref={findBox}
              type="search"
              value={find}
              onChange={(event) => setFind(event.target.value)}
              placeholder={text("Find a page", "page खोज्नुहोस्")}
              aria-label={text("Find a page", "page खोज्नुहोस्")}
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
            />
          </label>
          {!find.trim() && quick.length > 0 ? (
            <div className="grid max-w-xl grid-cols-4 gap-2">
              {quick.map((href) => {
                const page = HUB_PAGES[href];
                const Fallback = page.icon;
                return (
                  <Link
                    key={href}
                    href={href}
                    className="grid min-h-[84px] content-center justify-items-center gap-1.5 rounded-[18px] bg-brand-green px-1 py-3 text-center text-xs font-black leading-tight text-white shadow-[0_8px_18px_-10px_#12634A] transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-gold active:scale-95 motion-reduce:transform-none motion-reduce:transition-none"
                  >
                    {hasAllPagesIcon(href) ? <AllPagesIcon href={href} className="h-6 w-6" /> : <Fallback className="h-6 w-6" />}
                    <span className="line-clamp-2">{language === "ne" ? page.ne : page.en}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
          {shownGroups.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-brand-green-line bg-white/60 p-6 text-center font-semibold text-brand-muted dark:bg-white/5">
              {text("No page by that name.", "त्यो नामको page छैन।")}
            </p>
          ) : (
            shownGroups.map((group) => (
              <div
                key={group.en}
                className="grid gap-2 rounded-[20px] border border-white/90 bg-white/60 p-2 backdrop-blur-md sm:p-2.5 dark:border-white/10 dark:bg-white/5"
              >
                <p className="px-1.5 text-sm font-black text-brand-muted dark:text-white/70">{text(group.en, group.ne)}</p>
                <div className="grid grid-cols-4 gap-x-0.5 gap-y-3 sm:grid-cols-6 sm:gap-x-1 lg:grid-cols-8">
                  {group.pages.map((href) => (
                    <GlassTile key={href} href={href} colour={GROUP_COLOURS[group.en] ?? "#12634A"} count={count(href)} />
                  ))}
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
                {big.map((href, index) => (
                  // An odd count on a phone left the last button alone on its row;
                  // the first spans the row instead (2026-10-29).
                  <div key={href} className={big.length % 2 === 1 && index === 0 ? "col-span-2 sm:col-span-1" : undefined}>
                    <BigButton href={href} count={count(href)} />
                  </div>
                ))}
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
