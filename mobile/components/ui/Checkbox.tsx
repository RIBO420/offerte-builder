import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  ViewStyle,
} from 'react-native';
import { useColorScheme } from 'nativewind';
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
  const { colorScheme } = useColorScheme();
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

  // Get color values for indeterminate mark and checkmark
  const primaryForeground = colorScheme === 'dark' ? '#1A1A1A' : '#FAFAFA';

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
          className={cn(
            'w-5 h-5 rounded-md border-2 justify-center items-center',
            disabled && !isActive && 'border-border bg-muted',
            disabled && isActive && 'border-accent bg-accent',
            !disabled && !isActive && 'border-border bg-background',
            !disabled && isActive && 'border-accent bg-accent'
          )}
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
                style={{ backgroundColor: primaryForeground }}
              />
            ) : (
              <View className="w-3 h-2.5 relative">
                <View
                  className="absolute w-0.5 h-1.5 bottom-0 left-0.5 rounded-sm"
                  style={{
                    backgroundColor: primaryForeground,
                    transform: [{ rotate: '-45deg' }],
                  }}
                />
                <View
                  className="absolute w-0.5 h-2.5 bottom-0 left-1.5 rounded-sm"
                  style={{
                    backgroundColor: primaryForeground,
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
          className={cn(
            'text-base font-sans ml-2 flex-shrink',
            disabled ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export default Checkbox;
