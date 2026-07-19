import type { Metadata, Viewport } from "next";

// The parts of the page head that decide whether KRISHOE installs as an app or
// stays a bookmark. They live here rather than inline in app/layout.tsx so they
// can be tested — importing the layout pulls in next/font, which does not run
// outside a Next build.

// Android reads display and theme from the manifest; iOS does not read all of
// it. Without these, adding KRISHOE to an iPhone home screen opened it inside
// Safari with the address bar still showing — the same page, but not the app.
export const pwaViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Colours the phone's status bar. Two entries so it follows the theme rather
  // than leaving a white strip above a dark page.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10231D" },
    { media: "(prefers-color-scheme: dark)", color: "#0D1714" },
  ],
};

export const pwaMetadata: Pick<Metadata, "appleWebApp" | "other"> = {
  appleWebApp: {
    capable: true,
    title: "KRISHOE",
    // The status bar takes the page's own colour instead of a fixed black bar.
    statusBarStyle: "black-translucent",
  },
  other: {
    // `capable: true` emits only the modern `mobile-web-app-capable`. Safari
    // before iOS 17 reads the apple-prefixed name and nothing else, and on
    // those phones its absence is what makes an added-to-home-screen KRISHOE
    // open in Safari rather than as an app. Newer versions ignore it.
    "apple-mobile-web-app-capable": "yes",
  },
};
