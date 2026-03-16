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

export type Typography = typeof typography;
export type FontFamily = keyof Typography['fontFamily'];
export type FontSize = keyof Typography['fontSize'];
export type FontWeight = keyof Typography['fontWeight'];
export type LineHeight = keyof Typography['lineHeight'];
export type LetterSpacing = keyof Typography['letterSpacing'];
