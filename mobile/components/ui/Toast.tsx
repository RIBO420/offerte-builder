import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOAST_WIDTH = SCREEN_WIDTH - spacing.lg * 2;
const SWIPE_THRESHOLD = 50;

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';
export type ToastPosition = 'top' | 'bottom';

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastProps extends ToastData {
  position: ToastPosition;
  onDismiss: (id: string) => void;
  index: number;
}

const getVariantStyles = (variant: ToastVariant, isDark: boolean) => {
  const styles: Record<ToastVariant, { backgroundColor: string; borderColor: string; titleColor: string; descriptionColor: string; iconColor: string }> = {
    default: {
      backgroundColor: isDark ? '#2D2D2D' : '#FFFFFF',
      borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#E5E5E5',
      titleColor: isDark ? '#FAFAFA' : '#1A1A1A',
      descriptionColor: isDark ? '#A3A3A3' : '#737373',
      iconColor: isDark ? '#FAFAFA' : '#1A1A1A',
    },
    success: {
      backgroundColor: isDark ? '#14532D' : '#DCFCE7',
      borderColor: isDark ? '#22C55E' : '#86EFAC',
      titleColor: isDark ? '#86EFAC' : '#14532D',
      descriptionColor: isDark ? '#4ADE80' : '#166534',
      iconColor: isDark ? '#4ADE80' : '#22C55E',
    },
    error: {
      backgroundColor: isDark ? '#450A0A' : '#FEE2E2',
      borderColor: isDark ? '#EF4444' : '#FECACA',
      titleColor: isDark ? '#FECACA' : '#7F1D1D',
      descriptionColor: isDark ? '#F87171' : '#991B1B',
      iconColor: isDark ? '#F87171' : '#EF4444',
    },
    warning: {
      backgroundColor: isDark ? '#451A03' : '#FEF3C7',
      borderColor: isDark ? '#F59E0B' : '#FDE68A',
      titleColor: isDark ? '#FDE68A' : '#78350F',
      descriptionColor: isDark ? '#FBBF24' : '#92400E',
      iconColor: isDark ? '#FBBF24' : '#F59E0B',
    },
  };

  return styles[variant];
};

const getVariantIcon = (variant: ToastVariant): string => {
  switch (variant) {
    case 'success':
      return '\u2713'; // checkmark
    case 'error':
      return '\u2717'; // x mark
    case 'warning':
      return '\u26A0'; // warning triangle
    default:
      return '\u2139'; // info circle
  }
};

export function Toast({
  id,
  title,
  description,
  variant = 'default',
  duration = 3000,
  position,
  onDismiss,
  index,
}: ToastProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  const variantStyles = getVariantStyles(variant, isDark);
  const icon = getVariantIcon(variant);

  // Calculate stack offset
  const stackOffset = index * (spacing.sm + 4);
  const stackScale = 1 - index * 0.03;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 4,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: stackScale,
        useNativeDriver: true,
        speed: 14,
        bounciness: 4,
      }),
    ]).start();

    // Auto-dismiss timer
    const timer = setTimeout(() => {
      dismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, stackScale]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === 'top' ? -100 : 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(id));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
        // Allow vertical swipe dismiss
        if (
          (position === 'top' && gestureState.dy < 0) ||
          (position === 'bottom' && gestureState.dy > 0)
        ) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldDismissHorizontal = Math.abs(gestureState.dx) > SWIPE_THRESHOLD;
        const shouldDismissVertical =
          (position === 'top' && gestureState.dy < -SWIPE_THRESHOLD) ||
          (position === 'bottom' && gestureState.dy > SWIPE_THRESHOLD);

        if (shouldDismissHorizontal) {
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: gestureState.dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => onDismiss(id));
        } else if (shouldDismissVertical) {
          dismiss();
        } else {
          // Snap back
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              speed: 20,
              bounciness: 10,
            }),
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              speed: 20,
              bounciness: 10,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const containerStyle: ViewStyle = {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1000 - index,
    ...(position === 'top'
      ? { top: insets.top + spacing.md + stackOffset }
      : { bottom: insets.bottom + spacing.md + stackOffset }),
  };

  return (
    <Animated.View
      style={[
        containerStyle,
        {
          transform: [
            { translateY },
            { translateX },
            { scale },
          ],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor: variantStyles.backgroundColor,
            borderColor: variantStyles.borderColor,
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <Text style={[styles.icon, { color: variantStyles.iconColor }]}>
            {icon}
          </Text>
        </View>
        <View style={styles.content}>
          <Text
            style={[styles.title, { color: variantStyles.titleColor }]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {description && (
            <Text
              style={[styles.description, { color: variantStyles.descriptionColor }]}
              numberOfLines={3}
            >
              {description}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    maxWidth: TOAST_WIDTH,
    width: '100%',
    ...shadows.lg,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  icon: {
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.fontSize.base * typography.lineHeight.tight,
  },
  description: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
});

export default Toast;
