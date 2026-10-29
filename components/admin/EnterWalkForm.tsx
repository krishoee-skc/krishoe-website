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

/** Two submits closer than this are one press pressed twice. */
const DOUBLE_PRESS_MS = 800;

/**
 * Inside a shut "+ more" fold. Chrome now keeps a closed <details> laid out
 * (its content is only made invisible), so such a box still reports a size —
 * and Enter on the box before it sent the cursor to a box that cannot take
 * it: nothing moved and nothing saved (owner, POS new item, 2026-10-29).
 */
function folded(element: Element) {
  const box = element as HTMLElement & { checkVisibility?: () => boolean };
  if (typeof box.checkVisibility === "function" && !box.checkVisibility()) return true;
  const shut = element.closest("details:not([open])");
  return Boolean(shut && !element.closest("summary"));
}

export function describe(element: Element): WalkField {
  const el = element as HTMLInputElement;
  return {
    tag: element.tagName,
    type: element.tagName === "INPUT" ? el.type : undefined,
    disabled: Boolean((el as { disabled?: boolean }).disabled),
    readOnly: Boolean((el as { readOnly?: boolean }).readOnly),
    hidden: element.getClientRects().length === 0 || folded(element),
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
  formRef: outerRef,
  worker = false,
  onBlocked,
  oncePerPress = false,
  ...props
}: ComponentProps<"form"> & {
  confirmTitle?: string;
  /**
   * A worker's own screen: every word in Nepali whatever the phone was last
   * set to, and "send" rather than "save" — what the worker does is send to
   * the owner (owner, 2026-10-08: the question came up in English).
   */
  worker?: boolean;
  /**
   * A form posted straight to a server action, with no key of its own: a
   * second submit a moment after the first is dropped (KR-BUG-012). Off by
   * default — the counter bill asks questions and sends itself again on the
   * answer, which must never be taken for a double press.
   */
  oncePerPress?: boolean;
  /** For a page that reads the form itself — the product form's AI drafter. */
  formRef?: { current: HTMLFormElement | null };
  /**
   * Enter on the last box while the form's own Save is shut — something is
   * still to fill. The form says what, and takes the cursor there; without
   * this, Enter did nothing and the save looked stuck (owner, 2026-10-11).
   */
  onBlocked?: () => void;
}) {
  const { text: chosen } = useLanguage();
  const text = (english: string, nepali: string) => (worker ? nepali : chosen(english, nepali));
  const ask = worker ? text("Send?", "पठाउने?") : text("Save?", "Save गर्ने?");
  const formRef = useRef<HTMLFormElement | null>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const lastStop = useRef<HTMLElement | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  // Two presses in the same instant sent a form twice — a supplier paid twice
  // (KR-BUG-012). On a form that asks for it (oncePerPress), a second submit
  // within a moment of the first is the same press.
  const lastSubmit = useRef(0);

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
    if (question === null) return;
    yesRef.current?.focus();
    // Brought to the middle, not merely inside the edge: at the foot of a
    // long bill the question sat off the screen and Enter looked dead.
    yesRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
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

    const inQuestion = Boolean(target.closest("[data-enter-confirm]"));
    if (question !== null && event.key === "Escape") {
      event.preventDefault();
      back();
      return;
    }
    // Enter on "Yes" or "No" is that button's own click.
    if (inQuestion) return;

    const walkKey = isWalkKey({
      key: event.key,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      isComposing: event.nativeEvent.isComposing,
    });
    if (!walkKey) return;
    if (!isWalkStop(describe(target))) {
      // A box the walk passes over — read-only, or marked to skip — would
      // still file the form on Enter by the browser's own rule. It gets
      // nothing instead: on this form only the question saves.
      if (target instanceof HTMLInputElement && !["submit", "button", "reset", "image"].includes(target.type)) {
        event.preventDefault();
      }
      return;
    }

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
      if (!enabledSubmitter(form)) {
        onBlocked?.();
        return;
      }
      lastStop.current = target;
      setQuestion(confirmLine(readBack(form, text("pairs", "जोडी")), confirmTitle));
    }
  }

  function handleFocus(event: FocusEvent<HTMLFormElement>) {
    onFocus?.(event);
    const form = formRef.current;
    const target = event.target as HTMLElement;
    if (!form || !isWalkStop(describe(target))) return;
    // Back in a box — by a tap or a click while the question was up — the
    // question is withdrawn: what it read back may be about to change, and
    // Enter in the box must walk again rather than meet a stale "Save?".
    setQuestion(null);
    const stops = labelKeys(form);
    const index = stops.indexOf(target);
    if (index < 0) return;
    const next = stops[index + 1];
    setHint(
      next
        ? text(`Enter ↵ next: ${nameOf(next)}`, `Enter ↵ अर्को: ${nameOf(next)}`)
        : worker
          ? text("Enter ↵ asks before sending", "Enter ↵ पठाउनुअघि सोध्छ")
          : text("Enter ↵ asks before saving", "Enter ↵ Save गर्नुअघि सोध्छ"),
    );
  }

  function handleBlur(event: FocusEvent<HTMLFormElement>) {
    onBlur?.(event);
    const into = event.relatedTarget as Node | null;
    if (into && formRef.current?.contains(into)) return;
    // After the click has landed, not before it (KR-BUG-008). Safari does not
    // focus a pressed button, so a box lost focus to "nothing" on the press
    // itself; the hint went at once, the page under it shifted, and at the
    // foot of a page the release fell on the form instead of Save — nothing
    // saved. Cleared a moment later, it goes only if focus truly left.
    window.setTimeout(() => {
      if (!formRef.current?.contains(document.activeElement)) setHint(null);
    }, 300);
  }

  return (
    <form
      {...props}
      ref={(node) => {
        formRef.current = node;
        if (outerRef) outerRef.current = node;
      }}
      className={`enter-walk ${className ?? ""}`}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onSubmit={(event) => {
        const now = Date.now();
        if (oncePerPress && now - lastSubmit.current < DOUBLE_PRESS_MS) {
          event.preventDefault();
          return;
        }
        lastSubmit.current = now;
        setQuestion(null);
        onSubmit?.(event);
      }}
    >
      {children}
      {question !== null ? (
        <div
          data-enter-confirm
          role="alertdialog"
          aria-label={ask}
          className="mt-3 grid gap-2 rounded-xl border-2 border-brand-gold bg-brand-cream-soft p-3 text-brand-green-ink"
        >
          <p className="text-sm font-black">
            {ask} {question ? <span className="font-semibold">{question}</span> : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              ref={yesRef}
              type="button"
              onClick={save}
              className="min-h-11 rounded-lg bg-brand-green px-4 text-sm font-black text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-gold"
            >
              {worker ? text("Yes, send (Enter)", "हो, पठाउने (Enter)") : text("Yes, save (Enter)", "हो, Save (Enter)")}
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
