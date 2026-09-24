"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the phone's on-screen keyboard is up.
 *
 * The bars fixed to the foot of the screen — the shop's tab bar, the admin
 * dock — stay put when the keyboard opens, and on a phone that leaves the box
 * being typed into squeezed between the keyboard and a bar of buttons nobody
 * can use while typing. Hidden while it is up, back when it goes.
 *
 * The keyboard is not announced by the browser. What is visible shrinks
 * (visualViewport) while the layout does not, so a gap of more than 150px is
 * the keyboard — but a pinch-zoom shrinks the same number, so it counts only
 * while a box that takes typing has the focus.
 */

function editableHasFocus() {
  const element = document.activeElement as HTMLElement | null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly;
  if (element instanceof HTMLInputElement) {
    return !element.readOnly && !["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "image"].includes(element.type);
  }
  return false;
}

function snapshot() {
  const viewport = window.visualViewport;
  if (!viewport) return false;
  return window.innerHeight - viewport.height > 150 && editableHasFocus();
}

function subscribe(onChange: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", onChange);
  window.addEventListener("focusin", onChange);
  window.addEventListener("focusout", onChange);
  return () => {
    viewport?.removeEventListener("resize", onChange);
    window.removeEventListener("focusin", onChange);
    window.removeEventListener("focusout", onChange);
  };
}

export function useKeyboardOpen() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
