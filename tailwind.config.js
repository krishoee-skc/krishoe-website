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
        // Every value here is a hex that was already hardcoded across the app.
        // Naming them changed no pixels; it only moved them to one place.
        // The palette still carries five golds and four green tints that a
        // designer should collapse — that is a visual call, not a rename.
        brand: {
          green: "#0B4D3B",
          "green-ink": "#10231D",
          "green-tint": "#EAF5EF",
          "green-mist": "#E9F2EE",
          "green-wash": "#F4FBF6",
          "green-line": "#D9E8DF",
          gold: "#C8A04D",
          "gold-bright": "#D4AF37",
          "gold-deep": "#B98A2E",
          "gold-dark": "#9A6B08",
          "gold-ink": "#7A5A00",
          cream: "#FFF6D8",
          "cream-soft": "#FFF7DF",
          mist: "#F5F7F4",
          clay: "#7B3128",
          "clay-tint": "#FBEAE8",
          "clay-mist": "#FFF1EF",
          muted: "#5F6B66",
          "muted-soft": "#8A958F",
          "muted-deep": "#6D7773",
          danger: "#B3261E",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "Segoe UI", "Arial", "Helvetica", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};