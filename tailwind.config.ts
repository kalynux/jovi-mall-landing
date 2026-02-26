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
        primary: {
          50: "#f5f0ff",
          100: "#ede5ff",
          200: "#dcceff",
          300: "#c3a8ff",
          400: "#a474ff",
          500: "#8b47ff",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#581dc0",
          900: "#48189a",
          950: "#2d0e6d",
        },
        wa: {
          DEFAULT: "#25d366",
          light: "#dcfce7",
          dark: "#128C7E",
          bubble: "#d9fdd3",
        },
        surface: {
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d1d5db",
          800: "#1f2937",
          900: "#111827",
          950: "#030712",
        },
      },
      fontFamily: {
        display: ["Outfit", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "hero-xl": ["clamp(2.5rem,6vw,5rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "hero-lg": ["clamp(2rem,4.5vw,3.75rem)", { lineHeight: "1.1", letterSpacing: "-0.025em" }],
        "section": ["clamp(1.75rem,3vw,2.75rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
      },
      backgroundImage: {
        "hero-glow": "radial-gradient(ellipse 80% 60% at 50% -5%, rgba(124,58,237,0.28) 0%, transparent 70%)",
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      boxShadow: {
        "glow-primary": "0 0 40px rgba(124,58,237,0.3)",
        "glow-wa": "0 0 30px rgba(37,211,102,0.25)",
        card: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 6px rgba(0,0,0,0.07), 0 16px 48px rgba(0,0,0,0.12)",
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
