import React from 'react';
import { Text, View, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { AnimatedNumber } from './AnimatedNumber';

type PriceSize = 'sm' | 'md' | 'lg' | 'xl';
type PriceVariant = 'default' | 'success' | 'warning' | 'muted';

interface PriceDisplayProps {
  value: number;
  size?: PriceSize;
  variant?: PriceVariant;
  animated?: boolean;
  showDecimals?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function PriceDisplay({
  value,
  size = 'md',
  variant = 'default',
  animated = false,
  showDecimals = true,
  style,
  textStyle,
}: PriceDisplayProps) {
  const formatOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  };

  if (animated) {
    return (
      <View style={[styles.container, style]}>
        <AnimatedNumber
          value={value}
          locale="nl-NL"
          formatOptions={formatOptions}
          style={[sizeStyles[size], variantStyles[variant], textStyle]}
        />
      </View>
    );
  }

  const formattedPrice = new Intl.NumberFormat('nl-NL', formatOptions).format(value);

  return (
    <View style={[styles.container, style]}>
      <Text style={[sizeStyles[size], variantStyles[variant], styles.price, textStyle]}>
        {formattedPrice}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontFamily: typography.fontFamily.sans,
  },
});

const sizeStyles = StyleSheet.create({
  sm: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  md: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  lg: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
  },
  xl: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
  },
});

const variantStyles = StyleSheet.create({
  default: {
    color: colors.foreground,
  },
  success: {
    color: colors.trend.positive,
  },
  warning: {
    color: colors.trend.negative,
  },
  muted: {
    color: colors.mutedForeground,
  },
});
