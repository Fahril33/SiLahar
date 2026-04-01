import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        mist: "#eef3f8",
        sand: "#fff7ea",
        coral: "#e67c52",
        lagoon: "#287271",
        plum: "#5f4b8b"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(23, 32, 51, 0.12)"
      },
      fontFamily: {
        sans: ["Segoe UI", "Tahoma", "Geneva", "Verdana", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
