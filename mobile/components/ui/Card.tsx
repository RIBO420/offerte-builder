import React, { ReactNode } from 'react';
import { View, Text, ViewStyle, StyleProp } from 'react-native';
import { cn } from '@/lib/utils';
import { tekst } from '../../theme/typography';
import type { ColorScheme } from '../../theme/colors';
import { useIsDonker, useVeldKleuren } from '../veld/BuitenModus';

type CardVariant = 'default' | 'subtle' | 'ghost' | 'elevated' | 'glass' | 'nature';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
  style?: ViewStyle;
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

// Vlak per variant uit het actieve thema; radius 18 zoals de Kaart-bouwsteen.
function variantStijl(k: ColorScheme, variant: CardVariant, donker: boolean): ViewStyle {
  switch (variant) {
    case 'subtle':
      return { backgroundColor: k.muted };
    case 'ghost':
      return { backgroundColor: 'transparent' };
    case 'elevated':
      return {
        backgroundColor: k.card,
        borderWidth: 1,
        borderColor: k.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: donker ? 0.3 : 0.06,
        shadowRadius: 12,
        elevation: donker ? 6 : 2,
      };
    case 'glass':
      return { backgroundColor: k.surfaceOverlay, borderWidth: 1, borderColor: k.border };
    case 'nature':
      return { backgroundColor: k.gradientStart, borderWidth: 1, borderColor: k.gradientBorder };
    default:
      return { backgroundColor: k.card, borderWidth: 1, borderColor: k.border };
  }
}

/**
 * Card - Main container component
 * Variants: default, subtle, ghost, elevated, glass, nature
 */
export function Card({ children, className, variant = 'default', style }: CardProps) {
  const kleuren = useVeldKleuren();
  const donker = useIsDonker();

  return (
    <View
      className={cn('p-4', className)}
      style={[{ borderRadius: 18 }, variantStijl(kleuren, variant, donker), style]}
    >
      {children}
    </View>
  );
}

/**
 * CardHeader - Container for title and description
 */
export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <View className={cn('gap-1 mb-3', className)}>
      {children}
    </View>
  );
}

/**
 * CardTitle - Main heading text for the card
 */
export function CardTitle({ children, className }: CardTitleProps) {
  const kleuren = useVeldKleuren();
  return (
    <Text className={cn(className)} style={[tekst.kop, { color: kleuren.foreground }]}>
      {children}
    </Text>
  );
}

/**
 * CardDescription - Secondary descriptive text
 */
export function CardDescription({ children, className }: CardDescriptionProps) {
  const kleuren = useVeldKleuren();
  return (
    <Text className={cn(className)} style={[tekst.sub, { color: kleuren.mutedForeground }]}>
      {children}
    </Text>
  );
}

/**
 * CardContent - Main content area of the card
 */
export function CardContent({ children, className, style }: CardContentProps) {
  return (
    <View className={cn('', className)} style={style}>
      {children}
    </View>
  );
}

/**
 * CardFooter - Bottom section of the card
 */
export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <View className={cn('flex-row items-center mt-3', className)}>
      {children}
    </View>
  );
}
