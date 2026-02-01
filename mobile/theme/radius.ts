export const radius = {
  none: 0,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  '2xl': 18,
  '3xl': 22,
  full: 9999,
} as const;

export type Radius = typeof radius;
export type RadiusKey = keyof Radius;
export type RadiusValue = Radius[RadiusKey];
