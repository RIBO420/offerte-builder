// theme/colors.ts
export const colors = {
  // Base Colors (Dark Mode - Primary)
  background: '#0A0A0A',
  foreground: '#FAFAFA',
  card: '#111111',
  cardForeground: '#E8E8E8',

  // Primary
  primary: '#4ADE80',
  primaryForeground: '#0A0A0A',

  // Secondary
  secondary: '#1A2E1A',
  secondaryForeground: '#6B8F6B',

  // Muted
  muted: '#1A1A1A',
  mutedForeground: '#888888',

  // Accent
  accent: '#2D5A27',
  accentForeground: '#4ADE80',

  // Destructive
  destructive: '#DC2626',
  destructiveForeground: '#FAFAFA',

  // Border & Input
  border: '#222222',
  input: '#1A1A1A',
  ring: '#4ADE80',

  // Surface
  surface: '#111111',
  surfaceElevated: '#1A1A1A',
  surfaceOverlay: '#1A1A1AEE',

  // Nature
  natureDark: '#1A2E1A',
  natureLight: '#0D1F0D',

  // Scope Colors (Garden Theme - Brand Identity)
  scope: {
    grondwerk: '#8B7355',
    bestrating: '#6B7280',
    borders: '#2D5A27',
    gras: '#4ADE80',
    houtwerk: '#92400E',
    water: '#3B82F6',
    specials: '#9333EA',
  },

  // Trend Colors
  trend: {
    positive: '#22C55E',
    negative: '#EF4444',
    neutral: '#6B7280',
  },

  // Chart Colors
  chart: {
    1: '#F97316',
    2: '#06B6D4',
    3: '#6366F1',
    4: '#FACC15',
    5: '#FB923C',
  },
};

export const darkColors: ColorScheme = {
  // Light Mode Overrides
  background: '#FAFAF8',
  foreground: '#1A1A1A',
  card: '#FFFFFF',
  cardForeground: '#2D2D2D',
  primary: '#2D5A27',
  primaryForeground: '#FFFFFF',
  secondary: '#F0EDE4',
  secondaryForeground: '#6B8F6B',
  muted: '#F5F5F5',
  mutedForeground: '#666666',
  accent: '#1A2E1A',
  accentForeground: '#2D5A27',
  destructive: '#DC2626',
  destructiveForeground: '#FAFAFA',
  border: '#E8E4DC',
  input: '#F5F5F5',
  ring: '#2D5A27',

  // Surface
  surface: '#FFFFFF',
  surfaceElevated: '#F5F5F5',
  surfaceOverlay: '#FFFFFFEE',

  // Nature
  natureDark: '#E8F5E9',
  natureLight: '#F1F8F1',

  // Scope colors - +0.1 lightness for dark mode visibility (aligned with webapp)
  scope: {
    grondwerk: '#B09070', // oklch(0.65 0.12 85) - Aarde/bruin
    bestrating: '#9A9CA0', // oklch(0.65 0.02 250) - Steen/grijs
    borders: '#4D8C4D', // oklch(0.55 0.15 145) - Bosgroen
    gras: '#7DD98C', // oklch(0.75 0.2 130) - Helder gras groen
    houtwerk: '#A87A50', // oklch(0.6 0.12 55) - Warm hout
    water: '#5AA0D0', // oklch(0.65 0.15 230) - Blauw water
    specials: '#B070D0', // oklch(0.65 0.2 300) - Paars specials
  },

  // Trend colors - +0.1 lightness for dark mode (aligned with webapp)
  trend: {
    positive: '#5AD070', // oklch(0.7 0.2 145) - Groen
    negative: '#E88080', // oklch(0.7 0.2 25) - Rood
    neutral: '#8A8A8A', // oklch(0.6 0 0) - Grijs
  },

  // Chart colors aligned with webapp dark mode
  chart: {
    1: '#6B8CF8', // oklch(0.488 0.243 264.376)
    2: '#4DD9A0', // oklch(0.696 0.17 162.48)
    3: '#F5C050', // oklch(0.769 0.188 70.08)
    4: '#C080F0', // oklch(0.627 0.265 303.9)
    5: '#F08060', // oklch(0.645 0.246 16.439)
  },
};

export type ColorScheme = typeof colors;
