import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
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
    color: '#888888',
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  disabled: {
    color: '#555555',
    opacity: 0.7,
  },
  required: {
    color: '#EF4444',
    fontWeight: typography.fontWeight.medium,
  },
});
