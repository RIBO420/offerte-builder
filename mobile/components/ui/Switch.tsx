import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  Animated,
  ViewStyle,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { cn } from '@/lib/utils';

type SwitchSize = 'sm' | 'md' | 'lg';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  size?: SwitchSize;
  style?: ViewStyle;
  className?: string;
}

// Size configuration for the switch
const sizeConfig = {
  sm: {
    trackWidth: 36,
    trackHeight: 20,
    thumbSize: 16,
    thumbMargin: 2,
  },
  md: {
    trackWidth: 48,
    trackHeight: 26,
    thumbSize: 22,
    thumbMargin: 2,
  },
  lg: {
    trackWidth: 56,
    trackHeight: 32,
    thumbSize: 28,
    thumbMargin: 2,
  },
};

export function Switch({
  value,
  onValueChange,
  disabled = false,
  size = 'md',
  style,
  className,
}: SwitchProps) {
  const { colorScheme } = useColorScheme();
  const translateX = useRef(new Animated.Value(value ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const config = sizeConfig[size];
  const thumbTravel = config.trackWidth - config.thumbSize - config.thumbMargin * 2;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: value ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [value, translateX]);

  const handlePress = () => {
    if (!disabled) {
      onValueChange(!value);
    }
  };

  const handlePressIn = () => {
    if (!disabled) {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }).start();
    }
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  // Get color values for interpolation
  const mutedColor = colorScheme === 'dark' ? '#171717' : '#F5F5F5';
  const accentColor = colorScheme === 'dark' ? '#6366f1' : '#F5F5F5';
  const foregroundColor = colorScheme === 'dark' ? '#FAFAFA' : '#1A1A1A';
  const whiteColor = '#FFFFFF';

  // Interpolate track background color
  const trackBackgroundColor = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [mutedColor, accentColor],
  });

  // Interpolate thumb background color
  const thumbBackgroundColor = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [foregroundColor, whiteColor],
  });

  // Interpolate thumb position
  const thumbTranslateX = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, thumbTravel],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        accessibilityLabel={value ? 'Switch on' : 'Switch off'}
        style={style}
        className={className}
      >
        <Animated.View
          className={cn(
            'justify-center p-0.5',
            disabled && 'opacity-50'
          )}
          style={{
            width: config.trackWidth,
            height: config.trackHeight,
            borderRadius: config.trackHeight / 2,
            backgroundColor: trackBackgroundColor,
          }}
        >
          <Animated.View
            className="absolute left-0.5 shadow-md"
            style={{
              width: config.thumbSize,
              height: config.thumbSize,
              borderRadius: config.thumbSize / 2,
              transform: [{ translateX: thumbTranslateX }],
              backgroundColor: thumbBackgroundColor,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 2.5,
              elevation: 4,
            }}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default Switch;
