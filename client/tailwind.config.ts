import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        sentinel: {
          ink: "#111827",
          blue: "#1d4ed8",
          teal: "#0f766e"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
