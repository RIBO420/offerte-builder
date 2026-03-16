import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  ViewStyle,
} from 'react-native';
import { cn } from '@/lib/utils';

// Minimum touch target size for accessibility (44x44 points)
const MIN_TOUCH_TARGET = 44;
const CHECKBOX_SIZE = 20;

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  label?: string;
  style?: ViewStyle;
  className?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled = false,
  indeterminate = false,
  label,
  style,
  className,
}: CheckboxProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const checkmarkAnim = useRef(new Animated.Value(checked ? 1 : 0)).current;

  // Animate checkmark appearance
  useEffect(() => {
    Animated.spring(checkmarkAnim, {
      toValue: checked || indeterminate ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [checked, indeterminate, checkmarkAnim]);

  const handlePress = () => {
    if (!disabled) {
      onCheckedChange(!checked);
    }
  };

  const handlePressIn = () => {
    if (!disabled) {
      Animated.spring(scaleAnim, {
        toValue: 0.92,
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

  const isActive = checked || indeterminate;

  const checkmarkScale = checkmarkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const checkmarkOpacity = checkmarkAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  // Premium Organic palette colors
  const checkedBg = '#4ADE80';
  const checkedBorder = '#4ADE80';
  const uncheckedBorder = '#333333';
  const uncheckedBg = 'transparent';
  const checkmarkColor = '#0A0A0A';

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={style}
      className={cn('flex-row items-center min-h-[44px]', className)}
      accessibilityRole="checkbox"
      accessibilityState={{
        checked: indeterminate ? 'mixed' : checked,
        disabled,
      }}
      accessibilityLabel={label}
    >
      <Animated.View
        className="w-[44px] h-[44px] justify-center items-center"
        style={{ transform: [{ scale: scaleAnim }] }}
      >
        <View
          style={{
            width: CHECKBOX_SIZE,
            height: CHECKBOX_SIZE,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: isActive ? checkedBorder : uncheckedBorder,
            backgroundColor: isActive ? checkedBg : uncheckedBg,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Animated.View
            className="w-full h-full justify-center items-center"
            style={{
              transform: [{ scale: checkmarkScale }],
              opacity: checkmarkOpacity,
            }}
          >
            {indeterminate ? (
              <View
                className="w-2.5 h-0.5 rounded-sm"
                style={{ backgroundColor: checkmarkColor }}
              />
            ) : (
              <View className="w-3 h-2.5 relative">
                <View
                  className="absolute w-0.5 h-1.5 bottom-0 left-0.5 rounded-sm"
                  style={{
                    backgroundColor: checkmarkColor,
                    transform: [{ rotate: '-45deg' }],
                  }}
                />
                <View
                  className="absolute w-0.5 h-2.5 bottom-0 left-1.5 rounded-sm"
                  style={{
                    backgroundColor: checkmarkColor,
                    transform: [{ rotate: '45deg' }],
                  }}
                />
              </View>
            )}
          </Animated.View>
        </View>
      </Animated.View>

      {label && (
        <Text
          className="text-base font-sans ml-2 flex-shrink"
          style={{ color: disabled ? '#888888' : '#E8E8E8' }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export default Checkbox;
