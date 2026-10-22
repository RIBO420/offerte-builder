import React, { useState } from 'react';
import { Pressable, ViewStyle } from 'react-native';
import { Text } from './Tekst';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { Check, Minus } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { hapticPatterns } from '../../theme/haptics';
import { tekst } from '../../theme/typography';
import { useVeldKleuren } from '../veld/BuitenModus';

const CHECKBOX_SIZE = 22;

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  label?: string;
  style?: ViewStyle;
  className?: string;
}

/**
 * Vinkvak met een tikvlak van 44 pt. Aangevinkt vult hij in primair; het vinkje
 * springt in via een CSS-transitie op schaal en opacity.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  disabled = false,
  indeterminate = false,
  label,
  style,
  className,
}: CheckboxProps) {
  const kleuren = useVeldKleuren();
  const rustig = useReducedMotion();
  const [ingedrukt, setIngedrukt] = useState(false);
  const isActive = checked || indeterminate;

  const handlePress = () => {
    if (!disabled) {
      void hapticPatterns.selection();
      onCheckedChange(!checked);
    }
  };

  const Teken = indeterminate ? Minus : Check;

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => !disabled && setIngedrukt(true)}
      onPressOut={() => setIngedrukt(false)}
      disabled={disabled}
      style={style}
      className={cn('flex-row items-center min-h-[44px]', className)}
      accessibilityRole="checkbox"
      accessibilityState={{
        checked: indeterminate ? 'mixed' : checked,
        disabled,
      }}
      accessibilityLabel={label}
    >
      <Animated.View
        style={{
          width: 44,
          height: 44,
          justifyContent: 'center',
          alignItems: 'center',
          transform: [{ scale: ingedrukt && !rustig ? 0.92 : 1 }],
          transitionProperty: 'transform',
          transitionDuration: 120,
          transitionTimingFunction: 'ease-out',
        }}
      >
        <Animated.View
          style={{
            width: CHECKBOX_SIZE,
            height: CHECKBOX_SIZE,
            borderRadius: 7,
            borderWidth: 2,
            borderColor: isActive ? kleuren.primary : kleuren.mutedForeground,
            backgroundColor: isActive ? kleuren.primary : 'transparent',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: disabled ? 0.5 : 1,
            transitionProperty: ['backgroundColor', 'borderColor'],
            transitionDuration: rustig ? 0 : 120,
          }}
        >
          <Animated.View
            style={{
              opacity: isActive ? 1 : 0,
              transform: [{ scale: isActive ? 1 : 0.4 }],
              transitionProperty: ['opacity', 'transform'],
              transitionDuration: rustig ? 0 : 160,
              transitionTimingFunction: 'ease-out',
            }}
          >
            <Teken size={15} color={kleuren.primaryForeground} strokeWidth={3} />
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {label && (
        <Text
          style={[
            tekst.callout,
            { color: disabled ? kleuren.mutedForeground : kleuren.foreground, marginLeft: 4, flexShrink: 1 },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export default Checkbox;
