import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Pressable,
  View,
  Animated,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps {
  onPress: () => void;
  title?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children?: React.ReactNode;
}

// Minimum touch target size for accessibility (44x44 points)
const MIN_TOUCH_TARGET = 44;

// Variant styles configuration
const variantStyles = {
  primary: {
    container: {
      backgroundColor: colors.primary,
    },
    text: {
      color: colors.primaryForeground,
    },
    pressed: {
      backgroundColor: '#404040',
    },
    loader: colors.primaryForeground,
  },
  secondary: {
    container: {
      backgroundColor: colors.secondary,
    },
    text: {
      color: colors.secondaryForeground,
    },
    pressed: {
      backgroundColor: '#E5E5E5',
    },
    loader: colors.secondaryForeground,
  },
  outline: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: {
      color: colors.foreground,
    },
    pressed: {
      backgroundColor: colors.accent,
    },
    loader: colors.foreground,
  },
  destructive: {
    container: {
      backgroundColor: colors.destructive,
    },
    text: {
      color: colors.destructiveForeground,
    },
    pressed: {
      backgroundColor: '#B91C1C',
    },
    loader: colors.destructiveForeground,
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
    },
    text: {
      color: colors.foreground,
    },
    pressed: {
      backgroundColor: colors.accent,
    },
    loader: colors.foreground,
  },
  link: {
    container: {
      backgroundColor: 'transparent',
    },
    text: {
      color: colors.primary,
      textDecorationLine: 'underline' as const,
    },
    pressed: {
      backgroundColor: 'transparent',
    },
    loader: colors.primary,
  },
};

// Size styles configuration
const sizeStyles = {
  sm: {
    container: {
      height: MIN_TOUCH_TARGET,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
    },
    text: {
      fontSize: typography.fontSize.sm,
    },
    iconSpacing: spacing.xs,
  },
  md: {
    container: {
      height: MIN_TOUCH_TARGET,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
    },
    text: {
      fontSize: typography.fontSize.base,
    },
    iconSpacing: spacing.sm,
  },
  lg: {
    container: {
      height: 52,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
    },
    text: {
      fontSize: typography.fontSize.lg,
    },
    iconSpacing: spacing.sm,
  },
  icon: {
    container: {
      height: MIN_TOUCH_TARGET,
      width: MIN_TOUCH_TARGET,
      paddingHorizontal: 0,
      borderRadius: radius.md,
    },
    text: {
      fontSize: typography.fontSize.base,
    },
    iconSpacing: 0,
  },
};

export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  children,
}: ButtonProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

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
          color={variantStyle.loader}
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
      <View style={styles.contentRow}>
        {hasIcon && iconPosition === 'left' && (
          <View style={{ marginRight: hasTitle ? sizeStyle.iconSpacing : 0 }}>
            {icon}
          </View>
        )}
        {hasTitle && (
          <Text
            style={[
              styles.text,
              { fontSize: sizeStyle.text.fontSize },
              variantStyle.text,
              textStyle,
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
        {hasIcon && iconPosition === 'right' && (
          <View style={{ marginLeft: hasTitle ? sizeStyle.iconSpacing : 0 }}>
            {icon}
          </View>
        )}
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }] },
        fullWidth && styles.fullWidth,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.base,
          sizeStyle.container,
          variantStyle.container,
          pressed && !isDisabled && variantStyle.pressed,
          isDisabled && styles.disabled,
          fullWidth && styles.fullWidth,
          style,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        accessibilityLabel={title}
      >
        {renderContent()}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: typography.fontFamily.sans,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },
});

export default Button;
