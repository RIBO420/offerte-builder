import React, { ReactNode } from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'self-start flex-row items-center justify-center rounded-full',
  {
    variants: {
      variant: {
        default: '',
        secondary: '',
        destructive: '',
        outline: '',
        success: '',
        warning: '',
        nature: '',
      },
      size: {
        sm: 'px-2 py-0.5',
        md: 'px-2.5 py-1',
        lg: 'px-3 py-1.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const badgeTextVariants = cva(
  'font-medium',
  {
    variants: {
      variant: {
        default: '',
        secondary: '',
        destructive: '',
        outline: '',
        success: '',
        warning: '',
        nature: '',
      },
      size: {
        sm: 'text-[10px] leading-tight',
        md: 'text-xs leading-tight',
        lg: 'text-sm leading-tight',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

// Premium Organic color mappings
const variantBgStyles: Record<string, ViewStyle> = {
  default: { backgroundColor: '#1A1A1A' },
  secondary: { backgroundColor: '#1A2E1A' },
  destructive: { backgroundColor: 'rgba(239,68,68,0.13)' },
  outline: { borderWidth: 1, borderColor: '#222222', backgroundColor: 'transparent' },
  success: { backgroundColor: 'rgba(74,222,128,0.13)' },
  warning: { backgroundColor: 'rgba(245,158,11,0.13)' },
  nature: { backgroundColor: 'rgba(74,222,128,0.13)' },
};

const variantTextStyles: Record<string, TextStyle> = {
  default: { color: '#E8E8E8' },
  secondary: { color: '#6B8F6B' },
  destructive: { color: '#EF4444' },
  outline: { color: '#E8E8E8' },
  success: { color: '#4ADE80' },
  warning: { color: '#F59E0B' },
  nature: { color: '#4ADE80' },
};

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
  textClassName?: string;
}

export function Badge({
  children,
  variant,
  size,
  className,
  textClassName,
}: BadgeProps) {
  const variantKey = variant || 'default';

  return (
    <View
      className={cn(badgeVariants({ variant, size }), className)}
      style={variantBgStyles[variantKey]}
    >
      <Text
        className={cn(badgeTextVariants({ variant, size }), textClassName)}
        style={variantTextStyles[variantKey]}
      >
        {children}
      </Text>
    </View>
  );
}
