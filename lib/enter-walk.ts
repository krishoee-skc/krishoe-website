/**
 * Enter walks a form the way Tab does, and never files it by itself.
 *
 * The owner types figures one-handed — the other hand holds the paper bill, the
 * cash, or the shoe — and Enter sits on the number pad beside the digits. The
 * purchase bill, the POS bill and the work entry learned this on 2026-09-15.
 * The forms that pay a worker, a supplier or a salary did not, and in those a
 * browser treats Enter in a box as "save": type the amount, press Enter out of
 * habit, and a cash payment is filed before the date or the note was looked at
 * (W3C records the behaviour as failure F36).
 *
 * The rule, in one place:
 *   Enter        → the next box, in the order the form is read
 *   Shift+Enter  → the box before
 *   Enter on the last box → ask "Save?"; Enter again saves, Esc goes back
 *   Enter never saves without that question being answered.
 *
 * This file is the decision, kept free of the DOM so it can be tested whole;
 * components/admin/EnterWalkForm.tsx is the part that touches the page.
 */

/** What the walk needs to know about one element in the form. */
export type WalkField = {
  tag: string;
  type?: string;
  disabled?: boolean;
  readOnly?: boolean;
  /** Not drawn: display none, a closed <details>, zero size. */
  hidden?: boolean;
  /** `data-enter-walk`: a control the walk stops at though it is not a box —
   *  the Nepali date button, whose own Enter would open the calendar. */
  walk?: boolean;
  /** `data-enter-skip`, or inside something that carries it. */
  skip?: boolean;
  /** tabIndex below zero: taken out of the keyboard order on purpose. */
  untabbable?: boolean;
};

/** Input types that are not somewhere a figure is typed or chosen. */
const NOT_A_BOX = new Set(["hidden", "submit", "button", "reset", "image", "file"]);

/** Whether the walk stops at this element. */
export function isWalkStop(field: WalkField): boolean {
  if (field.disabled || field.hidden || field.skip || field.untabbable) return false;
  const tag = field.tag.toUpperCase();

  if (tag === "INPUT") {
    const type = (field.type ?? "text").toLowerCase();
    if (NOT_A_BOX.has(type)) return false;
    return !field.readOnly;
  }
  if (tag === "SELECT") return true;
  if (tag === "TEXTAREA") return !field.readOnly;
  // A button is a stop only when it says so — the calendar's own day buttons,
  // the "use current balance" helper and Save itself are not boxes.
  return Boolean(field.walk);
}

export type EnterStep =
  | { kind: "focus"; index: number }
  | { kind: "confirm" }
  | { kind: "stay" };

/**
 * Where Enter goes from the stop at `index` among `count` stops.
 *
 * Forward from the last stop is the question, never the save. Back from the
 * first stop stays put rather than wrapping to the end of the form: wrapping
 * would put the cursor on the note while the owner is looking at the worker.
 */
export function enterStep(index: number, count: number, back: boolean): EnterStep {
  if (count <= 0 || index < 0 || index >= count) return { kind: "stay" };
  if (back) return index > 0 ? { kind: "focus", index: index - 1 } : { kind: "stay" };
  return index < count - 1 ? { kind: "focus", index: index + 1 } : { kind: "confirm" };
}

/**
 * Whether this key press is ours to handle.
 *
 * Ctrl, Alt and Meta with Enter are left to the browser and the page. So is
 * Enter while an input method is composing — a Nepali keyboard uses Enter to
 * commit the word being typed, and taking it would lose the word.
 */
export function isWalkKey(event: {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
}): boolean {
  if (event.key !== "Enter") return false;
  if (event.ctrlKey || event.altKey || event.metaKey) return false;
  return !event.isComposing;
}

/** How a summary field reads in the "Save?" line. */
export function summaryPart(kind: string, value: string, pairsWord = "pairs"): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (kind === "pairs") return `${trimmed} ${pairsWord}`;
  if (kind === "money") {
    const amount = Number(trimmed);
    return Number.isFinite(amount)
      ? `Rs. ${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
      : trimmed;
  }
  return trimmed;
}

/** The one line the question shows: whose, what, how much. */
export function confirmLine(parts: string[], title?: string): string {
  return [title?.trim() ?? "", ...parts].filter(Boolean).join(" · ");
}
