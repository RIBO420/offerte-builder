import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'subtle' | 'ghost' | 'elevated';
}

interface CardHeaderProps {
  children: ReactNode;
  style?: ViewStyle;
}

interface CardTitleProps {
  children: ReactNode;
  style?: TextStyle;
}

interface CardDescriptionProps {
  children: ReactNode;
  style?: TextStyle;
}

interface CardContentProps {
  children: ReactNode;
  style?: ViewStyle;
}

interface CardFooterProps {
  children: ReactNode;
  style?: ViewStyle;
}

/**
 * Card - Main container component
 * Variants match web design: default, subtle, ghost, elevated
 */
export function Card({ children, style, variant = 'default' }: CardProps) {
  return (
    <View style={[styles.card, variantStyles[variant], style]}>
      {children}
    </View>
  );
}

/**
 * CardHeader - Container for title and description
 * Provides consistent spacing at the top of the card
 */
export function CardHeader({ children, style }: CardHeaderProps) {
  return <View style={[styles.header, style]}>{children}</View>;
}

/**
 * CardTitle - Main heading text for the card
 * Uses semibold font weight matching web design
 */
export function CardTitle({ children, style }: CardTitleProps) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

/**
 * CardDescription - Secondary descriptive text
 * Muted foreground color, smaller font size
 */
export function CardDescription({ children, style }: CardDescriptionProps) {
  return <Text style={[styles.description, style]}>{children}</Text>;
}

/**
 * CardContent - Main content area of the card
 * Provides horizontal padding matching header/footer
 */
export function CardContent({ children, style }: CardContentProps) {
  return <View style={[styles.content, style]}>{children}</View>;
}

/**
 * CardFooter - Bottom section of the card
 * Flex row layout for action buttons or additional info
 */
export function CardFooter({ children, style }: CardFooterProps) {
  return <View style={[styles.footer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.cardForeground,
    lineHeight: typography.fontSize.lg * typography.lineHeight.tight,
  },
  description: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    color: colors.mutedForeground,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
});

// Variant styles matching web design
const variantStyles: Record<NonNullable<CardProps['variant']>, ViewStyle> = {
  default: {
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  subtle: {
    backgroundColor: `${colors.muted}4D`, // 30% opacity (muted/30 from web)
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  elevated: {
    borderWidth: 1,
    borderColor: `${colors.primary}33`, // 20% opacity (primary/20 from web)
    ...shadows.lg,
  },
};
