import { Platform } from 'react-native';

export const typography = {
  fontFamily: {
    sans: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
    mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
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
} as const;

export type Typography = typeof typography;
export type FontFamily = keyof Typography['fontFamily'];
export type FontSize = keyof Typography['fontSize'];
export type FontWeight = keyof Typography['fontWeight'];
export type LineHeight = keyof Typography['lineHeight'];
