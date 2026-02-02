import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  Dimensions,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '@/lib/utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
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

const getVariantClasses = (variant: ToastVariant) => {
  const classes: Record<ToastVariant, { container: string; icon: string }> = {
    default: {
      container: 'bg-card border-border',
      icon: 'text-foreground',
    },
    success: {
      container: 'bg-success/10 border-success',
      icon: 'text-success',
    },
    error: {
      container: 'bg-destructive/10 border-destructive',
      icon: 'text-destructive',
    },
    warning: {
      container: 'bg-warning/10 border-warning',
      icon: 'text-warning',
    },
  };

  return classes[variant];
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
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  const variantClasses = getVariantClasses(variant);
  const icon = getVariantIcon(variant);

  // Calculate stack offset
  const stackOffset = index * 12; // spacing.sm equivalent
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
    left: 16, // spacing.lg equivalent
    right: 16,
    zIndex: 1000 - index,
    ...(position === 'top'
      ? { top: insets.top + 12 + stackOffset } // spacing.md equivalent
      : { bottom: insets.bottom + 12 + stackOffset }),
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
        className={cn(
          'rounded-xl p-4 shadow-lg border flex-row items-start w-full',
          variantClasses.container
        )}
      >
        <View className="w-6 h-6 items-center justify-center mr-3">
          <Text className={cn('text-base font-bold', variantClasses.icon)}>
            {icon}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <Text
            className="text-foreground font-semibold text-base leading-tight"
            numberOfLines={2}
          >
            {title}
          </Text>
          {description && (
            <Text
              className="text-muted-foreground text-sm leading-normal"
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

export default Toast;
