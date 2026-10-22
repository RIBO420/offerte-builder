// theme/colors.ts
/**
 * Huisstijl Top Tuinen (okt 2026), zelfde rolverdeling als de web-app.
 * Licht = warm zwart op warm wit, mosgroen (#3A4A36) is actie; donker = warm wit
 * op warm zwart, lichte olijf (#A3B595) is actie. Goud (#A89968) is accent:
 * lijnen, vandaag-markering, voortgang. Status (succes/aandacht/negatief/info)
 * oogt bewust anders dan mosgroen en goud. De aardetinten (`werk*`) zijn de
 * soort werk in de tijdlijn; het tuinbeeld bovenaan Home is de enige sfeerlaag.
 */
export const colors = {
  // Basis (donker): warm zwart draagt, warm wit is de informatie.
  background: '#0F0F0D',
  foreground: '#E9E6E0',
  card: '#191915',
  cardForeground: '#E9E6E0',

  // Actie: lichte olijf met warm zwart erop.
  primary: '#A3B595',
  primaryForeground: '#0F0F0D',
  /** Ingedrukt/hover van een primaire knop. */
  primaryPressed: '#B7C6AB',

  secondary: '#22221D',
  secondaryForeground: '#A3B595',

  muted: '#1F1F1A',
  mutedForeground: '#A9A398',

  accent: '#24271F',
  accentForeground: '#A3B595',

  // Vlak van een destructieve knop; de leesbare foutkleur is `danger`.
  destructive: '#A4412F',
  destructiveForeground: '#F5F3F0',

  border: '#2C2B26',
  input: '#22221D',
  ring: '#A3B595',

  // Tabiconen, placeholders, uitgeschakeld (≥4,5:1 op background en card).
  inactive: '#8C877D',

  // Vlak en rand van bedieningselementen óp een kaart (keuzechips, grijze
  // knoppen). `muted` valt in donker weg tegen `card`; deze niet.
  vulling: '#2A2924',
  randSterk: '#3D3B34',

  surface: '#191915',
  surfaceElevated: '#21211C',
  surfaceOverlay: '#191915EE',

  natureDark: '#24271F',
  natureLight: '#141411',

  primarySoft: 'rgba(163,181,149,0.14)',
  gradientStart: '#1C1C18',
  gradientEnd: '#191915',
  gradientBorder: '#2C2B26',
  success: '#68B188',
  successSoft: 'rgba(104,177,136,0.14)',
  warning: '#D9934E',
  warningSoft: 'rgba(217,147,78,0.14)',
  info: '#7F95AA',
  infoSoft: 'rgba(127,149,170,0.14)',
  danger: '#E08A72',
  dangerSoft: 'rgba(224,138,114,0.14)',

  // Merkaccent (huisstijl): lijnen, vandaag-markering, voortgang. Nooit als
  // leestekst op licht (2,6:1).
  goud: '#A89968',
  goudSoft: 'rgba(168,153,104,0.18)',
  champagne: '#C9B89D',

  // Soort werk in de dagtijdlijn (tekst `opBeeld` erop).
  werkAanleg: '#9C5233',
  werkOnderhoud: '#4A5D45',
  werkBestrating: '#53677A',
  werkLoods: '#5E5A53',
  werkReis: '#4F5E56',
  werkPauze: '#22221D',

  // Thema-onafhankelijk: tekst/iconen op een foto of een gekleurd werkblok,
  // de foto-viewer en schaduwen. Bewust niet overschreven hieronder.
  opBeeld: '#F5F3F0',
  beeldDonker: '#0F0F0D',
  schaduw: '#0F0F0D',

  // Verduistering achter modals en sheets. Gelijk in alle thema's (licht en
  // buiten erven hem), dus bewust niet overschreven hieronder.
  scrim: 'rgba(15,15,13,0.5)',

  // Soort werk (scope) — gedempte aardetinten, passend bij de huisstijl.
  scope: {
    grondwerk: '#A08460',
    bestrating: '#8E8B84',
    borders: '#7E9A6E',
    gras: '#93AE7C',
    houtwerk: '#B07A50',
    water: '#7F95AA',
    specials: '#A38BB0',
  },

  // Trend Colors
  trend: {
    positive: '#68B188',
    negative: '#E08A72',
    neutral: '#A9A398',
  },

  // Chart Colors (gelijk aan de web-tokens --chart-1..5, donker)
  chart: {
    1: '#A3B595',
    2: '#C9B89D',
    3: '#7F95AA',
    4: '#D9934E',
    5: '#68B188',
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
 * half object wist de overige sleutels naar undefined.
 */
export const lightColors: Partial<ColorScheme> = {
  background: '#F5F3F0',
  foreground: '#0F0F0D',
  card: '#FBFAF7',
  cardForeground: '#0F0F0D',
  // Actie: mosgroen met warm wit; ingedrukt olijf.
  primary: '#3A4A36',
  primaryForeground: '#F5F3F0',
  primaryPressed: '#4A5D45',
  secondary: '#ECE9E3',
  secondaryForeground: '#3A4A36',
  muted: '#EEEBE5',
  mutedForeground: '#5F5D56',
  accent: '#E6E8DF',
  accentForeground: '#3A4A36',
  destructive: '#A4412F',
  destructiveForeground: '#F5F3F0',
  border: '#E3DED4',
  input: '#EEEBE5',
  ring: '#3A4A36',

  // Tabiconen en placeholders: ≥4,5:1 op de achtergrond.
  inactive: '#6B685F',
  vulling: '#EAE6DE',
  randSterk: '#CFC8BA',

  surface: '#FBFAF7',
  surfaceElevated: '#F0EDE7',
  surfaceOverlay: '#FBFAF7EE',

  natureDark: '#E6E8DF',
  natureLight: '#F0F1EA',

  primarySoft: 'rgba(58,74,54,0.09)',
  gradientStart: '#FBFAF7',
  gradientEnd: '#FBFAF7',
  gradientBorder: '#E3DED4',
  success: '#38865E',
  successSoft: 'rgba(56,134,94,0.10)',
  warning: '#BB7328',
  warningSoft: 'rgba(187,115,40,0.12)',
  info: '#5B7186',
  infoSoft: 'rgba(91,113,134,0.10)',
  danger: '#A4412F',
  dangerSoft: 'rgba(164,65,47,0.09)',

  // Als vulling op licht een diepere goudtint (web: accent-warm, 3,2:1).
  goud: '#9C8B57',
  goudSoft: 'rgba(156,139,87,0.16)',
  champagne: '#C9B89D',

  werkAanleg: '#9C5233',
  werkOnderhoud: '#4A5D45',
  werkBestrating: '#53677A',
  werkLoods: '#6B665E',
  werkReis: '#5A6359',
  werkPauze: '#ECE9E3',

  // Scope-kleuren, verdonkerd voor leesbaarheid op warm wit (≥4,5:1).
  scope: {
    grondwerk: '#7E6142', // Aarde/bruin
    bestrating: '#66635C', // Steen/grijs
    borders: '#3A4A36', // Mosgroen
    gras: '#4A6B3E', // Grasgroen
    houtwerk: '#7D5433', // Warm hout
    water: '#4E6378', // Blauw water
    specials: '#6E4F7E', // Paars specials
  },

  trend: {
    positive: '#38865E',
    negative: '#A4412F',
    neutral: '#5F5D56',
  },

  chart: {
    1: '#4A5D45',
    2: '#A89968',
    3: '#5B7186',
    4: '#BB7328',
    5: '#38865E',
  },
};

export type ColorScheme = typeof colors;

/**
 * "Buiten"-modus (PRD §2.6 / bijlage C): hoog-contrast licht thema voor fel
 * daglicht in het veld. Overschrijft de basistokens; samengevoegd via
 * { ...themeColors, ...buitenColors } in de veld-schermen. Huisstijlkleuren
 * (mosgroen, warm zwart), verdiept tot ≥6:1 op wit. De web-veldweergave
 * (BUITEN_STIJL in src/components/veld/veld-dag.tsx) volgt dezelfde rollen.
 */
export const buitenColors: Partial<ColorScheme> = {
  background: '#FFFFFF',
  foreground: '#0F0F0D',
  card: '#FFFFFF',
  cardForeground: '#0F0F0D',
  primary: '#3A4A36',
  primaryForeground: '#FFFFFF',
  primaryPressed: '#4A5D45',
  secondary: '#F2F0EC',
  secondaryForeground: '#3A4A36',
  muted: '#F2F0EC',
  mutedForeground: '#1A1A17',
  accent: '#3A4A36',
  accentForeground: '#FFFFFF',
  destructive: '#8C3424',
  destructiveForeground: '#FFFFFF',
  border: '#0F0F0D',
  input: '#F2F0EC',
  ring: '#3A4A36',
  inactive: '#33322D',
  vulling: '#E6E3DD',
  randSterk: '#0F0F0D',
  surface: '#FFFFFF',
  surfaceElevated: '#F2F0EC',
  surfaceOverlay: '#FFFFFFEE',
  primarySoft: '#E6EAE2',
  gradientStart: '#FFFFFF',
  gradientEnd: '#FFFFFF',
  gradientBorder: '#0F0F0D',
  success: '#2B6E4B',
  successSoft: '#E2F0E8',
  warning: '#8F5418',
  warningSoft: '#FAEEDF',
  info: '#3F5468',
  infoSoft: '#E6ECF2',
  danger: '#8C3424',
  dangerSoft: '#F8E6E2',
  goud: '#8A7C4E',
  goudSoft: '#F1EDE1',
  werkAanleg: '#7A3B1E',
  werkOnderhoud: '#3A4A36',
  werkBestrating: '#1E3A5F',
  werkLoods: '#3F3B36',
  werkReis: '#334038',
  werkPauze: '#F2F0EC',
};
