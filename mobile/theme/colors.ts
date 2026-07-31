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
  secondaryForeground: '#8BAF8B', // WCAG AA: 5.2:1 on #0A0A0A (was #6B8F6B ~4.0:1)

  // Muted
  muted: '#1A1A1A',
  mutedForeground: '#999999', // WCAG AA: 6.3:1 on #0A0A0A (was #888888 ~5.4:1)

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

  // Inactive (tab icons, placeholder text, disabled states)
  inactive: '#888888', // WCAG AA: 5.4:1 on #0A0A0A (replaces hardcoded #555555 ~2.5:1)

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

/**
 * Overrides voor de LICHTE modus.
 *
 * Heette eerder `darkColors` terwijl het blok lichte waarden bevat (#FAFAF8 als
 * achtergrond). In combinatie met `isDark ? {...colors, ...darkColors} : colors` leverde
 * "donker" dus het lichte palet en andersom. Zie docs/MOBILE-AUDIT.md (B6).
 *
 * Let op: de spread in ThemeProvider is SHALLOW. Geneste objecten (`scope`, `trend`,
 * `chart`) moeten hier dus óf volledig gedefinieerd zijn óf helemaal ontbreken — een
 * half object wist de overige sleutels naar undefined. `chart` ontbreekt bewust: de
 * basiswaarden gelden.
 */
export const lightColors: Partial<ColorScheme> = {
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

  // Inactive (tab icons, placeholder text, disabled states)
  inactive: '#888888',

  // Surface
  surface: '#FFFFFF',
  surfaceElevated: '#F5F5F5',
  surfaceOverlay: '#FFFFFFEE',

  // Nature
  natureDark: '#E8F5E9',
  natureLight: '#F1F8F1',

  // Scope-kleuren, verdonkerd voor leesbaarheid op #FAFAF8.
  // De vorige waarden hier waren de dark-mode varianten (+0.1 lightness) en haalden op
  // een lichte achtergrond geen WCAG AA.
  scope: {
    grondwerk: '#8A6A48', // Aarde/bruin
    bestrating: '#6B6D71', // Steen/grijs
    borders: '#2F6B32', // Bosgroen
    gras: '#2D7A3E', // Grasgroen
    houtwerk: '#7D5433', // Warm hout
    water: '#2C6FA0', // Blauw water
    specials: '#7B3FA0', // Paars specials
  },

  trend: {
    positive: '#16803C',
    negative: '#B91C1C',
    neutral: '#6B6B6B',
  },
};

export type ColorScheme = typeof colors;

/**
 * "Buiten"-modus (PRD §2.6 / bijlage C): hoog-contrast licht thema voor fel
 * daglicht in het veld. Overschrijft de basistokens; samengevoegd via
 * { ...themeColors, ...buitenColors } in de veld-schermen. Zelfde waarden als
 * de web-veldweergave (BUITEN_STIJL in src/components/veld/veld-dag.tsx).
 */
export const buitenColors: Partial<ColorScheme> = {
  background: '#FFFFFF',
  foreground: '#000000',
  card: '#FFFFFF',
  cardForeground: '#000000',
  primary: '#166534',
  primaryForeground: '#FFFFFF',
  secondary: '#F2F2F2',
  secondaryForeground: '#166534',
  muted: '#F2F2F2',
  mutedForeground: '#1A1A1A',
  accent: '#166534',
  accentForeground: '#FFFFFF',
  destructive: '#B91C1C',
  destructiveForeground: '#FFFFFF',
  border: '#000000',
  input: '#F2F2F2',
  ring: '#166534',
  inactive: '#333333',
  surface: '#FFFFFF',
  surfaceElevated: '#F2F2F2',
  surfaceOverlay: '#FFFFFFEE',
};
