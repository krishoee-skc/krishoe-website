/** @type {import('tailwindcss').Config} */
module.exports = {
  // Driven by a class on <html>, not the OS alone, so the shop's own toggle can
  // override what the phone is set to. The toggle still starts from the OS
  // preference when nothing has been chosen.
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          green: "#0B4D3B",
          "green-ink": "#10231D",
          "green-tint": "#EAF5EF",
          "green-mist": "#E9F2EE",
          "green-wash": "#F4FBF6",
          "green-line": "#E4DFD5",
          gold: "#C8A04D",
          "gold-bright": "#D4AF37",
          "gold-deep": "#B98A2E",
          "gold-dark": "#9A6B08",
          "gold-ink": "#7A5A00",
          "gold-label": "#A47A28",
          paper: "#FDFBF7",       /* cards and sheets — paper, not screen white */
          "paper-deep": "#FAF8F3",  /* the ground those sheets sit on */
          "cream-hero": "#F7EFE2",
          cream: "#FFF6D8",
          "cream-soft": "#FFF7DF",
          mist: "#F4F2ED",
          clay: "#7B3128",
          "clay-deep": "#7A1818",
          "clay-ink": "#651B24",
          "clay-tint": "#FBEAE8",
          "clay-mist": "#FFF1EF",
          muted: "#6B6459",
          "muted-soft": "#938C80",
          "muted-deep": "#7A7263",
          danger: "#B3261E",
        },
        // The admin used to be a different company: a stock indigo primary and
        // an amber accent that appear nowhere else in KRISHOE, on neutral
        // greys. Same role names, the brand's own colours.
        admin: {
          primary: "#0B4D3B",
          "primary-light": "#12654E",
          "primary-dark": "#10231D",
          accent: "#C8A04D",
          "accent-light": "#D4AF37",
          sidebar: "#FDFBF7",
          "sidebar-dark": "#13221D",
          hover: "#F4F2ED",
          "hover-dark": "#1B2F28",
          border: "#E4DFD5",
          "border-dark": "#2A4139",
        },
      },
      fontFamily: {
        // The Devanagari face follows the Latin one in each stack: a browser
        // takes every letter from the first font that contains it, so Latin
        // comes from Inter or Fraunces and Nepali from Mukta or Tiro. Without
        // the second entry the Nepali fell through to whatever the reader's
        // phone happened to ship with.
        sans: ["var(--font-sans)", "var(--font-dev-sans)", "Inter", "Mukta", "Segoe UI", "Arial", "Helvetica", "sans-serif"],
        display: ["var(--font-display)", "var(--font-dev-display)", "Georgia", "Times New Roman", "serif"],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
      },
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(59, 42, 24, 0.04)",
        sm: "0 1px 2px rgba(59, 42, 24, 0.05)",
        md: "0 4px 14px rgba(59, 42, 24, 0.06)",
        lg: "0 12px 32px rgba(59, 42, 24, 0.08)",
        xl: "0 24px 60px rgba(59, 42, 24, 0.10)",
      },
      animation: {
        "slide-in": "slideIn 300ms ease-out",
        "fade-in": "fadeIn 300ms ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateX(-10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
      },
    },
  },
  plugins: [],
};