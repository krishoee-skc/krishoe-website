"use client";

import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

export type FooterLink = { href: string; en: string; ne: string; all?: boolean };
export type FooterGroup = { key: string; en: string; ne: string; links: FooterLink[] };

/**
 * The footer's shelves, in groups (owner, 2026-10-02): Women, Men, Kids, Shop.
 *
 * On a computer each group is a column, always open. On a phone each is a row
 * that opens on a tap — closed, the four take four short lines instead of a
 * twenty-line list — and slides open rather than jumping. The links are the
 * same links either way; nothing is hidden from a search engine, only folded.
 */
export default function FooterGroups({ groups }: { groups: FooterGroup[] }) {
  const { text } = useLanguage();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="grid lg:grid-cols-4 lg:gap-6">
      {groups.map((group) => {
        const isOpen = open === group.key;
        return (
          <nav key={group.key} aria-label={text(group.en, group.ne)} className="border-t border-brand-green-ink/20 last:border-b lg:border-0 lg:last:border-0">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : group.key)}
              className="flex min-h-11 w-full items-center justify-between px-1 text-left text-[13px] font-black uppercase tracking-[0.1em] text-brand-green-ink lg:pointer-events-none lg:mb-2 lg:min-h-0 lg:border-b-[1.5px] lg:border-brand-green-ink/20 lg:px-0 lg:pb-2 lg:text-xs lg:tracking-[0.18em]"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="hidden h-0.5 w-3.5 rounded bg-brand-green lg:block" />
                {text(group.en, group.ne)}
                <span className="text-[11px] font-bold normal-case tracking-normal lg:hidden">{group.links.length}</span>
              </span>
              <span
                aria-hidden="true"
                className={`grid h-7 w-7 place-items-center rounded-full transition duration-300 lg:hidden ${
                  isOpen ? "rotate-180 bg-brand-green text-white" : "bg-brand-green/10 text-brand-green"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            {/* Open on a computer always; on a phone, when tapped. The grid row
                going from 0fr to 1fr is what lets the height slide. */}
            <div className={`grid transition-[grid-template-rows] duration-300 ease-out lg:grid-rows-[1fr] ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <ul className="grid grid-cols-2 gap-x-3 px-1 pb-2 lg:grid-cols-1 lg:px-0 lg:pb-0">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={`group/fl relative inline-flex min-h-10 items-center gap-1.5 text-sm transition hover:text-brand-green lg:min-h-7 ${
                          link.all ? "font-extrabold text-brand-green" : "font-semibold text-brand-green-ink"
                        }`}
                      >
                        {text(link.en, link.ne)}
                        {link.all ? <span aria-hidden="true">→</span> : (
                          <span aria-hidden="true" className="hidden -translate-x-1 text-xs opacity-0 transition group-hover/fl:translate-x-0 group-hover/fl:opacity-100 lg:inline">→</span>
                        )}
                        <span aria-hidden="true" className="absolute inset-x-0 bottom-1.5 hidden h-[1.5px] origin-left scale-x-0 bg-brand-green transition duration-300 group-hover/fl:scale-x-100 lg:block" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </nav>
        );
      })}
    </div>
  );
}
