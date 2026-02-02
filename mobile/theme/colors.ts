// theme/colors.ts
export const colors = {
  // Base Colors (Light Mode)
  background: '#FFFFFF',
  foreground: '#1A1A1A',
  card: '#FFFFFF',
  cardForeground: '#1A1A1A',

  // Primary
  primary: '#2D2D2D',
  primaryForeground: '#FAFAFA',

  // Secondary
  secondary: '#F5F5F5',
  secondaryForeground: '#2D2D2D',

  // Muted
  muted: '#F5F5F5',
  mutedForeground: '#737373',

  // Accent
  accent: '#F5F5F5',
  accentForeground: '#2D2D2D',

  // Destructive
  destructive: '#DC2626',
  destructiveForeground: '#FAFAFA',

  // Border & Input
  border: '#E5E5E5',
  input: '#E5E5E5',
  ring: '#A3A3A3',

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
  // Aligned with webapp dark mode (OKLCH color space converted to hex)
  background: '#0A0A0A', // oklch(0.145 0 0) - darker background
  foreground: '#FAFAFA', // oklch(0.985 0 0)
  card: '#1A1A1A', // oklch(0.205 0 0) - slightly lighter than background
  cardForeground: '#FAFAFA', // oklch(0.985 0 0)
  primary: '#FAFAFA', // oklch(0.985 0 0) - primary text
  primaryForeground: '#1A1A1A', // oklch(0.205 0 0)
  secondary: '#A1A1AA', // oklch(0.708 0 0) - secondary text
  secondaryForeground: '#FAFAFA', // oklch(0.985 0 0)
  muted: '#3D3D3D', // oklch(0.269 0 0)
  mutedForeground: '#71717A', // oklch(0.556 0 0) - tertiary text
  accent: '#6366F1', // Indigo - Linear/Vercel style
  accentForeground: '#FAFAFA', // oklch(0.985 0 0)
  destructive: '#E57373', // oklch(0.704 0.191 22.216) - proper dark variant
  destructiveForeground: '#0A0A0A', // Match background for contrast
  border: 'rgba(255,255,255,0.2)', // oklch(1 0 0 / 20%)
  input: 'rgba(255,255,255,0.15)', // oklch(1 0 0 / 15%)
  ring: '#737373', // oklch(0.556 0 0)

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
