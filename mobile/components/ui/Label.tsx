import React from 'react';
import { TextStyle } from 'react-native';
import { Text } from './Tekst';
import { tekst } from '../../theme/typography';
import { useVeldKleuren } from '../veld/BuitenModus';

interface LabelProps {
  children: string;
  required?: boolean;
  disabled?: boolean;
  style?: TextStyle;
  htmlFor?: string; // For accessibility
}

export function Label({ children, required, disabled, style }: LabelProps) {
  const kleuren = useVeldKleuren();
  return (
    <Text
      style={[
        tekst.sub,
        { color: kleuren.mutedForeground, fontWeight: '500' },
        disabled && { color: kleuren.inactive, opacity: 0.7 },
        style,
      ]}
    >
      {children}
      {required && <Text style={{ color: kleuren.danger, fontWeight: '500' }}> *</Text>}
    </Text>
  );
}
