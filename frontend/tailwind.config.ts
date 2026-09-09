import type { Config } from "tailwindcss";

// Design system: adapted from the "Linear" recipe (Modern Tool / Builder SaaS) --
// warm near-black ground, hairline borders, one restrained purple accent.
// Severity colors are a deliberate functional exception: a compliance/legal
// audit tool needs real semantic red/amber/green for risk levels, kept
// desaturated to stay in the recipe's restrained register rather than
// full-saturated alert colors.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#08090A",
        // Semi-transparent, not opaque: paired with backdrop-blur on real
        // card surfaces, this is what lets the ambient glow read THROUGH
        // cards instead of being blocked flat -- genuine layered depth
        // rather than solid boxes sitting on top of a background image.
        surface: {
          1: "rgba(21,22,26,0.6)",
          2: "rgba(28,29,35,0.65)",
          3: "rgba(38,39,46,0.75)",
        },
        hairline: "rgba(255,255,255,0.07)",
        "hairline-strong": "rgba(255,255,255,0.14)",
        ink: {
          primary: "#F3F4F6",
          secondary: "#9AA1AC",
          muted: "#666B76",
        },
        accent: {
          DEFAULT: "#5E6AD2",
          hover: "#7178E0",
          soft: "rgba(94,106,210,0.12)",
          border: "rgba(94,106,210,0.32)",
        },
        severity: {
          high: "#E8695E",
          "high-soft": "rgba(232,105,94,0.12)",
          "high-border": "rgba(232,105,94,0.30)",
          medium: "#DBA138",
          "medium-soft": "rgba(219,161,56,0.12)",
          "medium-border": "rgba(219,161,56,0.30)",
          low: "#5FBE8A",
          "low-soft": "rgba(95,190,138,0.12)",
          "low-border": "rgba(95,190,138,0.30)",
        },
        // A second, deliberately distinct severity vocabulary for risk-flag
        // cards specifically: red/amber/GRAY (not green) -- "low severity"
        // reads as "quiet, don't worry about it" rather than success-green,
        // which would otherwise collide with the specialist identity colors
        // now sharing a card (see lib/specialists.ts) and with the
        // unrelated "done/clear" green used on the pipeline tree.
        risk: {
          high: "#E8695E",
          "high-soft": "rgba(232,105,94,0.12)",
          "high-border": "rgba(232,105,94,0.30)",
          medium: "#DBA138",
          "medium-soft": "rgba(219,161,56,0.12)",
          "medium-border": "rgba(219,161,56,0.30)",
          low: "#9AA1AC",
          "low-soft": "rgba(154,161,172,0.12)",
          "low-border": "rgba(154,161,172,0.30)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "12px",
        lg: "16px",
      },
      boxShadow: {
        raised: "0 1px 2px rgba(0,0,0,0.35)",
        panel: "0 12px 32px rgba(0,0,0,0.45)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.23, 1, 0.32, 1)",
        "in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
        drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
        layout: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "edge-pulse": {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "0.9" },
        },
        "spin-linear": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 400ms cubic-bezier(0.23,1,0.32,1) both",
        "fade-in": "fade-in 300ms cubic-bezier(0.23,1,0.32,1) both",
        "edge-pulse": "edge-pulse 1.8s cubic-bezier(0.45,0,0.55,1) infinite",
        "spin-linear": "spin-linear 700ms linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
