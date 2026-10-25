export const THEME_STORAGE_KEY = "krishoe-theme";

// Runs before the first paint, inlined in <head>. Without it the page renders
// light, then flips to dark once React has hydrated — a white flash on every
// navigation, which is worse at night than having no dark mode at all.
//
// Kept as a string because it has to be a <script>, and deliberately tiny: it
// runs on the critical path for every page in the shop.
//
// It lives here, not in ThemeToggle, because ThemeToggle is a client module.
// The root layout (a server component) imported the string from there, so the
// page sent a reference to a client-module export instead of the text, and the
// browser had to load that module's chunks — the admin layout's among them —
// before <head> could hydrate. When they were late, React went on to <body>
// with its place still inside <head> and threw #418 on the first element,
// "Skip to content" (admin sign-in, about one load in four with a warm cache,
// 2026-10-25). A plain module is inlined as text and never waits.
export const themeBootScript = `(function(){try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
