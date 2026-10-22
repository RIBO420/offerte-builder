import React, { ReactNode } from 'react';
import { View, ViewStyle, TextStyle } from 'react-native';
import { Text } from './Tekst';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { tekst } from '../../theme/typography';
import type { ColorScheme } from '../../theme/colors';
import { useVeldKleuren } from '../veld/BuitenModus';

const badgeVariants = cva(
  'self-start flex-row items-center justify-center rounded-full',
  {
    variants: {
      variant: {
        default: '',
        secondary: '',
        destructive: '',
        outline: '',
        success: '',
        warning: '',
        nature: '',
      },
      size: {
        sm: 'px-2 py-0.5',
        md: 'px-2.5 py-1',
        lg: 'px-3 py-1.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;
type BadgeSize = NonNullable<VariantProps<typeof badgeVariants>['size']>;

// Pil-taal van de statuspil: zachte achtergrond, tekst in de volle toonkleur.
function variantKleuren(k: ColorScheme, variant: BadgeVariant): { vlak: ViewStyle; tekst: string } {
  switch (variant) {
    case 'secondary':
    case 'nature':
      return { vlak: { backgroundColor: k.primarySoft }, tekst: k.primary };
    case 'destructive':
      return { vlak: { backgroundColor: k.dangerSoft }, tekst: k.danger };
    case 'outline':
      return { vlak: { borderWidth: 1, borderColor: k.border, backgroundColor: 'transparent' }, tekst: k.foreground };
    case 'success':
      return { vlak: { backgroundColor: k.successSoft }, tekst: k.success };
    case 'warning':
      return { vlak: { backgroundColor: k.warningSoft }, tekst: k.warning };
    default:
      return { vlak: { backgroundColor: k.muted }, tekst: k.foreground };
  }
}

const tekstPerMaat: Record<BadgeSize, TextStyle> = {
  sm: { ...tekst.bijschrift, fontWeight: '600' },
  md: { ...tekst.voetnoot, fontWeight: '600' },
  lg: { ...tekst.sub, fontWeight: '600' },
};

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
  textClassName?: string;
}

export function Badge({
  children,
  variant,
  size,
  className,
  textClassName,
}: BadgeProps) {
  const kleuren = useVeldKleuren();
  const { vlak, tekst: tekstKleur } = variantKleuren(kleuren, variant || 'default');

  return (
    <View
      className={cn(badgeVariants({ variant, size }), className)}
      style={vlak}
    >
      <Text
        className={cn(textClassName)}
        style={[tekstPerMaat[size || 'md'], { color: tekstKleur }]}
      >
        {children}
      </Text>
    </View>
  );
}
