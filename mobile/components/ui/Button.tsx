import React from 'react';
import {
  Text,
  ActivityIndicator,
  Pressable,
  View,
  type AccessibilityState,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { usePressAnimation } from '../../hooks/use-spring-animation';
import { hapticPatterns } from '../../theme/haptics';
import type { ColorScheme } from '../../theme/colors';
import { useVeldKleuren } from '../veld/BuitenModus';

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
        sm: 'h-11 px-4 rounded-full',
        md: 'h-12 px-6 rounded-full',
        lg: 'h-[52px] px-8 rounded-full',
        icon: 'h-11 w-11 px-0 rounded-full',
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

// Kleuren per variant komen uit het actieve thema (licht/donker/buiten).
function variantKleuren(k: ColorScheme, variant: string) {
  switch (variant) {
    case 'primary':
      return { container: { backgroundColor: k.primary }, tekst: k.primaryForeground };
    case 'secondary':
    case 'nature':
      return { container: { backgroundColor: k.primarySoft }, tekst: k.primary };
    case 'outline':
      return { container: { borderWidth: 1, borderColor: k.border, backgroundColor: k.card }, tekst: k.foreground };
    case 'destructive':
      return { container: { backgroundColor: k.destructive }, tekst: k.destructiveForeground };
    case 'link':
      return { container: {}, tekst: k.primary };
    default:
      return { container: {}, tekst: k.foreground };
  }
}

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
  /** Voorleesnaam; valt terug op `title`. Verplicht in de praktijk voor icoonknoppen. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Extra status (bijv. `expanded`); disabled/checked vult de knop zelf. */
  accessibilityState?: AccessibilityState;
  /**
   * Keuzeknop in een groep: maakt er een radio van met `checked`-status en
   * zet een vinkje voor de titel als hij gekozen is.
   */
  geselecteerd?: boolean;
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
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  geselecteerd,
}: ButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();

  const isDisabled = disabled || loading;
  const variantKey = variant || 'primary';
  const kleuren = useVeldKleuren();
  const { container: containerKleur, tekst: tekstKleur } = variantKleuren(kleuren, variantKey);

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
          color={tekstKleur}
        />
      );
    }

    // If children are provided, use them directly
    if (children) {
      return children;
    }

    const vinkje = geselecteerd ? <Check size={16} color={tekstKleur} strokeWidth={2.5} /> : null;
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
        {hasTitle && vinkje}
        {hasIcon && iconPosition === 'left' && icon}
        {hasTitle && (
          <Text
            className={cn(buttonTextVariants({ variant, size }), textClassName)}
            style={{ color: tekstKleur }}
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
        style={containerKleur}
        accessibilityRole={geselecteerd === undefined ? 'button' : 'radio'}
        accessibilityState={{
          ...accessibilityState,
          disabled: isDisabled,
          ...(geselecteerd === undefined ? null : { checked: geselecteerd }),
        }}
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityHint={accessibilityHint}
      >
        {renderContent()}
      </Pressable>
    </Animated.View>
  );
}

export default Button;
