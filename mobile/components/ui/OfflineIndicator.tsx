import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

interface OfflineIndicatorProps {
  showWhenOnline?: boolean;
}

export function OfflineIndicator({ showWhenOnline = false }: OfflineIndicatorProps) {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const slideAnim = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const shouldShow = !isConnected || (showWhenOnline && isConnected);
    Animated.spring(slideAnim, {
      toValue: shouldShow ? 0 : -50,
      useNativeDriver: true,
    }).start();
  }, [isConnected, showWhenOnline]);

  if (isConnected && !showWhenOnline) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        isConnected ? styles.online : styles.offline,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Feather
        name={isConnected ? 'wifi' : 'wifi-off'}
        size={14}
        color={isConnected ? colors.trend.positive : '#FFF'}
      />
      <Text style={[styles.text, isConnected && styles.onlineText]}>
        {isConnected ? 'Online' : 'Offline - wijzigingen worden lokaal opgeslagen'}
      </Text>
    </Animated.View>
  );
}

// Hook for components to check online status
export function useOnlineStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  return isConnected;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  offline: {
    backgroundColor: colors.destructive,
  },
  online: {
    backgroundColor: colors.muted,
  },
  text: {
    color: '#FFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  onlineText: {
    color: colors.foreground,
  },
});
