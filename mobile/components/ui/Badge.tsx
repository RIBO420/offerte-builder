import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  style,
  textStyle,
}: BadgeProps) {
  return (
    <View style={[styles.base, sizeStyles[size], variantStyles[variant], style]}>
      <Text style={[styles.text, textSizeStyles[size], textVariantStyles[variant], textStyle]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  text: {
    fontFamily: typography.fontFamily.sans,
    fontWeight: typography.fontWeight.medium,
  },
});

const sizeStyles = StyleSheet.create({
  sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.full,
  },
  md: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  lg: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
});

const textSizeStyles = StyleSheet.create({
  sm: {
    fontSize: typography.fontSize.xs - 1,
    lineHeight: typography.fontSize.xs * typography.lineHeight.tight,
  },
  md: {
    fontSize: typography.fontSize.xs,
    lineHeight: typography.fontSize.xs * typography.lineHeight.tight,
  },
  lg: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.tight,
  },
});

const variantStyles = StyleSheet.create({
  default: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  destructive: {
    backgroundColor: colors.destructive,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  success: {
    backgroundColor: colors.trend.positive,
  },
  warning: {
    backgroundColor: '#F59E0B', // Amber/Warning color
  },
});

const textVariantStyles = StyleSheet.create({
  default: {
    color: colors.primaryForeground,
  },
  secondary: {
    color: colors.secondaryForeground,
  },
  destructive: {
    color: colors.destructiveForeground,
  },
  outline: {
    color: colors.foreground,
  },
  success: {
    color: '#FFFFFF',
  },
  warning: {
    color: '#FFFFFF',
  },
});
