import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface LabelProps {
  children: string;
  required?: boolean;
  disabled?: boolean;
  style?: TextStyle;
  htmlFor?: string; // For accessibility
}

export function Label({ children, required, disabled, style }: LabelProps) {
  return (
    <Text style={[styles.label, disabled && styles.disabled, style]}>
      {children}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.foreground,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  disabled: {
    color: colors.mutedForeground,
    opacity: 0.7,
  },
  required: {
    color: colors.destructive,
    fontWeight: typography.fontWeight.medium,
  },
});
