import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';

type TrendDirection = 'up' | 'down' | 'neutral';

interface TrendIndicatorProps {
  value: number; // Percentage change
  direction?: TrendDirection; // Override auto-detection
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function TrendIndicator({
  value,
  direction,
  showValue = true,
  size = 'md',
}: TrendIndicatorProps) {
  const autoDirection: TrendDirection = value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
  const actualDirection = direction ?? autoDirection;

  const trendColors = {
    up: colors.trend.positive,
    down: colors.trend.negative,
    neutral: colors.trend.neutral,
  };

  const icons: Record<TrendDirection, 'trending-up' | 'trending-down' | 'minus'> = {
    up: 'trending-up',
    down: 'trending-down',
    neutral: 'minus',
  };

  const iconSizes = { sm: 14, md: 16, lg: 20 };
  const fontSizes = { sm: typography.fontSize.xs, md: typography.fontSize.sm, lg: typography.fontSize.base };
  const paddingSizes = { sm: { h: 6, v: 2 }, md: { h: 8, v: 4 }, lg: { h: 10, v: 6 } };

  const currentColor = trendColors[actualDirection];
  const currentPadding = paddingSizes[size];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: currentColor + '20',
          paddingHorizontal: currentPadding.h,
          paddingVertical: currentPadding.v,
        },
      ]}
    >
      <Feather name={icons[actualDirection]} size={iconSizes[size]} color={currentColor} />
      {showValue && (
        <Text
          style={[
            styles.value,
            {
              color: currentColor,
              fontSize: fontSizes[size],
            },
          ]}
        >
          {value > 0 ? '+' : ''}
          {value.toFixed(1)}%
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    gap: 4,
  },
  value: {
    fontFamily: typography.fontFamily.sans,
    fontWeight: typography.fontWeight.medium,
  },
});
