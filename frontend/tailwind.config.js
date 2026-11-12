/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Charcoal / graphite brand scale — the "gradient gray" identity.
        primary: {
          50:  "#f7f8fa",
          100: "#eef0f3",
          200: "#dfe3e8",
          300: "#c3cad2",
          400: "#98a2ae",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
        },
        ink: {
          DEFAULT: "#111827",
          soft: "#1f2937",
          muted: "#6b7280",
          faint: "#9ca3af",
        },
        surface: {
          DEFAULT: "#ffffff",
          secondary: "#f5f6f8",
          muted: "#eef0f3",
          border: "#e5e7eb",
        },
        success: "#16a34a",
        warning: "#d97706",
        danger: "#dc2626",
        info: "#2563eb",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #111827 0%, #374151 55%, #6b7280 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, rgba(17,24,39,0.06) 0%, rgba(107,114,128,0.04) 100%)",
        "surface-gradient": "linear-gradient(180deg, #ffffff 0%, #f5f6f8 100%)",
        "page-gradient":
          "radial-gradient(1100px 520px at 88% -12%, #ffffff 0%, rgba(255,255,255,0) 62%), radial-gradient(820px 460px at -8% 8%, #eef0f3 0%, rgba(238,240,243,0) 60%), linear-gradient(180deg, #f7f8fa 0%, #f1f2f5 100%)",
        "glass-sheen":
          "linear-gradient(120deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.62) 100%)",
        "grid-fade":
          "linear-gradient(to right, rgba(17,24,39,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(17,24,39,0.05) 1px, transparent 1px)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(17,24,39,0.04), 0 8px 24px -12px rgba(17,24,39,0.10)",
        "card-hover":
          "0 2px 4px rgba(17,24,39,0.05), 0 18px 40px -18px rgba(17,24,39,0.18)",
        glass: "0 18px 60px -30px rgba(17,24,39,0.35)",
        "inner-line": "inset 0 1px 0 rgba(255,255,255,0.65)",
        lift: "0 24px 60px -28px rgba(17,24,39,0.30)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(14px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "fade-in": "fadeIn 180ms ease-out both",
        "slide-up": "slideUp 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in-right": "slideInRight 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};
