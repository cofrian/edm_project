import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          950: "#060a12",
          900: "#0c1220",
          800: "#131b2e",
          700: "#1a2540",
        },
        brand: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
          950: "#083344",
        },
        teal: {
          50: "#effcf9",
          100: "#c8fbef",
          200: "#94f3e1",
          300: "#56e3cf",
          400: "#28c7b6",
          500: "#0fa99c",
          600: "#0a877f",
          700: "#0c6b67",
          800: "#0e5553",
          900: "#0f4745",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.2), 0 4px 16px -4px rgb(0 0 0 / 0.35)",
        "card-hover": "0 8px 32px -8px rgb(0 0 0 / 0.45)",
        "glow-cyan": "0 0 24px rgb(34 211 238 / 0.25)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.4s ease-out both",
        shimmer: "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
