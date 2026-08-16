import type { Config } from "tailwindcss";

const withOpacity = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // lib/tones.ts holds the per-tone class maps — without this they're purged.
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: withOpacity("--color-bg"),
          secondary: withOpacity("--color-bg-secondary"),
          tertiary: withOpacity("--color-bg-tertiary"),
        },
        border: {
          DEFAULT: withOpacity("--color-border"),
          light: withOpacity("--color-border-light"),
          strong: withOpacity("--color-border-strong"),
        },
        accent: {
          green: withOpacity("--color-accent-green"),
          "green-soft": withOpacity("--color-accent-green-soft"),
          "green-hover": withOpacity("--color-accent-green-hover"),
          red: withOpacity("--color-accent-red"),
          "red-soft": withOpacity("--color-accent-red-soft"),
          purple: withOpacity("--color-accent-purple"),
          "purple-soft": withOpacity("--color-accent-purple-soft"),
          yellow: withOpacity("--color-accent-yellow"),
          peach: withOpacity("--color-accent-peach"),
          lilac: withOpacity("--color-accent-lilac"),
          mint: withOpacity("--color-accent-mint"),
          coral: withOpacity("--color-accent-coral"),
          cyan: withOpacity("--color-accent-cyan"),
        },
        text: {
          DEFAULT: withOpacity("--color-text"),
          muted: withOpacity("--color-text-muted"),
          dim: withOpacity("--color-text-dim"),
        },
        inverse: {
          DEFAULT: withOpacity("--color-inverse"),
          fg: withOpacity("--color-inverse-fg"),
        },
        // Ink for text sitting on the pastel accents. Those pastels are the same
        // in both themes, so their foreground has to be too — `text` would flip
        // to near-white and leave light-on-light chips.
        "on-accent": withOpacity("--color-on-accent"),
        // Paper the illustrations sit on. Cream in light, charcoal in dark —
        // each set of PNGs is drawn against that ground.
        plate: withOpacity("--color-plate"),
      },
      // Two faces, no more: Outfit sets everything, IBM Plex Mono carries the
      // numerals and tickers. There is deliberately no `serif` or `display`
      // alias — both used to point at Outfit, which meant `font-serif italic`
      // silently rendered as italic sans and read as a bug at every call site.
      fontFamily: {
        mono: ["IBM Plex Mono", "monospace"],
        sans: ["Outfit", "sans-serif"],
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
