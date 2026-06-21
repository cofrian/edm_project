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
        // Paleta institucional sobria para una interfaz de producto.
        brand: {
          50: "#f1f5f9",
          100: "#e2e8f0",
          200: "#cbd5e1",
          300: "#94a3b8",
          400: "#64748b",
          500: "#475569",
          600: "#334155",
          700: "#1e293b",
          800: "#172033",
          900: "#0f172a",
          950: "#020617",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#fafafa",
          app: "#f8f9fa",
          900: "#0f172a",
          950: "#020617",
        },
        // Acento técnico para mapas, métricas positivas y estados activos.
        teal: {
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
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        card: "0 10px 40px -10px rgb(15 23 42 / 0.06), 0 2px 10px -6px rgb(15 23 42 / 0.06)",
        "card-hover": "0 20px 60px -20px rgb(15 23 42 / 0.14), 0 8px 24px -18px rgb(15 23 42 / 0.12)",
        map: "0 24px 70px -24px rgb(15 23 42 / 0.22)",
        "glow-cyan": "0 16px 36px -18px rgb(34 211 238 / 0.8)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
