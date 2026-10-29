"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { adminTrail } from "@/app/admin/AdminTrail";
import { rememberVisit, shortcutForPath, togglePin, usePins } from "@/app/admin/admin-shortcuts";
import { factoryLinks } from "@/app/admin/factory/_components/factory-nav";
import { wagesLinks } from "@/app/admin/operations/production-accounts/_components/wages-nav";
import { adminWorkspaces, workspaceForPath } from "@/app/admin/nav-links";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Which half of the business this screen belongs to, and where in it you are —
 * now the left of the one top bar (owner, 2026-10-14, the menu sample).
 *
 * It was a 48px green or maroon band of its own under the search row; on a
 * phone the bar, the search and the band took 164px before a page began. The
 * colour is now a 3px line along the top of the bar — green for the factory
 * floor, maroon for the shop counter; a screen of both sides takes the brand's
 * gold and names no side (2026-10-29: with the side switch gone there is no
 * side "on show" to borrow) — and the
 * words are the page's name, large, with the side above it small.
 *
 * It is also the trail on these screens: a sub-page the factory or wages
 * menus name (काम टिप्ने, कामदार, भुक्तानी) is named by that name, anything
 * deeper by its last step, and the section stays a link back. ☆ beside the
 * name puts the screen in the menu's ★ favourites.
 */

type Named = { href: string; en: string; ne: string };

const subPages: Named[] = [
  ...factoryLinks.map((link) => ({ href: link.href, en: link.english, ne: link.label })),
  ...wagesLinks.map((link) => ({ href: link.href, en: link.en, ne: link.ne })),
];

function subPageFor(pathname: string): Named | undefined {
  let best: Named | undefined;
  for (const page of subPages) {
    const matches = pathname === page.href || pathname.startsWith(`${page.href}/`);
    if (matches && page.href.length > (best?.href.length ?? -1)) best = page;
  }
  return best;
}

const lineColour = { factory: "bg-brand-green", shop: "bg-brand-maroon", both: "bg-brand-gold" } as const;

export default function WorkspaceBand() {
  const pathname = usePathname() ?? "";
  const { text } = useLanguage();
  const pins = usePins();

  // The pages opened last, for the phone menu's "opened lately".
  useEffect(() => {
    rememberVisit(pathname);
  }, [pathname]);

  // A screen of both sides (Stock, Settings, the Dashboard, the five menu-name
  // pages) names no side: "KRISHOE › Settings" (owner, 2026-10-29). It used to
  // borrow the side the menu showed; the simple menu has no side to show, so the
  // name stuck on whichever side was seen last.
  const side = workspaceForPath(pathname);
  const workspace = side === "both" ? undefined : adminWorkspaces.find((option) => option.id === side);
  const section = shortcutForPath(pathname);
  const sub = subPageFor(pathname);
  // A named sub-page deeper than its menu section: say its name, not both.
  const named = sub && section && sub.href.length > section.href.length ? sub : undefined;
  const deeper = section && !named
    ? adminTrail(pathname).filter((step) => step.href.length > section.href.length)
    : [];
  const sectionName = section ? text(section.label, section.nepali) : "";
  const title = named ? text(named.en, named.ne) : deeper.at(-1)?.label ?? (sectionName || "KRISHOE");
  const titleIsSection = !named && deeper.length === 0;
  const pinned = section ? pins.includes(section.href) : false;

  return (
    <>
      <span aria-hidden="true" data-workspace={side} className={`absolute inset-x-0 top-0 h-[3px] ${lineColour[side]}`} />
      <nav
        data-admin-chrome
        aria-label={text("Where you are", "तपाईं कहाँ हुनुहुन्छ")}
        className="flex min-w-0 flex-1 items-center gap-1 md:flex-none md:max-w-[45%] print:hidden"
      >
        <span className="grid min-w-0 leading-tight">
          <span className="flex min-w-0 items-center gap-1 truncate text-xs font-black text-brand-green dark:text-[#6FD3A8] lg:text-[0.8125rem]">
            {workspace ? (
              <span className="shrink-0"><span aria-hidden="true">{workspace.emoji} </span>{text(workspace.labelEn, workspace.labelNe)}</span>
            ) : (
              <span className="shrink-0 text-brand-gold-deep">KRISHOE</span>
            )}
            {!titleIsSection && section ? (
              <span className="truncate font-bold text-brand-muted">
                <span aria-hidden="true">› </span>
                <Link href={section.href} className="underline-offset-2 hover:underline">{sectionName}</Link>
              </span>
            ) : workspace && section ? (
              <span aria-hidden="true" className="text-brand-muted">›</span>
            ) : null}
            {deeper.length > 1 ? deeper.slice(0, -1).map((step) => (
              <span key={step.href} className="hidden truncate font-bold text-brand-muted lg:inline">
                <span aria-hidden="true">› </span>
                <Link href={step.href} className="underline-offset-2 hover:underline">{step.label}</Link>
              </span>
            )) : null}
          </span>
          <span aria-current="page" className="truncate text-[1.1875rem] font-black text-brand-green-ink dark:text-white lg:text-2xl">
            {title}
          </span>
        </span>
        {section ? (
          <button
            type="button"
            onClick={() => togglePin(section.href)}
            aria-pressed={pinned}
            aria-label={pinned ? text(`Remove ${section.label} from favourites`, `${section.nepali} मनपर्नेबाट हटाउने`) : text(`Add ${section.label} to favourites`, `${section.nepali} मनपर्नेमा राख्ने`)}
            title={pinned ? text("In your ★ favourites", "★ मनपर्नेमा छ") : text("Add to ★ favourites", "★ मनपर्नेमा राख्ने")}
            className={`hidden h-11 w-11 shrink-0 place-items-center rounded-xl text-xl md:grid ${pinned ? "text-brand-gold-deep" : "text-brand-muted-soft hover:text-brand-gold-deep"}`}
          >
            {pinned ? "★" : "☆"}
          </button>
        ) : null}
      </nav>
    </>
  );
}
