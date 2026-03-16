import React from 'react';
import {
  Text,
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { usePressAnimation } from '../../hooks/use-spring-animation';
import { hapticPatterns } from '../../theme/haptics';

// Button container variants
const buttonVariants = cva(
  'flex-row items-center justify-center min-h-11',
  {
    variants: {
      variant: {
        primary: '',
        secondary: '',
        outline: 'bg-transparent',
        destructive: 'bg-destructive',
        ghost: 'bg-transparent',
        link: 'bg-transparent',
        nature: '',
      },
      size: {
        sm: 'h-11 px-4 rounded-lg',
        md: 'h-11 px-6 rounded-lg',
        lg: 'h-[52px] px-8 rounded-xl',
        icon: 'h-11 w-11 px-0 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

// Button text variants
const buttonTextVariants = cva(
  'font-sans font-semibold text-center',
  {
    variants: {
      variant: {
        primary: '',
        secondary: '',
        outline: '',
        destructive: 'text-destructive-foreground',
        ghost: '',
        link: 'underline',
        nature: '',
      },
      size: {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg',
        icon: 'text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

// Inline style colors per variant
const variantContainerStyles: Record<string, { backgroundColor?: string; borderWidth?: number; borderColor?: string }> = {
  primary: { backgroundColor: '#4ADE80' },
  secondary: { backgroundColor: '#1A2E1A' },
  outline: { borderWidth: 1, borderColor: '#222222' },
  destructive: {},
  ghost: {},
  link: {},
  nature: { backgroundColor: '#1A2E1A' },
};

const variantTextColors: Record<string, string> = {
  primary: '#0A0A0A',
  secondary: '#6B8F6B',
  outline: '#E8E8E8',
  destructive: '#FAFAFA',
  ghost: '#E8E8E8',
  link: '#4ADE80',
  nature: '#4ADE80',
};

// Loader color mapping
const loaderColors: Record<string, string> = {
  primary: '#0A0A0A',
  secondary: '#6B8F6B',
  outline: '#E8E8E8',
  destructive: '#FFFFFF',
  ghost: '#E8E8E8',
  link: '#4ADE80',
  nature: '#4ADE80',
};

// Icon spacing mapping
const iconSpacing = {
  sm: 'gap-1',
  md: 'gap-2',
  lg: 'gap-2',
  icon: '',
} as const;

export interface ButtonProps extends VariantProps<typeof buttonVariants> {
  onPress: () => void;
  title?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  textClassName?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className,
  textClassName,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  children,
}: ButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();

  const isDisabled = disabled || loading;
  const variantKey = variant || 'primary';

  const handlePress = () => {
    if (!isDisabled) {
      hapticPatterns.tap();
      onPress();
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size="small"
          color={loaderColors[variantKey]}
        />
      );
    }

    // If children are provided, use them directly
    if (children) {
      return children;
    }

    const hasIcon = !!icon;
    const hasTitle = !!title;

    if (!hasIcon && !hasTitle) {
      return null;
    }

    // Icon only (for icon size buttons)
    if (hasIcon && !hasTitle) {
      return icon;
    }

    // Title with optional icon
    return (
      <View className={cn('flex-row items-center justify-center', size !== 'icon' && iconSpacing[size || 'md'])}>
        {hasIcon && iconPosition === 'left' && icon}
        {hasTitle && (
          <Text
            className={cn(buttonTextVariants({ variant, size }), textClassName)}
            style={{ color: variantTextColors[variantKey] }}
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
        {hasIcon && iconPosition === 'right' && icon}
      </View>
    );
  };

  return (
    <Animated.View
      style={animatedStyle}
      className={cn(fullWidth && 'w-full')}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        className={cn(
          buttonVariants({ variant, size }),
          isDisabled && 'opacity-50',
          fullWidth && 'w-full',
          className
        )}
        style={variantContainerStyles[variantKey]}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        accessibilityLabel={title}
      >
        {renderContent()}
      </Pressable>
    </Animated.View>
  );
}

export default Button;
