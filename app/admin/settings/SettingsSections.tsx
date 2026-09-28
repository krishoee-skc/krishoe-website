"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/LanguageProvider";

export type SettingsSection = {
  id: string;
  icon: string;
  en: string;
  ne: string;
  /** Boxes still empty in this part; shown beside its name. */
  missing?: number;
  /** A count to show when nothing is missing (branches, staff). */
  count?: number;
  body: ReactNode;
};

export type SettingsTodo = {
  en: string;
  ne: string;
  section: string;
  /** The id of the box to put the cursor in. */
  field?: string;
  done: boolean;
};

const REMEMBER_KEY = "krishoe:settings-section";
// Older links go straight to one part of the page.
const HASH_TO_SECTION: Record<string, string> = { goals: "goal", delivery: "delivery" };

/**
 * Settings the way a phone's settings read: a list of parts on the left, one
 * part open at a time, and what is still empty at the top.
 *
 * It was one long page — company, bill, bank, goal, delivery, branches, staff
 * and a security trail — with nothing to say what had been filled. Every form
 * and every field is still here; only where they sit changed. The open part is
 * remembered in this browser so a save, which reloads the page, lands back on
 * it.
 */
export default function SettingsSections({
  sections,
  todos,
}: {
  sections: SettingsSection[];
  todos: SettingsTodo[];
}) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const id = window.setTimeout(() => {
      const fromHash = HASH_TO_SECTION[window.location.hash.replace("#", "")];
      let remembered = "";
      try {
        remembered = window.localStorage.getItem(REMEMBER_KEY) ?? "";
      } catch {
        // Storage blocked: start on the first part.
      }
      const wanted = fromHash ?? remembered;
      if (wanted && sections.some((section) => section.id === wanted)) setOpen(wanted);
    }, 0);
    return () => window.clearTimeout(id);
  }, [sections]);

  const choose = (sectionId: string) => {
    setOpen(sectionId);
    try {
      window.localStorage.setItem(REMEMBER_KEY, sectionId);
    } catch {
      // Not remembered; nothing else changes.
    }
  };

  const goTo = (todo: SettingsTodo) => {
    choose(todo.section);
    if (!todo.field) return;
    window.setTimeout(() => {
      const box = document.getElementById(todo.field ?? "");
      if (!box) return;
      box.scrollIntoView({ block: "center", behavior: "smooth" });
      (box as HTMLInputElement).focus?.();
    }, 60);
  };

  const done = todos.filter((todo) => todo.done).length;

  return (
    <div className="mt-6 grid gap-5">
      {todos.length > 0 ? (
        <section className="rounded-2xl border border-brand-green-line bg-brand-green-wash p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-black text-brand-green-ink">
              ✅ {text("Still to fill", "भर्न बाँकी")}
            </h2>
            <span className="text-sm font-bold text-brand-muted">
              {text(`${done} of ${todos.length} done`, `${todos.length} मध्ये ${done} पूरा`)}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-green-line" aria-hidden="true">
            <div className="h-full bg-brand-green" style={{ width: `${Math.round((done / todos.length) * 100)}%` }} />
          </div>
          <ul className="mt-3 grid list-none gap-2 pl-0 sm:grid-cols-2 lg:grid-cols-3">
            {todos.map((todo) => (
              <li key={todo.en}>
                <button
                  type="button"
                  onClick={() => goTo(todo)}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm font-bold transition ${
                    todo.done
                      ? "border-brand-green-line text-brand-muted line-through"
                      : "border-brand-gold/60 bg-brand-paper text-brand-green-ink hover:border-brand-green"
                  }`}
                >
                  <span aria-hidden="true">{todo.done ? "✓" : "○"}</span>
                  {text(todo.en, todo.ne)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label={text("Parts of settings", "सेटिङका भाग")} className="lg:sticky lg:top-4 lg:self-start">
          <ul className="flex list-none gap-1.5 overflow-x-auto pb-1 pl-0 lg:flex-col lg:overflow-visible">
            {sections.map((section) => {
              const active = section.id === open;
              return (
                <li key={section.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => choose(section.id)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 w-full items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 text-left text-sm font-bold transition ${
                      active ? "bg-brand-green-wash text-brand-green" : "text-brand-green-ink hover:bg-brand-mist"
                    }`}
                  >
                    <span>
                      <span aria-hidden="true">{section.icon}</span> {text(section.en, section.ne)}
                    </span>
                    {section.missing ? (
                      <span className="rounded-full bg-amber-100 px-2 text-xs font-black text-amber-900">{section.missing}</span>
                    ) : section.count !== undefined ? (
                      <span className="rounded-full bg-emerald-50 px-2 text-xs font-black text-emerald-800">{section.count}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {sections.map((section) => (
            // The class goes with the part, not only the attribute: "grid"
            // sets display itself and would beat a bare `hidden`.
            <div key={section.id} hidden={section.id !== open} className={section.id === open ? "grid gap-5" : "hidden"}>
              {section.body}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
