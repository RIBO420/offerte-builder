/* eslint-disable @typescript-eslint/no-require-imports */
const { colors } = require('./theme/colors');

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
        // Base colors from theme
        background: {
          DEFAULT: colors.background,
          secondary: colors.surface,
          tertiary: colors.surfaceElevated,
        },
        foreground: colors.foreground,

        // Card
        card: {
          DEFAULT: colors.card,
          foreground: colors.cardForeground,
        },

        // Primary
        primary: {
          DEFAULT: colors.primary,
          foreground: colors.primaryForeground,
        },

        // Secondary
        secondary: {
          DEFAULT: colors.secondary,
          foreground: colors.secondaryForeground,
        },

        // Muted
        muted: {
          DEFAULT: colors.muted,
          foreground: colors.mutedForeground,
        },

        // Accent
        accent: {
          DEFAULT: colors.accent,
          foreground: colors.accentForeground,
          muted: `${colors.accent}26`,
          hover: colors.accentForeground,
        },

        // Destructive
        destructive: {
          DEFAULT: colors.destructive,
          foreground: colors.destructiveForeground,
        },

        // Borders & Input
        border: colors.border,
        input: colors.input,
        ring: colors.ring,

        // Semantic Colors
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',

        // Surface
        surface: {
          DEFAULT: colors.surface,
          elevated: colors.surfaceElevated,
          overlay: colors.surfaceOverlay,
        },

        // Nature
        nature: {
          dark: colors.natureDark,
          light: colors.natureLight,
        },

        // Garden Scope Colors (Brand)
        scope: { ...colors.scope },

        // Trend Colors
        trend: { ...colors.trend },
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
