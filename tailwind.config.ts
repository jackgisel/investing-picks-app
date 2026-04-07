import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0C0C0C",
          secondary: "#141414",
          tertiary: "#1C1C1C",
        },
        border: {
          DEFAULT: "#252525",
          light: "#333333",
        },
        accent: {
          green: "#22C55E",
          "green-soft": "#166534",
          "green-hover": "#16A34A",
          red: "#EF4444",
          "red-soft": "#7F1D1D",
          purple: "#818CF8",
          "purple-soft": "#1E1B4B",
        },
        text: {
          DEFAULT: "#F0F0F0",
          muted: "#999999",
          dim: "#666666",
        },
      },
      fontFamily: {
        mono: ["IBM Plex Mono", "monospace"],
        sans: ["IBM Plex Sans", "sans-serif"],
        serif: ["IBM Plex Serif", "serif"],
      },
      letterSpacing: {
        widest: "0.2em",
        wider: "0.15em",
      },
    },
  },
  plugins: [],
};

export default config;
