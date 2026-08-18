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
        admin: {
          primary: "#1E40AF",
          "primary-light": "#3B82F6",
          "primary-dark": "#1E3A8A",
          accent: "#F59E0B",
          "accent-light": "#FBBF24",
          sidebar: "#FFFFFF",
          "sidebar-dark": "#1F2937",
          hover: "#F3F4F6",
          "hover-dark": "#374151",
          border: "#E5E7EB",
          "border-dark": "#4B5563",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "Segoe UI", "Arial", "Helvetica", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "Times New Roman", "serif"],
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
        xs: "0 1px 2px rgba(0, 0, 0, 0.05)",
        sm: "0 4px 6px rgba(0, 0, 0, 0.1)",
        md: "0 10px 15px rgba(0, 0, 0, 0.1)",
        lg: "0 20px 25px rgba(0, 0, 0, 0.15)",
        xl: "0 25px 50px rgba(0, 0, 0, 0.15)",
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