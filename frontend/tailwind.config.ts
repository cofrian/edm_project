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
        // Azul institucional (primario)
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd3ff",
          300: "#8eb6ff",
          400: "#598dff",
          500: "#3366ff",
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#1c3576",
          950: "#11214d",
        },
        // Verde-azulado (cobertura / impacto positivo)
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
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 33 77 / 0.04), 0 1px 3px 0 rgb(16 33 77 / 0.06)",
        "card-hover": "0 8px 24px -8px rgb(16 33 77 / 0.18)",
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
