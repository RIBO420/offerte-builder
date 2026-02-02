import React, { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'subtle' | 'ghost' | 'elevated';
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
 * Variants match web design: default, subtle, ghost, elevated
 */
export function Card({ children, className, variant = 'default' }: CardProps) {
  const variantClasses = {
    default: 'bg-card border border-border shadow-sm',
    subtle: 'bg-muted/30',
    ghost: 'bg-transparent',
    elevated: 'bg-card border border-primary/20 shadow-lg',
  };

  return (
    <View className={cn('rounded-xl gap-4 py-4', variantClasses[variant], className)}>
      {children}
    </View>
  );
}

/**
 * CardHeader - Container for title and description
 * Provides consistent spacing at the top of the card
 */
export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <View className={cn('gap-2 px-4', className)}>
      {children}
    </View>
  );
}

/**
 * CardTitle - Main heading text for the card
 * Uses semibold font weight matching web design
 */
export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <Text className={cn('text-lg font-semibold text-foreground', className)}>
      {children}
    </Text>
  );
}

/**
 * CardDescription - Secondary descriptive text
 * Muted foreground color, smaller font size
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
 * Provides horizontal padding matching header/footer
 */
export function CardContent({ children, className }: CardContentProps) {
  return (
    <View className={cn('px-4', className)}>
      {children}
    </View>
  );
}

/**
 * CardFooter - Bottom section of the card
 * Flex row layout for action buttons or additional info
 */
export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <View className={cn('flex-row items-center px-4', className)}>
      {children}
    </View>
  );
}
