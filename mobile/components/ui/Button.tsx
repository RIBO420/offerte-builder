import React from 'react';
import {
  Text,
  ActivityIndicator,
  Pressable,
  View,
  Animated,
} from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Button container variants
const buttonVariants = cva(
  'flex-row items-center justify-center min-h-11 active:opacity-80',
  {
    variants: {
      variant: {
        primary: 'bg-primary',
        secondary: 'bg-secondary',
        outline: 'bg-transparent border border-border',
        destructive: 'bg-destructive',
        ghost: 'bg-transparent',
        link: 'bg-transparent',
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
        primary: 'text-primary-foreground',
        secondary: 'text-secondary-foreground',
        outline: 'text-foreground',
        destructive: 'text-destructive-foreground',
        ghost: 'text-foreground',
        link: 'text-primary underline',
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

// Loader color mapping
const loaderColors = {
  primary: '#FFFFFF',
  secondary: '#18181B',
  outline: '#18181B',
  destructive: '#FFFFFF',
  ghost: '#18181B',
  link: '#000000',
} as const;

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
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const isDisabled = disabled || loading;

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size="small"
          color={loaderColors[variant || 'primary']}
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
      style={[
        { transform: [{ scale: scaleAnim }] },
      ]}
      className={cn(fullWidth && 'w-full')}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        className={cn(
          buttonVariants({ variant, size }),
          isDisabled && 'opacity-50',
          fullWidth && 'w-full',
          className
        )}
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
