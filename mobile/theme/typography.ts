import { Platform } from 'react-native';

export const typography = {
  fontFamily: {
    sans: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
    display: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
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
 */
export const tekst = {
  grootTitel: { fontSize: 34, lineHeight: 41, fontWeight: '700' as const, letterSpacing: 0.37 },
  titel1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: 0.36 },
  titel2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: 0.35 },
  titel3: { fontSize: 20, lineHeight: 25, fontWeight: '600' as const, letterSpacing: 0.38 },
  kop: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' as const, letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' as const, letterSpacing: -0.32 },
  sub: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const, letterSpacing: -0.24 },
  voetnoot: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, letterSpacing: -0.08 },
  bijschrift: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0 },
  /** Uren en tellingen: cijfers lijnen uit in kolommen. */
  cijfers: { fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
} as const;

export type Typography = typeof typography;
export type FontFamily = keyof Typography['fontFamily'];
export type FontSize = keyof Typography['fontSize'];
export type FontWeight = keyof Typography['fontWeight'];
export type LineHeight = keyof Typography['lineHeight'];
export type LetterSpacing = keyof Typography['letterSpacing'];
