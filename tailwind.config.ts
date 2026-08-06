import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand green (WiMall green) — remapped so existing `primary-*` usage re-skins.
        primary: {
          50: "#E9FBF2",
          100: "#C7F5DE",
          200: "#93E9C1",
          300: "#57D6A0",
          400: "#22BD82",
          500: "#0DA06B",
          600: "#068554",
          700: "#066844",
          800: "#075138",
          900: "#06412E",
          950: "#04311F",
        },
        // Shop design-system brand alias (CSS-var backed, theme-aware).
        brand: {
          DEFAULT: "var(--brand)",
          hover: "var(--brand-hover)",
          subtle: "var(--brand-subtle)",
          on: "var(--brand-on)",
        },
        amber: {
          50: "#FFF8EB",
          100: "#FCEFC7",
          200: "#FCE18A",
          300: "#FBD34D",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
        },
        wa: {
          DEFAULT: "#25d366",
          light: "#dcfce7",
          dark: "#128C7E",
          bubble: "#d9fdd3",
        },
        // Per-role accents (also exposed as CSS vars for section-scoped tinting)
        role: "var(--role, var(--accent))",
        vendor: "var(--accent-vendor)",
        agency: "var(--accent-agency)",
        agent: "var(--accent-agent)",
        customer: "var(--accent-customer)",
        // Warm-neutral surfaces + semantic tokens (CSS-var backed for theming).
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
          sunken: "var(--surface-sunken)",
          50: "#F8F8F6",
          100: "#F1F0EC",
          200: "#E6E4DE",
          300: "#D3D0C7",
          800: "#2A2822",
          900: "#1A1915",
          950: "#0F0E0B",
        },
        ink: {
          strong: "var(--text-strong)",
          body: "var(--text-body)",
          muted: "var(--text-muted)",
          subtle: "var(--text-subtle)",
        },
        line: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
          subtle: "var(--border-subtle)",
        },
      },
      fontFamily: {
        display: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "hero-xl": ["clamp(2.5rem,6vw,5rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "hero-lg": ["clamp(2rem,4.5vw,3.75rem)", { lineHeight: "1.1", letterSpacing: "-0.025em" }],
        "section": ["clamp(1.75rem,3vw,2.75rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        card: "var(--radius-card)",
        button: "var(--radius-button)",
        input: "var(--radius-input)",
        sheet: "var(--radius-sheet)",
        pill: "var(--radius-pill)",
      },
      backgroundImage: {
        "hero-glow": "radial-gradient(ellipse 80% 60% at 50% -5%, rgba(13,160,107,0.24) 0%, transparent 70%)",
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      boxShadow: {
        "glow-primary": "0 0 40px rgba(13,160,107,0.3)",
        "glow-wa": "0 0 30px rgba(37,211,102,0.25)",
        brand: "var(--shadow-brand)",
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        bar: "var(--shadow-bar)",
        sheet: "var(--shadow-sheet)",
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.7", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-4px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        float: "float 4s ease-in-out infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "typing-1": "typing-dot 1.2s ease-in-out infinite 0s",
        "typing-2": "typing-dot 1.2s ease-in-out infinite 0.2s",
        "typing-3": "typing-dot 1.2s ease-in-out infinite 0.4s",
        shimmer: "shimmer 2.5s linear infinite",
        "slide-in": "slide-in 0.5s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
