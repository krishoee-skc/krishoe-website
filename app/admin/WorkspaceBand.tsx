"use client";

import { usePathname } from "next/navigation";
import { adminWorkspaces, navLinkForPath, workspaceForPath } from "@/app/admin/nav-links";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Which half of the business this screen belongs to, in colour, above the page.
 *
 * The switch in the menu says which side the menu shows; this says which side
 * the page is. The owner once had the factory menu up beside a POS bill and
 * could not tell from the screen which one they were working in. Green for the
 * factory floor, maroon for the shop counter, so the answer is readable from
 * across the room before a word is.
 *
 * Screens that belong to both — the Dashboard, Stock, Settings — get no band:
 * there is no side to name.
 */
export default function WorkspaceBand() {
  const pathname = usePathname() ?? "";
  const { text } = useLanguage();
  const side = workspaceForPath(pathname);
  if (side === "both") return null;

  const workspace = adminWorkspaces.find((option) => option.id === side);
  const link = navLinkForPath(pathname);
  if (!workspace) return null;

  return (
    <div className="px-4 pt-3 sm:px-6 print:hidden">
      <p
        data-workspace={side}
        className={`flex min-h-9 flex-wrap items-center gap-x-2 rounded-lg px-3.5 py-1.5 text-sm font-black text-white ${
          side === "factory" ? "bg-brand-green" : "bg-brand-maroon"
        }`}
      >
        <span>
          <span aria-hidden="true">{workspace.emoji} </span>
          {text(workspace.labelEn, workspace.labelNe)}
        </span>
        {link ? (
          <span className="font-semibold text-white/85">
            <span aria-hidden="true">› </span>
            {text(link.label, link.nepali)}
          </span>
        ) : null}
      </p>
    </div>
  );
}
