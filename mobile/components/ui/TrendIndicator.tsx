import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { tekst } from '../../theme/typography';
import type { ColorScheme } from '../../theme/colors';
import { useVeldKleuren } from '../veld/BuitenModus';

type TrendDirection = 'up' | 'down' | 'neutral';

interface TrendIndicatorProps {
  value: number; // Percentage change
  direction?: TrendDirection; // Override auto-detection
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function trendKleuren(k: ColorScheme, richting: TrendDirection): { voor: string; achter: string } {
  switch (richting) {
    case 'up':
      return { voor: k.success, achter: k.successSoft };
    case 'down':
      return { voor: k.danger, achter: k.dangerSoft };
    default:
      return { voor: k.mutedForeground, achter: k.muted };
  }
}

const icons: Record<TrendDirection, 'trending-up' | 'trending-down' | 'minus'> = {
  up: 'trending-up',
  down: 'trending-down',
  neutral: 'minus',
};

const iconSizes = { sm: 14, md: 16, lg: 18 };
const tekstStijlen = { sm: tekst.bijschrift, md: tekst.voetnoot, lg: tekst.sub };
const paddingSizes = { sm: { h: 8, v: 2 }, md: { h: 10, v: 4 }, lg: { h: 12, v: 6 } };

export function TrendIndicator({
  value,
  direction,
  showValue = true,
  size = 'md',
}: TrendIndicatorProps) {
  const kleuren = useVeldKleuren();
  const autoDirection: TrendDirection = value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
  const actualDirection = direction ?? autoDirection;
  const { voor, achter } = trendKleuren(kleuren, actualDirection);
  const currentPadding = paddingSizes[size];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
        borderRadius: 999,
        backgroundColor: achter,
        paddingHorizontal: currentPadding.h,
        paddingVertical: currentPadding.v,
      }}
    >
      <Feather name={icons[actualDirection]} size={iconSizes[size]} color={voor} />
      {showValue && (
        <Text style={[tekstStijlen[size], tekst.cijfers, { color: voor, fontWeight: '600' }]}>
          {value > 0 ? '+' : ''}
          {value.toFixed(1)}%
        </Text>
      )}
    </View>
  );
}
