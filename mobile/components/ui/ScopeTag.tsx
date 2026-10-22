import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Text } from './Tekst';
import { tekst } from '../../theme/typography';
import { useVeldKleuren } from '../veld/BuitenModus';

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
 * Convert a hex color to rgba with a given alpha (for the soft background)
 */
function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Scope als pil: zachte tint van de scopekleur, tekst in de volle kleur. */
export function ScopeTag({ scope, size = 'md', style }: ScopeTagProps) {
  const kleuren = useVeldKleuren();
  // Onbekende scope (data uit de backend) valt terug op de neutrale toon.
  const scopeColor: string | undefined = kleuren.scope[scope];
  const voor = scopeColor ?? kleuren.mutedForeground;
  const achter = scopeColor ? hexToRgba(scopeColor, 0.14) : kleuren.muted;

  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          backgroundColor: achter,
          paddingHorizontal: size === 'sm' ? 8 : 10,
          paddingVertical: size === 'sm' ? 2 : 4,
        },
        style,
      ]}
    >
      <Text style={[size === 'sm' ? tekst.bijschrift : tekst.voetnoot, { color: voor, fontWeight: '600' }]}>
        {scopeLabels[scope] ?? scope}
      </Text>
    </View>
  );
}
