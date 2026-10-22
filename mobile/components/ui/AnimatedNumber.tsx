import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, TextStyle, StyleProp } from 'react-native';
import { Text } from './Tekst';
import { useSharedValue, withTiming, useDerivedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { typography, tekst } from '../../theme/typography';
import { useVeldKleuren } from '../veld/BuitenModus';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  locale?: string;
  style?: StyleProp<TextStyle>;
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
  const kleuren = useVeldKleuren();
  const [displayValue, setDisplayValue] = useState(value);
  const animatedProgress = useSharedValue(0);
  const startValue = useSharedValue(0);
  const targetValue = useSharedValue(value);

  const updateDisplay = useCallback((val: number) => {
    setDisplayValue(val);
  }, []);

  useDerivedValue(() => {
    const current = startValue.get() + (targetValue.get() - startValue.get()) * animatedProgress.get();
    scheduleOnRN(updateDisplay, current);
  });

  useEffect(() => {
    startValue.set(displayValue);
    targetValue.set(value);
    animatedProgress.set(0);
    animatedProgress.set(withTiming(1, { duration }));
    // Bewust alleen value/duration: displayValue is hier de startwaarde van de
    // animatie en wordt dóór de animatie zelf bijgewerkt — als dep zou het effect
    // in een lus telkens opnieuw starten. De shared values zijn stabiel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <Text style={[styles.text, tekst.cijfers, { color: kleuren.foreground }, style]}>
      {prefix}{formattedValue}{suffix}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 15,
    fontWeight: typography.fontWeight.normal,
    // Standaard de voorgrondkleur; een kleur via `style` gaat voor.
  },
});
