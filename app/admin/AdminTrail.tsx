"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { workspaceForPath } from "@/app/admin/nav-links";

/**
 * The path a screen was reached by, drawn once for the whole admin.
 *
 * The sidebar marks the section you are in, which answers the question one
 * level down. Below that it stops: a worker's piece history lives at
 * /admin/operations/production-accounts/worker/<id> under a menu that
 * highlights "Operations", and nothing on the page names the two steps
 * between. Seven screens sit that deep, and the only way back up is the
 * browser's own back button — not on the screen, and on a phone a gesture
 * rather than a control.
 */

export type TrailStep = { href: string; label: string };

/**
 * Whether a URL segment is a name or an id.
 *
 * Ids are what the deep screens end in, and an id is not a place: naming one
 * "8f3a-44de" would be worse than silence, and linking it leads to the page
 * you are already on. Recognised by shape rather than by a list, so a new
 * screen ending in an id is handled the day it appears — anything with a digit
 * run, a uuid dash pattern, or no vowels at all is taken as a key, not a word.
 */
function looksLikeAnId(segment: string) {
  if (/\d{3,}/.test(segment)) return true;
  if (/^[0-9a-f]{6,}(-[0-9a-f]+)*$/i.test(segment)) return true;
  return false;
}

/** "production-accounts" is a URL; "Production accounts" is a label. */
function labelFor(segment: string) {
  const words = segment.replace(/-/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The steps to show for a path, outermost first.
 *
 * Empty at the first level. On /admin/stock the trail would say "Stock" under
 * a heading that already says Stock — a line of chrome repeating what is
 * beneath it, on the screens the owner opens most.
 */
export function adminTrail(pathname: string): TrailStep[] {
  const parts = String(pathname ?? "")
    .split("/")
    .filter(Boolean);

  // Anything not under /admin, and /admin itself, has nothing to retrace.
  if (parts[0] !== "admin") return [];

  const steps: TrailStep[] = [];
  let href = "/admin";

  for (const part of parts.slice(1)) {
    href += `/${part}`;
    // An id ends the trail at its parent: the section is a place, the row is
    // not. The href stops there too, so the last step links somewhere real.
    if (looksLikeAnId(part)) break;
    steps.push({ href, label: labelFor(part) });
  }

  // One step is the level the sidebar already marks.
  return steps.length > 1 ? steps : [];
}

export default function AdminTrail() {
  const pathname = usePathname();
  const { text } = useLanguage();
  const steps = adminTrail(pathname ?? "");

  if (steps.length === 0) return null;
  // On a factory or shop screen the coloured band above (WorkspaceBand)
  // carries this path; drawn here too, it said the same thing twice.
  if (workspaceForPath(pathname ?? "") !== "both") return null;

  return (
    <nav
      aria-label={text("Where you are", "तपाईं कहाँ हुनुहुन्छ")}
      className="px-4 pt-3 sm:px-6"
    >
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold text-brand-muted">
        <li>
          <Link href="/admin" className="rounded px-1 py-0.5 hover:text-brand-green-ink hover:underline">
            {text("Admin", "एडमिन")}
          </Link>
        </li>
        {steps.map((step, index) => {
          const isHere = index === steps.length - 1;
          return (
            <li key={step.href} className="flex items-center gap-x-1.5">
              <span aria-hidden="true" className="text-brand-muted-soft">
                ›
              </span>
              {isHere ? (
                // The page you are on is a label, not a link: offering to
                // navigate to where you already stand is a dead control.
                <span aria-current="page" className="font-black text-brand-green-ink">
                  {step.label}
                </span>
              ) : (
                <Link
                  href={step.href}
                  className="rounded px-1 py-0.5 hover:text-brand-green-ink hover:underline"
                >
                  {step.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
