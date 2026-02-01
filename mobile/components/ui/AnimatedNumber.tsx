import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated, TextStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  locale?: string;
  style?: TextStyle;
  formatOptions?: Intl.NumberFormatOptions;
}

export function AnimatedNumber({
  value,
  duration = 500,
  prefix = '',
  suffix = '',
  decimals = 0,
  locale = 'nl-NL',
  style,
  formatOptions,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const previousValue = useRef(0);

  useEffect(() => {
    const startValue = previousValue.current;
    previousValue.current = value;

    animatedValue.setValue(0);
    Animated.timing(animatedValue, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start();

    const listener = animatedValue.addListener(({ value: progress }) => {
      const current = startValue + (value - startValue) * progress;
      setDisplayValue(current);
    });

    return () => animatedValue.removeListener(listener);
  }, [value, duration]);

  // Ensure minimumFractionDigits doesn't exceed maximumFractionDigits
  const effectiveDecimals = formatOptions?.maximumFractionDigits ?? decimals;
  const minDecimals = Math.min(decimals, effectiveDecimals);

  const formattedValue = new Intl.NumberFormat(locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: effectiveDecimals,
    ...formatOptions,
  }).format(displayValue);

  return (
    <Text style={[styles.text, style]}>
      {prefix}{formattedValue}{suffix}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.normal,
    color: colors.foreground,
  },
});
