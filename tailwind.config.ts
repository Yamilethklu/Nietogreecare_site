import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1360px" },
    },
    extend: {
      colors: {
        /* Verde esmeralda / bosque profundo */
        forest: {
          50: "#F2FBF5",
          100: "#DCFCE7",
          200: "#BBF7D0",
          300: "#86EFAC",
          400: "#4ADE80",
          500: "#16A34A",
          600: "#166534",
          700: "#14532D",
          800: "#0F3D22",
          900: "#0A2A17",
          950: "#05170C",
        },
        /* Negro azabache */
        ink: {
          50: "#F6F7F9",
          200: "#D7DAE0",
          400: "#6B7280",
          600: "#374151",
          700: "#1F2937",
          800: "#111827",
          900: "#0B1120",
          950: "#090D16",
        },
        /* Café / madera */
        wood: {
          50: "#FBF6EF",
          200: "#EBD9C0",
          300: "#D9B98C",
          400: "#B45309",
          500: "#92400E",
          600: "#8A3A0C",
          700: "#78350F",
          800: "#5A2609",
          900: "#3D1906",
        },
        /* Dorado suave */
        gold: {
          100: "#FBF3DC",
          200: "#F5E6B8",
          300: "#EBD79A",
          400: "#DCC178",
          500: "#C9A227",
          600: "#A8851B",
          700: "#826414",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Playfair Display", "Georgia", "serif"],
        serif: ["var(--font-serif)", "Cinzel", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        luxury: "0 24px 60px -24px rgba(9, 13, 22, 0.75)",
        gold: "0 0 0 1px rgba(201, 162, 39, 0.35), 0 18px 40px -22px rgba(201, 162, 39, 0.45)",
        inset: "inset 0 1px 0 0 rgba(255,255,255,0.06)",
      },
      backgroundImage: {
        "forest-radial":
          "radial-gradient(1200px 600px at 15% -10%, rgba(22,101,52,0.35), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(120,53,15,0.28), transparent 55%)",
        "gold-line":
          "linear-gradient(90deg, transparent, rgba(201,162,39,0.55), transparent)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2.5s linear infinite",
        "fade-up": "fade-up 0.6s ease-out both",
        "float-slow": "float-slow 6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;