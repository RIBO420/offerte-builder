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

const getVariantStyles = (variant: ToastVariant) => {
  const styles: Record<ToastVariant, { bg: string; border: string; iconColor: string }> = {
    default: {
      bg: '#1A1A1A',
      border: '#222222',
      iconColor: '#E8E8E8',
    },
    success: {
      bg: 'rgba(74,222,128,0.1)',
      border: '#4ADE80',
      iconColor: '#4ADE80',
    },
    error: {
      bg: 'rgba(239,68,68,0.1)',
      border: '#EF4444',
      iconColor: '#EF4444',
    },
    warning: {
      bg: 'rgba(245,158,11,0.1)',
      border: '#F59E0B',
      iconColor: '#F59E0B',
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
  const insets = useSafeAreaInsets();
  // eslint-disable-next-line react-hooks/refs -- RN Animated.Value refs are stable and safe to access during render
  const translateY = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;
  // eslint-disable-next-line react-hooks/refs -- RN Animated.Value refs are stable and safe to access during render
  const translateX = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line react-hooks/refs -- RN Animated.Value refs are stable and safe to access during render
  const opacity = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line react-hooks/refs -- RN Animated.Value refs are stable and safe to access during render
  const scale = useRef(new Animated.Value(0.9)).current;

  const variantStyle = getVariantStyles(variant);
  const icon = getVariantIcon(variant);

  // Calculate stack offset
  const stackOffset = index * 12;
  const stackScale = 1 - index * 0.03;

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

  // eslint-disable-next-line react-hooks/refs -- PanResponder ref is stable and safe to access during render
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
    left: 16,
    right: 16,
    zIndex: 1000 - index,
    ...(position === 'top'
      ? { top: insets.top + 12 + stackOffset }
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
        style={{
          backgroundColor: variantStyle.bg,
          borderWidth: 1,
          borderColor: variantStyle.border,
          borderRadius: 12,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'flex-start',
          width: '100%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <View className="w-6 h-6 items-center justify-center mr-3">
          <Text className="text-base font-bold" style={{ color: variantStyle.iconColor }}>
            {icon}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <Text
            className="font-semibold text-base leading-tight"
            style={{ color: '#E8E8E8' }}
            numberOfLines={2}
          >
            {title}
          </Text>
          {description && (
            <Text
              className="text-sm leading-normal"
              style={{ color: '#888888' }}
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
