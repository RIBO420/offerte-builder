import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ViewStyle,
} from 'react-native';
import { useColors } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

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
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled = false,
  indeterminate = false,
  label,
  style,
}: CheckboxProps) {
  const colors = useColors();
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

  const checkboxStyles = [
    styles.checkbox,
    {
      borderColor: disabled
        ? colors.border
        : isActive
          ? colors.primary
          : colors.border,
      backgroundColor: disabled
        ? colors.muted
        : isActive
          ? colors.primary
          : colors.background,
    },
  ];

  const checkmarkScale = checkmarkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const checkmarkOpacity = checkmarkAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[styles.container, style]}
      accessibilityRole="checkbox"
      accessibilityState={{
        checked: indeterminate ? 'mixed' : checked,
        disabled,
      }}
      accessibilityLabel={label}
    >
      <Animated.View
        style={[
          styles.touchTarget,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={checkboxStyles}>
          <Animated.View
            style={[
              styles.checkmarkContainer,
              {
                transform: [{ scale: checkmarkScale }],
                opacity: checkmarkOpacity,
              },
            ]}
          >
            {indeterminate ? (
              <View
                style={[
                  styles.indeterminateMark,
                  { backgroundColor: colors.primaryForeground },
                ]}
              />
            ) : (
              <View style={styles.checkmark}>
                <View
                  style={[
                    styles.checkmarkShort,
                    { backgroundColor: colors.primaryForeground },
                  ]}
                />
                <View
                  style={[
                    styles.checkmarkLong,
                    { backgroundColor: colors.primaryForeground },
                  ]}
                />
              </View>
            )}
          </Animated.View>
        </View>
      </Animated.View>

      {label && (
        <Text
          style={[
            styles.label,
            { color: disabled ? colors.mutedForeground : colors.foreground },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  touchTarget: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: radius.sm,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    width: 12,
    height: 10,
    position: 'relative',
  },
  checkmarkShort: {
    position: 'absolute',
    width: 2,
    height: 6,
    bottom: 0,
    left: 1,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
  checkmarkLong: {
    position: 'absolute',
    width: 2,
    height: 10,
    bottom: 0,
    left: 5,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  indeterminateMark: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },
  label: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.sans,
    marginLeft: spacing.xs,
    flexShrink: 1,
  },
});

export default Checkbox;
