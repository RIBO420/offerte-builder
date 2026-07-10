import React, { useEffect, useMemo } from 'react';
import { View, Animated, ViewStyle, DimensionValue } from 'react-native';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius,
  style,
  className
}: SkeletonProps) {
  // useMemo i.p.v. useRef(...).current: zelfde stabiele Animated.Value,
  // maar zonder ref-toegang tijdens render (react-hooks/refs).
  const shimmerAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();
    // shimmerAnim is een stabiele useMemo-waarde; opnemen is gedragsneutraal.
  }, [shimmerAnim]);

  // Shimmer colors: #1A1A1A -> #222222 -> #1A1A1A
  const backgroundColor = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#1A1A1A', '#222222'],
  });

  return (
    <Animated.View
      className={cn('rounded-md', className)}
      style={[
        { width, height, borderRadius, backgroundColor },
        style,
      ]}
    />
  );
}

// SkeletonCard for card placeholders
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={{ backgroundColor: '#111111', borderWidth: 1, borderColor: '#222222', borderRadius: 12, padding: 16 }}>
      <Skeleton width={120} height={16} className="mb-3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={14}
          className="mt-2"
        />
      ))}
    </View>
  );
}

// SkeletonAvatar for avatar placeholders
export function SkeletonAvatar({ size = 48 }: { size?: number }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} />;
}
