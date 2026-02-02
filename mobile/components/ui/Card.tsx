import React, { ReactNode } from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'subtle' | 'ghost' | 'elevated' | 'glass';
  style?: ViewStyle;
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

/**
 * Card - Main container component
 * Variants: default, subtle, ghost, elevated, glass (glassmorphism)
 */
export function Card({ children, className, variant = 'default', style }: CardProps) {
  const variantClasses = {
    default: 'bg-card border border-border',
    subtle: 'bg-muted/30',
    ghost: 'bg-transparent',
    elevated: 'bg-card border border-primary/20',
    glass: 'border border-white/10',
  };

  const glassStyle: ViewStyle = variant === 'glass' ? {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  } : {};

  return (
    <View
      className={cn('rounded-2xl p-4', variantClasses[variant], className)}
      style={[glassStyle, style]}
    >
      {children}
    </View>
  );
}

/**
 * CardHeader - Container for title and description
 */
export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <View className={cn('gap-1 mb-3', className)}>
      {children}
    </View>
  );
}

/**
 * CardTitle - Main heading text for the card
 */
export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <Text className={cn('text-base font-semibold text-foreground', className)}>
      {children}
    </Text>
  );
}

/**
 * CardDescription - Secondary descriptive text
 */
export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <Text className={cn('text-sm text-muted-foreground', className)}>
      {children}
    </Text>
  );
}

/**
 * CardContent - Main content area of the card
 */
export function CardContent({ children, className }: CardContentProps) {
  return (
    <View className={cn('', className)}>
      {children}
    </View>
  );
}

/**
 * CardFooter - Bottom section of the card
 */
export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <View className={cn('flex-row items-center mt-3', className)}>
      {children}
    </View>
  );
}
