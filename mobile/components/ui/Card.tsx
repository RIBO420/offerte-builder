import React, { ReactNode } from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'subtle' | 'ghost' | 'elevated' | 'glass' | 'nature';
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
 * Variants: default, subtle, ghost, elevated, glass, nature
 */
export function Card({ children, className, variant = 'default', style }: CardProps) {
  const variantClasses: Record<string, string> = {
    default: '',
    subtle: '',
    ghost: 'bg-transparent',
    elevated: '',
    glass: '',
    nature: '',
  };

  const variantStyles: Record<string, ViewStyle> = {
    default: {
      backgroundColor: '#111111',
      borderWidth: 1,
      borderColor: '#222222',
    },
    subtle: {
      backgroundColor: '#0A0A0A',
    },
    ghost: {},
    elevated: {
      backgroundColor: '#1A1A1A',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 6,
    },
    glass: {
      backgroundColor: 'rgba(17,17,17,0.8)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    nature: {
      backgroundColor: '#1A2E1A',
      borderWidth: 1,
      borderColor: 'rgba(45,90,39,0.19)',
    },
  };

  return (
    <View
      className={cn('rounded-2xl p-4', variantClasses[variant], className)}
      style={[variantStyles[variant], style]}
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
    <Text className={cn('text-base font-semibold', className)} style={{ color: '#E8E8E8' }}>
      {children}
    </Text>
  );
}

/**
 * CardDescription - Secondary descriptive text
 */
export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <Text className={cn('text-sm', className)} style={{ color: '#888888' }}>
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
