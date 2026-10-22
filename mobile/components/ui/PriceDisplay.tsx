import React from 'react';
import { View, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { Text } from './Tekst';
import { typography, tekst } from '../../theme/typography';
import type { ColorScheme } from '../../theme/colors';
import { useVeldKleuren } from '../veld/BuitenModus';
import { AnimatedNumber } from './AnimatedNumber';

type PriceSize = 'sm' | 'md' | 'lg' | 'xl';
type PriceVariant = 'default' | 'success' | 'warning' | 'muted';

// 'warning' toonde altijd rood (te hoog bedrag); dat blijft zo, nu via danger.
function variantKleur(k: ColorScheme, variant: PriceVariant): string {
  switch (variant) {
    case 'success':
      return k.success;
    case 'warning':
      return k.danger;
    case 'muted':
      return k.mutedForeground;
    default:
      return k.foreground;
  }
}

interface PriceDisplayProps {
  value: number;
  size?: PriceSize;
  variant?: PriceVariant;
  animated?: boolean;
  showDecimals?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function PriceDisplay({
  value,
  size = 'md',
  variant = 'default',
  animated = false,
  showDecimals = true,
  style,
  textStyle,
}: PriceDisplayProps) {
  const kleuren = useVeldKleuren();
  const kleur = { color: variantKleur(kleuren, variant) };
  const formatOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  };

  if (animated) {
    return (
      <View style={[styles.container, style]}>
        <AnimatedNumber
          value={value}
          locale="nl-NL"
          formatOptions={formatOptions}
          style={[sizeStyles[size], tekst.cijfers, kleur, textStyle]}
        />
      </View>
    );
  }

  const formattedPrice = new Intl.NumberFormat('nl-NL', formatOptions).format(value);

  return (
    <View style={[styles.container, style]}>
      <Text style={[sizeStyles[size], tekst.cijfers, kleur, styles.price, textStyle]}>
        {formattedPrice}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontFamily: typography.fontFamily.sans,
  },
});

const sizeStyles = StyleSheet.create({
  sm: {
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
  },
  md: {
    fontSize: 15,
    fontWeight: typography.fontWeight.semibold,
  },
  lg: {
    fontSize: 20,
    fontWeight: typography.fontWeight.semibold,
  },
  xl: {
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
  },
});
