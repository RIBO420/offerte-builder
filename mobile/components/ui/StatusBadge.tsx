import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';

type StatusType = 'active' | 'inactive' | 'pending' | 'success' | 'error' | 'warning';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showPulse?: boolean;
  size?: 'sm' | 'md';
}

const statusColors: Record<StatusType, { bg: string; text: string; dot: string }> = {
  active: { bg: '#DCFCE7', text: '#166534', dot: '#22C55E' },
  inactive: { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
  pending: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  success: { bg: '#DCFCE7', text: '#166534', dot: '#22C55E' },
  error: { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
  warning: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
};

const defaultLabels: Record<StatusType, string> = {
  active: 'Actief',
  inactive: 'Inactief',
  pending: 'In afwachting',
  success: 'Succes',
  error: 'Fout',
  warning: 'Waarschuwing',
};

export function StatusBadge({ status, label, showPulse = true, size = 'md' }: StatusBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (showPulse && (status === 'active' || status === 'pending')) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [showPulse, status, pulseAnim]);

  const statusColor = statusColors[status];
  const displayLabel = label ?? defaultLabels[status];
  const shouldPulse = showPulse && (status === 'active' || status === 'pending');

  const sizeStyles = {
    sm: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      dotSize: 6,
      fontSize: typography.fontSize.xs,
    },
    md: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      dotSize: 8,
      fontSize: typography.fontSize.sm,
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: statusColor.bg,
          paddingHorizontal: currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: statusColor.dot,
            width: currentSize.dotSize,
            height: currentSize.dotSize,
            borderRadius: currentSize.dotSize / 2,
            opacity: shouldPulse ? pulseAnim : 1,
          },
        ]}
      />
      <Text
        style={[
          styles.label,
          {
            color: statusColor.text,
            fontSize: currentSize.fontSize,
          },
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    marginRight: 6,
  },
  label: {
    fontFamily: typography.fontFamily.sans,
    fontWeight: typography.fontWeight.medium,
  },
});
