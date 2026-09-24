"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { useLanguage } from "@/components/LanguageProvider";
import {
  confirmLine,
  enterStep,
  isWalkKey,
  isWalkStop,
  summaryPart,
  type WalkField,
} from "@/lib/enter-walk";

/**
 * A <form> on which Enter walks from box to box and asks before it saves.
 *
 * Drop-in for <form>: every prop is passed through, including a server action
 * as `action`, so a server-rendered page swaps the tag and nothing else. The
 * rule itself lives in lib/enter-walk.ts.
 *
 * Mark the figures the question should read back with `data-summary` ("money"
 * for an amount, anything else for text); `confirmTitle` names what is not a
 * box on the form — the worker picked higher up the page.
 */

function describe(element: Element): WalkField {
  const el = element as HTMLInputElement;
  return {
    tag: element.tagName,
    type: element.tagName === "INPUT" ? el.type : undefined,
    disabled: Boolean((el as { disabled?: boolean }).disabled),
    readOnly: Boolean((el as { readOnly?: boolean }).readOnly),
    hidden: element.getClientRects().length === 0,
    walk: element.hasAttribute("data-enter-walk"),
    skip: Boolean(element.closest("[data-enter-skip]")),
    untabbable: (element as HTMLElement).tabIndex < 0,
  };
}

function stopsIn(form: HTMLFormElement): HTMLElement[] {
  return Array.from(
    form.querySelectorAll<HTMLElement>("input, select, textarea, button[data-enter-walk]"),
  ).filter((element) => isWalkStop(describe(element)));
}

/** A label's own words — not the option list of the select it wraps. */
function ownText(element: Element) {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameOf(element: HTMLElement) {
  const labelled = (element as HTMLInputElement).labels?.[0] ?? element.closest("label");
  const fromLabel = labelled ? ownText(labelled) : "";
  const name =
    fromLabel ||
    element.getAttribute("aria-label") ||
    element.getAttribute("placeholder") ||
    "";
  return name.length > 40 ? `${name.slice(0, 39)}…` : name;
}

function readBack(form: HTMLFormElement, pairsWord: string) {
  return Array.from(form.querySelectorAll<HTMLElement>("[data-summary]"))
    .map((element) => {
      const kind = element.getAttribute("data-summary") ?? "text";
      const value =
        element instanceof HTMLSelectElement
          ? element.value
            ? element.selectedOptions[0]?.textContent ?? ""
            : ""
          : (element as HTMLInputElement).value ?? "";
      return summaryPart(kind, value, pairsWord);
    })
    .filter(Boolean);
}

function enabledSubmitter(form: HTMLFormElement) {
  return Array.from(
    form.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      "button[type=submit], button:not([type]), input[type=submit]",
    ),
  ).find((button) => !button.disabled && !button.closest("[data-enter-confirm]"));
}

export default function EnterWalkForm({
  children,
  className,
  onKeyDown,
  onFocus,
  onBlur,
  onSubmit,
  confirmTitle,
  ...props
}: ComponentProps<"form"> & { confirmTitle?: string }) {
  const { text } = useLanguage();
  const formRef = useRef<HTMLFormElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const lastStop = useRef<HTMLElement | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  // Phone keyboards draw their action key from this: "Next" until the last
  // box, "Done" on it.
  function labelKeys(form: HTMLFormElement) {
    const stops = stopsIn(form);
    stops.forEach((stop, index) => {
      stop.setAttribute("enterkeyhint", index === stops.length - 1 ? "done" : "next");
    });
    return stops;
  }

  useEffect(() => {
    if (formRef.current) labelKeys(formRef.current);
  }, []);

  useEffect(() => {
    if (question !== null) yesRef.current?.focus();
  }, [question]);

  function back() {
    setQuestion(null);
    lastStop.current?.focus();
  }

  function save() {
    const form = formRef.current;
    setQuestion(null);
    if (!form) return;
    const submitter = enabledSubmitter(form);
    // The form's own Save is disabled while a save is already running, or
    // until the form is ready. Saving around it would file the entry twice.
    if (!submitter) return;
    if (typeof form.requestSubmit === "function") form.requestSubmit(submitter);
    else submitter.click();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const form = formRef.current;
    const target = event.target as HTMLElement;
    if (!form) return;

    if (question !== null) {
      if (event.key === "Escape") {
        event.preventDefault();
        back();
      }
      return; // Enter on "Yes" or "No" is that button's own click.
    }

    const walkKey = isWalkKey({
      key: event.key,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      isComposing: event.nativeEvent.isComposing,
    });
    if (!walkKey) return;
    if (target.closest("[data-enter-confirm]")) return;
    if (!isWalkStop(describe(target))) return;

    const stops = labelKeys(form);
    const index = stops.indexOf(target);
    if (index < 0) return;

    // A dropdown never saves on Enter, and in some browsers Enter is also what
    // picks the highlighted option — so it is left to do that, and the walk
    // moves on after it.
    const isSelect = target instanceof HTMLSelectElement;
    if (!isSelect) event.preventDefault();

    const step = enterStep(index, stops.length, event.shiftKey);
    if (step.kind === "focus") {
      const next = stops[step.index];
      if (isSelect) window.setTimeout(() => next.focus(), 0);
      else next.focus();
      return;
    }
    if (step.kind === "confirm") {
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (!enabledSubmitter(form)) return;
      lastStop.current = target;
      setQuestion(confirmLine(readBack(form, text("pairs", "जोडी")), confirmTitle));
    }
  }

  function handleFocus(event: FocusEvent<HTMLFormElement>) {
    onFocus?.(event);
    const form = formRef.current;
    const target = event.target as HTMLElement;
    if (!form || !isWalkStop(describe(target))) return;
    const stops = labelKeys(form);
    const index = stops.indexOf(target);
    if (index < 0) return;
    const next = stops[index + 1];
    setHint(
      next
        ? text(`Enter ↵ next: ${nameOf(next)}`, `Enter ↵ अर्को: ${nameOf(next)}`)
        : text("Enter ↵ asks before saving", "Enter ↵ Save गर्नुअघि सोध्छ"),
    );
  }

  function handleBlur(event: FocusEvent<HTMLFormElement>) {
    onBlur?.(event);
    const into = event.relatedTarget as Node | null;
    if (!into || !formRef.current?.contains(into)) setHint(null);
  }

  return (
    <form
      {...props}
      ref={formRef}
      className={`enter-walk ${className ?? ""}`}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onSubmit={(event) => {
        setQuestion(null);
        onSubmit?.(event);
      }}
    >
      {children}
      {question !== null ? (
        <div
          data-enter-confirm
          role="alertdialog"
          aria-label={text("Save?", "Save गर्ने?")}
          className="mt-3 grid gap-2 rounded-xl border-2 border-brand-gold bg-brand-cream-soft p-3 text-brand-green-ink"
        >
          <p className="text-sm font-black">
            {text("Save?", "Save गर्ने?")} {question ? <span className="font-semibold">{question}</span> : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              ref={yesRef}
              type="button"
              onClick={save}
              className="min-h-11 rounded-lg bg-brand-green px-4 text-sm font-black text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-gold"
            >
              {text("Yes, save (Enter)", "हो, Save (Enter)")}
            </button>
            <button
              type="button"
              onClick={back}
              className="min-h-11 rounded-lg border border-brand-green-line bg-brand-paper px-4 text-sm font-black text-brand-green-ink"
            >
              {text("No, go back (Esc)", "होइन, फर्किने (Esc)")}
            </button>
          </div>
        </div>
      ) : null}
      {hint && question === null ? (
        <p aria-hidden="true" className="mt-2 text-xs font-bold text-brand-green">
          {hint} <span className="text-brand-muted">· Shift+Enter ↑</span>
        </p>
      ) : null}
    </form>
  );
}
