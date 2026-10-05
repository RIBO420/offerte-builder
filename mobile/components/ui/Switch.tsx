import React, { useState } from 'react';
import { Pressable, ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { hapticPatterns } from '../../theme/haptics';
import { useIsDonker, useVeldKleuren } from '../veld/BuitenModus';

type SwitchSize = 'sm' | 'md' | 'lg';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  size?: SwitchSize;
  style?: ViewStyle;
  className?: string;
  /** Naam van de instelling; de schakelstand leest de schermlezer zelf voor. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

// Size configuration for the switch
const sizeConfig = {
  sm: {
    trackWidth: 36,
    trackHeight: 20,
    thumbSize: 16,
    thumbMargin: 2,
  },
  md: {
    trackWidth: 48,
    trackHeight: 26,
    thumbSize: 22,
    thumbMargin: 2,
  },
  lg: {
    trackWidth: 56,
    trackHeight: 32,
    thumbSize: 28,
    thumbMargin: 2,
  },
};

/**
 * Schakelaar: spoor in primair als hij aan staat, in de randkleur als hij uit
 * staat. Kleur en duim lopen mee via CSS-transities op de UI-thread.
 */
export function Switch({
  value,
  onValueChange,
  disabled = false,
  size = 'md',
  style,
  className,
  accessibilityLabel,
  accessibilityHint,
}: SwitchProps) {
  const kleuren = useVeldKleuren();
  const donker = useIsDonker();
  const rustig = useReducedMotion();
  const [ingedrukt, setIngedrukt] = useState(false);

  const config = sizeConfig[size];
  const thumbTravel = config.trackWidth - config.thumbSize - config.thumbMargin * 2;
  // Witte duim: op donker is dat de voorgrond, op licht het kaartvlak.
  const duimKleur = donker ? kleuren.foreground : kleuren.card;
  const duur = rustig ? 0 : 200;
  // Raakvlak tot minstens 44pt, ook bij het kleine spoor.
  const slopV = Math.max(8, Math.ceil((44 - config.trackHeight) / 2));
  const slopH = Math.max(8, Math.ceil((44 - config.trackWidth) / 2));

  const handlePress = () => {
    if (!disabled) {
      void hapticPatterns.selection();
      onValueChange(!value);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => !disabled && setIngedrukt(true)}
      onPressOut={() => setIngedrukt(false)}
      disabled={disabled}
      hitSlop={{ top: slopV, bottom: slopV, left: slopH, right: slopH }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={style}
      className={className}
    >
      <Animated.View
        style={{
          justifyContent: 'center',
          width: config.trackWidth,
          height: config.trackHeight,
          borderRadius: config.trackHeight / 2,
          backgroundColor: value ? kleuren.primary : kleuren.border,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: ingedrukt && !rustig ? 0.95 : 1 }],
          transitionProperty: ['backgroundColor', 'transform'],
          transitionDuration: [duur, 120],
          transitionTimingFunction: 'ease-out',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            left: config.thumbMargin,
            width: config.thumbSize,
            height: config.thumbSize,
            borderRadius: config.thumbSize / 2,
            backgroundColor: duimKleur,
            transform: [{ translateX: value ? thumbTravel : 0 }],
            transitionProperty: 'transform',
            transitionDuration: duur,
            transitionTimingFunction: 'ease-out',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 2.5,
            elevation: 4,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

export default Switch;
