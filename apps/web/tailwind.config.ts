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
          DEFAULT: "#FFFFFF",
          secondary: "#F4F4F4",
          tertiary: "#EBEBEB",
        },
        border: {
          DEFAULT: "#E5E5E5",
          light: "#D4D4D4",
          strong: "#0A0A0A",
        },
        accent: {
          green: "#16A34A",
          "green-soft": "#DCFCE7",
          "green-hover": "#15803D",
          red: "#DC2626",
          "red-soft": "#FEE2E2",
          purple: "#7C3AED",
          "purple-soft": "#EDE9FE",
          yellow: "#F5D76E",
          peach: "#F0A86C",
          lilac: "#C4B0E0",
          mint: "#A8D9A0",
          coral: "#F07167",
          cyan: "#7EC8D8",
        },
        text: {
          DEFAULT: "#0A0A0A",
          muted: "#525252",
          dim: "#737373",
        },
      },
      fontFamily: {
        mono: ["IBM Plex Mono", "monospace"],
        sans: ["Outfit", "sans-serif"],
        serif: ["Outfit", "sans-serif"],
        display: ["Outfit", "sans-serif"],
      },
      borderRadius: {
        pill: "9999px",
        soft: "1.25rem",
      },
      letterSpacing: {
        widest: "0.2em",
        wider: "0.15em",
      },
      maxWidth: {
        op: "1120px",
      },
    },
  },
  plugins: [],
};

export default config;
