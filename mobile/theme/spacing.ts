export const spacing = {
  0: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

// Numeric spacing for array-based access
export const spacingValues = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;

export type Spacing = typeof spacing;
export type SpacingKey = keyof Spacing;
export type SpacingValue = Spacing[SpacingKey];
export type SpacingValues = typeof spacingValues;
