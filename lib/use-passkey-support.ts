"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether this browser can do passkeys at all.
 *
 * A browser capability, not application state — it cannot change while the page
 * is open, and nothing subscribes to it. Reading it through an effect meant
 * rendering once as "unsupported" and again as "supported", which React's lint
 * rejects for exactly that reason.
 *
 * useSyncExternalStore is the tool for a value that differs between the server
 * and the browser: the server snapshot is false, the client snapshot is the
 * real answer, and there is no intermediate render or mismatch.
 *
 * `isSecureContext` matters as much as the API existing. WebAuthn is refused
 * over plain http — which is how the shop would be reached on a local network —
 * and a button that fails when pressed teaches people to distrust the screen.
 */
const subscribe = () => () => {};

const clientSnapshot = () =>
  typeof window.PublicKeyCredential !== "undefined" && window.isSecureContext;

const serverSnapshot = () => false;

export function usePasskeySupport() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
