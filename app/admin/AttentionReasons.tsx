"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import type { SelfCheck } from "@/lib/shop-self-check";
import { clearUnbackedRatingsAction } from "@/app/admin/products/actions";

/**
 * Why the menu marked this page, said on the page.
 *
 * The menu puts a dot on a link when a self-check points at it, but the page
 * it opened said nothing: the owner opened Customer Voice, found every count
 * at 0 and no reason for the dot (2026-09-29). Now the checks that marked this
 * page show at its top, in words, with the way to put them right.
 *
 * The same rule the dot follows (app/admin/nav-attention.ts): a check marks
 * every link above its screen, so it is told here on each of them. Not on the
 * dashboard, which every check sits under — that would repeat the whole alerts
 * list at the top of the home screen — nor on /admin/alerts, which is that list.
 */
export type AttentionReason = Pick<
  SelfCheck,
  "id" | "severity" | "title" | "titleNe" | "detail" | "detailNe" | "href" | "action" | "actionNe"
>;

function marksThisPage(checkHref: string, pathname: string) {
  const page = pathname.replace(/\/+$/, "");
  if (page === "/admin" || page === "/admin/alerts") return false;
  return checkHref === page || checkHref.startsWith(`${page}/`);
}

const tone: Record<AttentionReason["severity"], string> = {
  critical: "border-brand-clay/40 bg-brand-clay-tint text-brand-clay",
  warning: "border-brand-gold/50 bg-brand-cream-soft text-brand-gold-ink",
  info: "border-brand-green-line bg-brand-green-wash text-brand-green-ink",
};

export default function AttentionReasons({ checks }: { checks: AttentionReason[] }) {
  const pathname = usePathname();
  const { text } = useLanguage();
  const here = checks.filter((check) => marksThisPage(check.href, pathname));
  if (here.length === 0) return null;

  return (
    <div className="grid gap-2 px-4 pt-3 sm:px-6 print:hidden" role="status">
      {here.map((check) => (
        <div key={check.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-2.5 ${tone[check.severity]}`}>
          <p className="min-w-0 flex-1 text-sm font-bold">
            <span aria-hidden="true">{check.severity === "critical" ? "⛔ " : check.severity === "warning" ? "⚠ " : "ℹ "}</span>
            {text(check.title, check.titleNe)}
            <span className="block text-[13px] font-semibold opacity-85">{text(check.detail, check.detailNe)}</span>
          </p>
          {/* The stars are cleared from here in one press, rather than shoe
              by shoe in the product form. */}
          {check.id === "rating-without-reviews" && pathname.replace(/\/+$/, "") === "/admin/products" ? (
            <form action={clearUnbackedRatingsAction} className="shrink-0">
              <button type="submit" className="min-h-10 rounded-lg bg-brand-gold-deep px-4 text-sm font-black text-white">
                {text("Clear stars with no review", "राय बिनाका तारा हटाउने")}
              </button>
            </form>
          ) : null}
          {check.href.replace(/\/+$/, "") !== pathname.replace(/\/+$/, "") ? (
            <Link href={check.href} className="shrink-0 text-sm font-black underline">
              {text(check.action, check.actionNe)} →
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}
