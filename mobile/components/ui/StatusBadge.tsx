import React from 'react';
import { View, Text } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { tekst } from '../../theme/typography';
import type { ColorScheme } from '../../theme/colors';
import { useVeldKleuren } from '../veld/BuitenModus';

type StatusType = 'active' | 'inactive' | 'pending' | 'success' | 'error' | 'warning';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showPulse?: boolean;
  size?: 'sm' | 'md';
}

// Zelfde toonfamilie als de StatusPil in werk/Bouwstenen.
function statusKleuren(k: ColorScheme, status: StatusType): { voor: string; achter: string } {
  switch (status) {
    case 'active':
    case 'success':
      return { voor: k.success, achter: k.successSoft };
    case 'pending':
    case 'warning':
      return { voor: k.warning, achter: k.warningSoft };
    case 'error':
      return { voor: k.danger, achter: k.dangerSoft };
    default:
      return { voor: k.mutedForeground, achter: k.muted };
  }
}

const defaultLabels: Record<StatusType, string> = {
  active: 'Actief',
  inactive: 'Inactief',
  pending: 'In afwachting',
  success: 'Succes',
  error: 'Fout',
  warning: 'Waarschuwing',
};

const maten = {
  sm: { paddingHorizontal: 8, paddingVertical: 2, stip: 6, tekst: tekst.bijschrift },
  md: { paddingHorizontal: 10, paddingVertical: 4, stip: 7, tekst: tekst.voetnoot },
};

/** Status als pil mét stip; actief en in afwachting ademen zacht. */
export function StatusBadge({ status, label, showPulse = true, size = 'md' }: StatusBadgeProps) {
  const kleuren = useVeldKleuren();
  const rustig = useReducedMotion();
  const { voor, achter } = statusKleuren(kleuren, status);
  const maat = maten[size];
  const ademt = showPulse && !rustig && (status === 'active' || status === 'pending');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        borderRadius: 999,
        backgroundColor: achter,
        paddingHorizontal: maat.paddingHorizontal,
        paddingVertical: maat.paddingVertical,
      }}
    >
      <Animated.View
        style={{
          width: maat.stip,
          height: maat.stip,
          borderRadius: maat.stip / 2,
          backgroundColor: voor,
          ...(ademt
            ? {
                animationName: { from: { opacity: 1 }, to: { opacity: 0.6 } },
                animationDuration: 1000,
                animationIterationCount: 'infinite',
                animationDirection: 'alternate',
                animationTimingFunction: 'ease-in-out',
              }
            : {}),
        }}
      />
      <Text style={[maat.tekst, { color: voor, fontWeight: '600' }]}>
        {label ?? defaultLabels[status]}
      </Text>
    </View>
  );
}
