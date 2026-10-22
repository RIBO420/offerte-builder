import { Platform } from 'react-native';

/**
 * Huisstijlletter Outfit (@expo-google-fonts/outfit), geladen in app/_layout.tsx.
 * In React Native kies je het gewicht via de familienaam, niet via fontWeight:
 * een custom familie + fontWeight valt op iOS terug op de systeemletter en wordt op
 * Android nep-vet. De Text-wrapper (components/ui/Tekst.tsx) zet fontWeight daarom
 * om: 600 en zwaarder → `halfvet`, de rest → `regulier`. De gids kent alleen 400
 * (tekst) en 600 (koppen, namen, knoppen).
 */
export const lettertype = {
  regulier: 'Outfit_400Regular',
  halfvet: 'Outfit_600SemiBold',
} as const;

export const typography = {
  fontFamily: {
    sans: lettertype.regulier,
    display: lettertype.halfvet,
    mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  fontSize: {
    xs: 10,
    sm: 12,
    base: 13,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 22,
    '3xl': 28,
    '4xl': 34,
  },
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 1,
    wider: 1.5,
  },
} as const;

/**
 * Tekststijlen van de veldapp — de iOS-schaal (Large Title t/m Caption). Body is
 * 17 pt: medewerkers lezen buiten, vaak op armlengte. Nooit kleiner dan 12.
 * Spatiëring is op Outfit afgesteld (niet de SF-tabel): grote koppen iets strakker,
 * lopende tekst neutraal.
 */
export const tekst = {
  grootTitel: { fontSize: 34, lineHeight: 41, fontFamily: lettertype.halfvet, fontWeight: '600' as const, letterSpacing: -0.5 },
  titel1: { fontSize: 28, lineHeight: 34, fontFamily: lettertype.halfvet, fontWeight: '600' as const, letterSpacing: -0.4 },
  titel2: { fontSize: 22, lineHeight: 28, fontFamily: lettertype.halfvet, fontWeight: '600' as const, letterSpacing: -0.2 },
  titel3: { fontSize: 20, lineHeight: 25, fontFamily: lettertype.halfvet, fontWeight: '600' as const, letterSpacing: -0.1 },
  kop: { fontSize: 17, lineHeight: 22, fontFamily: lettertype.halfvet, fontWeight: '600' as const, letterSpacing: 0 },
  body: { fontSize: 17, lineHeight: 22, fontFamily: lettertype.regulier, fontWeight: '400' as const, letterSpacing: 0 },
  callout: { fontSize: 16, lineHeight: 21, fontFamily: lettertype.regulier, fontWeight: '400' as const, letterSpacing: 0 },
  sub: { fontSize: 15, lineHeight: 20, fontFamily: lettertype.regulier, fontWeight: '400' as const, letterSpacing: 0 },
  voetnoot: { fontSize: 13, lineHeight: 18, fontFamily: lettertype.regulier, fontWeight: '400' as const, letterSpacing: 0 },
  bijschrift: { fontSize: 12, lineHeight: 16, fontFamily: lettertype.regulier, fontWeight: '400' as const, letterSpacing: 0.1 },
  /** Uren en tellingen: cijfers lijnen uit in kolommen. */
  cijfers: { fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
} as const;

export type Typography = typeof typography;
export type FontFamily = keyof Typography['fontFamily'];
export type FontSize = keyof Typography['fontSize'];
export type FontWeight = keyof Typography['fontWeight'];
export type LineHeight = keyof Typography['lineHeight'];
export type LetterSpacing = keyof Typography['letterSpacing'];
