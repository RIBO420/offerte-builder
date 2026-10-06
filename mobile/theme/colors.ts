// theme/colors.ts
/**
 * "Tuinvenster" (okt 2026): de veldapp van Top Tuinen. Licht = bosgroen op warm
 * gebroken wit; donker = zacht bladgroen op diep groenzwart. Kleur draagt betekenis:
 * het merkgroen is actie en status, de aardetinten (`werk*`) zijn de soort werk in
 * de tijdlijn. Het tuinbeeld bovenaan Home (assets/tuin) is de enige sfeerlaag.
 */
export const colors = {
  // Basis (donker)
  background: '#0E1210',
  foreground: '#EEF2EE',
  card: '#171C19',
  cardForeground: '#E6EBE6',

  primary: '#7BD389',
  primaryForeground: '#0E1210',

  secondary: '#1D2621',
  secondaryForeground: '#A8C9AE',

  muted: '#1C221E',
  mutedForeground: '#9AA59D',

  accent: '#22302A',
  accentForeground: '#7BD389',

  destructive: '#E5484D',
  destructiveForeground: '#FFFFFF',

  border: '#262D28',
  input: '#1C221E',
  ring: '#7BD389',

  // Tabiconen, placeholders, uitgeschakeld
  inactive: '#8B958E',

  // Vlak en rand van bedieningselementen óp een kaart (keuzechips, grijze
  // knoppen). `muted` valt in donker weg tegen `card`; deze niet.
  vulling: '#28312B',
  randSterk: '#3A453D',

  surface: '#171C19',
  surfaceElevated: '#1E2520',
  surfaceOverlay: '#171C19EE',

  natureDark: '#1D2621',
  natureLight: '#121815',

  primarySoft: 'rgba(123,211,137,0.14)',
  gradientStart: '#1A221E',
  gradientEnd: '#171C19',
  gradientBorder: '#2B342E',
  success: '#7BD389',
  successSoft: 'rgba(123,211,137,0.14)',
  warning: '#E9B949',
  warningSoft: 'rgba(233,185,73,0.14)',
  info: '#8DB8E8',
  infoSoft: 'rgba(141,184,232,0.14)',
  danger: '#F07A7E',
  dangerSoft: 'rgba(240,122,126,0.14)',

  // Soort werk in de dagtijdlijn (witte tekst erop).
  werkAanleg: '#9C5233',
  werkOnderhoud: '#47704D',
  werkBestrating: '#53677A',
  werkLoods: '#5E5A53',
  werkReis: '#4F5E56',
  werkPauze: '#232A25',

  // Verduistering achter modals en sheets. Gelijk in alle thema's (licht en
  // buiten erven hem), dus bewust niet overschreven hieronder.
  scrim: 'rgba(0,0,0,0.5)',

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
  background: '#F6F7F2',
  foreground: '#18201B',
  card: '#FFFFFF',
  cardForeground: '#222A25',
  primary: '#1F5D3A',
  primaryForeground: '#FFFFFF',
  secondary: '#EAF0E8',
  secondaryForeground: '#1F5D3A',
  muted: '#EEF1EA',
  mutedForeground: '#5E6A62',
  accent: '#E3ECE2',
  accentForeground: '#1F5D3A',
  destructive: '#C2362F',
  destructiveForeground: '#FFFFFF',
  border: '#E1E6DD',
  input: '#EEF1EA',
  ring: '#1F5D3A',

  // Tabiconen en placeholders: ≥4,5:1 op de achtergrond.
  inactive: '#66706A',
  vulling: '#E8EDE3',
  randSterk: '#C9D1C4',

  surface: '#FFFFFF',
  surfaceElevated: '#F1F4EE',
  surfaceOverlay: '#FFFFFFEE',

  natureDark: '#E3ECE2',
  natureLight: '#F1F5EF',

  primarySoft: 'rgba(31,93,58,0.09)',
  gradientStart: '#FFFFFF',
  gradientEnd: '#FFFFFF',
  gradientBorder: '#E1E6DD',
  success: '#2C7A47',
  successSoft: 'rgba(44,122,71,0.10)',
  warning: '#94570A',
  warningSoft: 'rgba(217,141,6,0.12)',
  info: '#2B6496',
  infoSoft: 'rgba(43,100,150,0.10)',
  danger: '#B42F29',
  dangerSoft: 'rgba(180,47,41,0.09)',

  werkAanleg: '#A9552F',
  werkOnderhoud: '#4C7A52',
  werkBestrating: '#5A6E80',
  werkLoods: '#76716A',
  werkReis: '#5D6B63',
  werkPauze: '#ECEFE8',

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
  vulling: '#E6E6E6',
  randSterk: '#000000',
  surface: '#FFFFFF',
  surfaceElevated: '#F2F2F2',
  surfaceOverlay: '#FFFFFFEE',
  primarySoft: '#E3F0E6',
  gradientStart: '#FFFFFF',
  gradientEnd: '#FFFFFF',
  gradientBorder: '#000000',
  success: '#166534',
  successSoft: '#E3F0E6',
  warning: '#92400E',
  warningSoft: '#FDF1E3',
  info: '#1E40AF',
  infoSoft: '#E6ECFA',
  danger: '#B91C1C',
  dangerSoft: '#FBE7E7',
  werkAanleg: '#7A3B1E',
  werkOnderhoud: '#14532D',
  werkBestrating: '#1E3A5F',
  werkLoods: '#3F3B36',
  werkReis: '#334038',
  werkPauze: '#F2F2F2',
};
