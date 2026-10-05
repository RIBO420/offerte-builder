import React from 'react';
import { View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { cn } from '@/lib/utils';
import { useVeldKleuren } from '../veld/BuitenModus';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  className?: string;
}

/** Ademend laadvlak: een CSS-animatie op opacity, volledig op de UI-thread. */
export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style, className }: SkeletonProps) {
  const kleuren = useVeldKleuren();
  const rustig = useReducedMotion();
  return (
    <Animated.View
      className={cn(className)}
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: kleuren.muted,
          ...(rustig
            ? {}
            : {
                animationName: { from: { opacity: 1 }, to: { opacity: 0.45 } },
                animationDuration: 900,
                animationIterationCount: 'infinite',
                animationDirection: 'alternate',
                animationTimingFunction: 'ease-in-out',
              }),
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const kleuren = useVeldKleuren();
  return (
    <View style={{ backgroundColor: kleuren.card, borderWidth: 1, borderColor: kleuren.border, borderRadius: 18, padding: 16, gap: 10 }}>
      <Skeleton width={140} height={18} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} height={14} />
      ))}
    </View>
  );
}

export function SkeletonAvatar({ size = 48 }: { size?: number }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} />;
}
