/** @type {import('tailwindcss').Config} */
module.exports = {
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
          gold: "#C8A04D",
          "gold-dark": "#9A6B08",
          cream: "#FFF6D8",
          mist: "#F5F7F4",
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