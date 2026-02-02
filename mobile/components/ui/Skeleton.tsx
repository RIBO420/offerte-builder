import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle } from 'react-native';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  width?: number | string;
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
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      className={cn('bg-muted rounded-md', className)}
      style={[
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

// SkeletonCard for card placeholders
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View className="bg-card border border-border rounded-xl p-4">
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
