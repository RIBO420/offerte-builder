import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';
import { useColors } from '../../theme/ThemeProvider';

type SwitchSize = 'sm' | 'md' | 'lg';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  size?: SwitchSize;
  style?: ViewStyle;
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
}: SwitchProps) {
  const colors = useColors();
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

  // Interpolate track background color
  const trackBackgroundColor = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.muted, colors.primary],
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
      >
        <Animated.View
          style={[
            styles.track,
            {
              width: config.trackWidth,
              height: config.trackHeight,
              borderRadius: config.trackHeight / 2,
              backgroundColor: trackBackgroundColor,
            },
            disabled && styles.disabled,
          ]}
        >
          <Animated.View
            style={[
              styles.thumb,
              {
                width: config.thumbSize,
                height: config.thumbSize,
                borderRadius: config.thumbSize / 2,
                transform: [{ translateX: thumbTranslateX }],
                backgroundColor: colors.background,
              },
              // iOS-style shadow
              styles.thumbShadow,
            ]}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
    padding: 2,
  },
  thumb: {
    position: 'absolute',
    left: 2,
  },
  thumbShadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
    elevation: 4,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Switch;
