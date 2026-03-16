export const springConfigs = {
  default: { damping: 15, stiffness: 150 },
  gentle: { damping: 20, stiffness: 120 },
  bouncy: { damping: 10, stiffness: 180 },
  snappy: { damping: 20, stiffness: 300 },
  slow: { damping: 25, stiffness: 80 },
} as const;

export const durations = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  xslow: 800,
} as const;

export const easings = {
  easeOut: [0.25, 0.1, 0.25, 1] as const,
  easeInOut: [0.42, 0, 0.58, 1] as const,
  spring: [0.175, 0.885, 0.32, 1.275] as const,
} as const;

export type SpringConfig = keyof typeof springConfigs;
export type Duration = keyof typeof durations;
