"use client";

import { useEffect, useState } from "react";

/**
 * Whether this browser can do passkeys at all.
 *
 * False on the first render everywhere, then the real answer straight after.
 * It was read through a store hook with a server snapshot of false,
 * which should have kept the first browser render equal to the server's — but
 * on the live sign-in page, when the page's script arrived early, the browser
 * drew "Let this device recognise me" while hydrating a page the server had
 * sent without it: React error #418 on about one load in four, and the whole
 * page drawn again (owner, 2026-10-25). An answer that can only arrive after
 * the first render cannot be drawn into it.
 *
 * The reading is scheduled rather than set in the effect body, as PrintedOn
 * does: a synchronous setState there is what `react-hooks/set-state-in-effect`
 * forbids.
 *
 * `isSecureContext` matters as much as the API existing. WebAuthn is refused
 * over plain http — which is how the shop would be reached on a local network —
 * and a button that fails when pressed teaches people to distrust the screen.
 */
export function usePasskeySupport() {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSupported(typeof window.PublicKeyCredential !== "undefined" && window.isSecureContext);
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  return supported;
}
