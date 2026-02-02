/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Linear/Vercel Dark Mode Palette
        background: {
          DEFAULT: '#0a0a0a',
          secondary: '#111111',
          tertiary: '#171717',
        },
        foreground: '#fafafa',

        // Card
        card: {
          DEFAULT: '#111111',
          foreground: '#fafafa',
        },

        // Primary (light on dark)
        primary: {
          DEFAULT: '#fafafa',
          foreground: '#0a0a0a',
        },

        // Secondary
        secondary: {
          DEFAULT: '#262626',
          foreground: '#fafafa',
        },

        // Muted
        muted: {
          DEFAULT: '#171717',
          foreground: '#a1a1aa',
        },

        // Accent (Linear Indigo)
        accent: {
          DEFAULT: '#6366f1',
          foreground: '#fafafa',
          muted: 'rgba(99,102,241,0.15)',
          hover: '#818cf8',
        },

        // Destructive
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#fafafa',
        },

        // Borders & Input
        border: '#262626',
        input: '#1a1a1a',
        ring: '#6366f1',

        // Semantic Colors
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',

        // Garden Scope Colors (Brand)
        scope: {
          grondwerk: '#B09070',
          bestrating: '#9A9CA0',
          borders: '#4D8C4D',
          gras: '#7DD98C',
          houtwerk: '#A87A50',
          water: '#5AA0D0',
          specials: '#B070D0',
        },

        // Trend Colors
        trend: {
          positive: '#22c55e',
          negative: '#ef4444',
          neutral: '#71717a',
        },
      },

      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },

      fontFamily: {
        sans: ['System'],
        mono: ['Menlo'],
      },
    },
  },
  plugins: [],
};
