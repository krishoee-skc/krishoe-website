/**
 * Where this device stands for phone alerts, and so what the owner is told.
 *
 * "This browser does not give notifications" was true and no help: on an
 * iPhone it is the same message in Safari, in Chrome, and when WhatsApp opens a
 * link — and the one place alerts do work, the KRISHOE icon on the Home
 * Screen, was a sentence at the end. Apple gives web alerts to Home Screen
 * apps only (iOS 16.4 and later), so on an iPhone the page now says which of
 * those it is looking at and the next step from there.
 *
 * Only reads what the browser already says about itself. Nothing is stored or
 * sent.
 */

export type PushEnvironment =
  /** Can turn alerts on here. */
  | "ready"
  /** Can turn alerts on here, and it is the iPhone Home Screen app — say so. */
  | "ready-iphone-app"
  /** iPhone in Safari, Chrome or another browser: add to Home Screen first. */
  | "iphone-browser"
  /** iPhone Home Screen app on an iOS too old for web alerts (before 16.4). */
  | "iphone-update"
  /** Facebook, Instagram or Messenger's own browser: open it in a real one. */
  | "in-app"
  /** Anything else without alerts. */
  | "unsupported";

export type DeviceFacts = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** Opened from the Home Screen / installed app, not a browser tab. */
  standalone: boolean;
  /** The browser offers service workers and PushManager. */
  hasPush: boolean;
};

export function isIPhoneOrIPad({ userAgent, platform, maxTouchPoints }: DeviceFacts) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  // An iPad asks for the desktop site and says it is a Mac; a Mac has no touch.
  return platform === "MacIntel" && maxTouchPoints > 1;
}

export function pushEnvironment(facts: DeviceFacts): PushEnvironment {
  if (/FBAN|FBAV|FB_IAB|Instagram|Messenger/i.test(facts.userAgent)) return "in-app";

  if (isIPhoneOrIPad(facts)) {
    // In a Safari tab an iPhone may still show the push objects, but a
    // subscription there never delivers. Only the Home Screen app counts.
    if (!facts.standalone) return "iphone-browser";
    return facts.hasPush ? "ready-iphone-app" : "iphone-update";
  }

  return facts.hasPush ? "ready" : "unsupported";
}

/** The facts, read from this browser. Client only. */
export function readDeviceFacts(): DeviceFacts {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform ?? "",
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone,
    hasPush: "serviceWorker" in navigator && "PushManager" in window,
  };
}
