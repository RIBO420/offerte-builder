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

/**
 * Convert a hex color to rgba with a given alpha (for 15% opacity background)
 */
function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function ScopeTag({ scope, size = 'md', style }: ScopeTagProps) {
  const scopeColor = colors.scope[scope];
  // Background: scope color at 15% opacity
  const backgroundColor = hexToRgba(scopeColor, 0.15);

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
          { color: scopeColor },
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
