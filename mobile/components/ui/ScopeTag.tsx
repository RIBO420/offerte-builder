import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

type ScopeType = 'grondwerk' | 'bestrating' | 'borders' | 'gras' | 'houtwerk' | 'water' | 'specials';

interface ScopeTagProps {
  scope: ScopeType;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const scopeLabels: Record<ScopeType, string> = {
  grondwerk: 'Grondwerk',
  bestrating: 'Bestrating',
  borders: 'Borders',
  gras: 'Gras',
  houtwerk: 'Houtwerk',
  water: 'Water',
  specials: 'Specials',
};

// Calculate foreground color based on background brightness
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1A1A1A' : '#FFFFFF';
}

export function ScopeTag({ scope, size = 'md', style }: ScopeTagProps) {
  const backgroundColor = colors.scope[scope];
  const textColor = getContrastColor(backgroundColor);

  return (
    <View
      style={[
        styles.base,
        size === 'sm' ? styles.sizeSm : styles.sizeMd,
        { backgroundColor },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: textColor },
        ]}
      >
        {scopeLabels[scope]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  sizeSm: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xs / 2,
  },
  sizeMd: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: {
    fontFamily: typography.fontFamily.sans,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textSm: {
    fontSize: typography.fontSize.xs - 2,
    lineHeight: typography.fontSize.xs,
  },
  textMd: {
    fontSize: typography.fontSize.xs,
    lineHeight: typography.fontSize.xs * typography.lineHeight.tight,
  },
});
