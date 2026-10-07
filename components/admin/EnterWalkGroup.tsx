"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { enterStep, isWalkKey, isWalkStop } from "@/lib/enter-walk";
import { describe } from "@/components/admin/EnterWalkForm";

/**
 * Enter walks from box to box on a screen that has no <form> — the rows that
 * save through their own button (the photo inbox, ready-to-post, the item
 * list, the worker's photo).
 *
 * The same rule as EnterWalkForm (lib/enter-walk.ts): Enter is the next box,
 * Shift+Enter the box before. Past the last box Enter lands on the save
 * button — it never presses it. One more Enter there is the button's own,
 * so the figures are seen once before anything is filed.
 *
 * The button it lands on is the one marked `data-enter-save`, or else the
 * first enabled button after the last box.
 */

function stopsIn(group: HTMLElement): HTMLElement[] {
  return Array.from(
    group.querySelectorAll<HTMLElement>("input, select, textarea, button[data-enter-walk]"),
  ).filter((element) => isWalkStop(describe(element)));
}

function saveButtonAfter(group: HTMLElement, from: HTMLElement) {
  const enabled = (button: HTMLButtonElement) => !button.disabled && button.getClientRects().length > 0;
  // A marked button that is greyed out — the figures are not complete — keeps
  // the cursor where it is rather than sending it to some other button.
  const marked = Array.from(group.querySelectorAll<HTMLButtonElement>("button[data-enter-save]"));
  if (marked.length > 0) return marked.find(enabled);
  return Array.from(group.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => enabled(button) && Boolean(from.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING),
  );
}

export default function EnterWalkGroup({ children, className = "contents" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  // Phone keyboards draw their action key from this: "Next" on every box —
  // the last one still moves on, to the button.
  function labelKeys(group: HTMLElement) {
    const stops = stopsIn(group);
    for (const stop of stops) stop.setAttribute("enterkeyhint", "next");
    return stops;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const group = ref.current;
    const target = event.target as HTMLElement;
    if (!group || event.defaultPrevented) return;
    const walkKey = isWalkKey({
      key: event.key,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      isComposing: event.nativeEvent.isComposing,
    });
    if (!walkKey || !isWalkStop(describe(target))) return;

    const stops = labelKeys(group);
    const index = stops.indexOf(target);
    if (index < 0) return;

    // A dropdown keeps Enter for picking its option; the walk follows after.
    const isSelect = target instanceof HTMLSelectElement;
    if (!isSelect) event.preventDefault();
    const go = (next: HTMLElement | undefined) => {
      if (!next) return;
      if (isSelect) window.setTimeout(() => next.focus(), 0);
      else next.focus();
    };

    const step = enterStep(index, stops.length, event.shiftKey);
    if (step.kind === "focus") go(stops[step.index]);
    else if (step.kind === "confirm") go(saveButtonAfter(group, target));
  }

  return (
    <div
      ref={ref}
      className={className}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        if (ref.current) labelKeys(ref.current);
      }}
    >
      {children}
    </div>
  );
}
