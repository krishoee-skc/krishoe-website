"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminTrail } from "@/app/admin/AdminTrail";
import { factoryLinks } from "@/app/admin/factory/_components/factory-nav";
import { wagesLinks } from "@/app/admin/operations/production-accounts/_components/wages-nav";
import { adminWorkspaces, navLinkForPath, workspaceForPath } from "@/app/admin/nav-links";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Which half of the business this screen belongs to, in colour, above the page
 * — and where in it you are.
 *
 * The switch in the menu says which side the menu shows; this says which side
 * the page is. Green for the factory floor, maroon for the shop counter, so the
 * answer is readable from across the room before a word is.
 *
 * It is also the trail on these screens. Drawn under a separate "Admin ›
 * Factory › Add work" line, the two said the same thing twice, and on a phone
 * the add-work screen named itself five times before its first box. A sub-page
 * the factory or wages menus name (काम टिप्ने, कामदार, भुक्तानी) is named by
 * that name; anything deeper keeps the section as a link back.
 *
 * Screens that belong to both — the Dashboard, Stock, Settings — get no band:
 * there is no side to name, and AdminTrail draws their path as before.
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

export default function WorkspaceBand() {
  const pathname = usePathname() ?? "";
  const { text } = useLanguage();
  const side = workspaceForPath(pathname);
  if (side === "both") return null;

  const workspace = adminWorkspaces.find((option) => option.id === side);
  if (!workspace) return null;
  const section = navLinkForPath(pathname);
  const sub = subPageFor(pathname);
  // A named sub-page deeper than its menu section: say its name, not both.
  const named = sub && section && sub.href.length > section.href.length ? sub : undefined;
  const deeper = section && !named
    ? adminTrail(pathname).filter((step) => step.href.length > section.href.length)
    : [];

  return (
    <nav aria-label={text("Where you are", "तपाईं कहाँ हुनुहुन्छ")} className="px-4 pt-3 sm:px-6 print:hidden">
      <p
        data-workspace={side}
        className={`mb-0 flex min-h-9 flex-wrap items-center gap-x-2 rounded-lg px-3.5 py-1.5 text-sm font-black leading-6 text-white ${
          side === "factory" ? "bg-brand-green" : "bg-brand-maroon"
        }`}
      >
        <span>
          <span aria-hidden="true">{workspace.emoji} </span>
          {text(workspace.labelEn, workspace.labelNe)}
        </span>
        {named ? (
          <span className="font-semibold text-white/90">
            <span aria-hidden="true">› </span>
            {text(named.en, named.ne)}
          </span>
        ) : section ? (
          <>
            <span className="font-semibold text-white/90">
              <span aria-hidden="true">› </span>
              {deeper.length > 0 ? (
                <Link href={section.href} className="underline-offset-2 hover:underline">
                  {text(section.label, section.nepali)}
                </Link>
              ) : (
                text(section.label, section.nepali)
              )}
            </span>
            {deeper.map((step, index) => (
              <span key={step.href} className="font-semibold text-white/90">
                <span aria-hidden="true">› </span>
                {index === deeper.length - 1 ? (
                  <span aria-current="page">{step.label}</span>
                ) : (
                  <Link href={step.href} className="underline-offset-2 hover:underline">{step.label}</Link>
                )}
              </span>
            ))}
          </>
        ) : null}
      </p>
    </nav>
  );
}
