import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, ActivityIndicator } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Feather } from '@expo/vector-icons';
import { typography } from '../../theme/typography';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { colors } from '../../theme/colors';
import { useSyncStatus } from '../../hooks/use-offline-sync';

interface OfflineIndicatorProps {
  showWhenOnline?: boolean;
}

/**
 * Formatteert een Date/timestamp naar "HH:MM" formaat.
 */
function formatTime(timestamp: number | null): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function OfflineIndicator({ showWhenOnline = false }: OfflineIndicatorProps) {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  // Use the sync engine for pending count, last sync time, and force sync
  const {
    pendingCount,
    lastSyncAt,
    isSyncing,
    forceSync,
    isReady: syncReady,
  } = useSyncStatus();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const shouldShow = !isConnected || (showWhenOnline && isConnected);
    Animated.spring(slideAnim, {
      toValue: shouldShow ? 0 : -100,
      useNativeDriver: true,
    }).start();
  }, [isConnected, showWhenOnline]);

  const handleRetry = useCallback(async () => {
    try {
      await forceSync();
    } catch (error) {
      console.warn('[OfflineIndicator] Force sync failed:', error);
    }
  }, [forceSync]);

  if (isConnected && !showWhenOnline) return null;

  const lastSyncFormatted = formatTime(lastSyncAt);
  const isOffline = !isConnected;

  return (
    <Animated.View
      style={[
        styles.container,
        isConnected ? styles.online : styles.offline,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Top row: connection status */}
      <View style={styles.statusRow}>
        <Feather
          name={isConnected ? 'wifi' : 'wifi-off'}
          size={14}
          color={isConnected ? colors.primary : '#8B7355'}
        />
        <Text style={[styles.text, isConnected ? styles.onlineText : styles.offlineText]}>
          {isConnected ? 'Online' : 'Offline - wijzigingen worden lokaal opgeslagen'}
        </Text>
      </View>

      {/* Details row: pending count + last sync time (only when offline or has pending) */}
      {(isOffline || pendingCount > 0) && syncReady && (
        <View style={styles.detailsRow}>
          {/* Pending changes count */}
          {pendingCount > 0 && (
            <View style={styles.detailItem}>
              <Feather name="upload-cloud" size={12} color={colors.mutedForeground} />
              <Text style={styles.detailText}>
                {pendingCount} {pendingCount === 1 ? 'wijziging wacht' : 'wijzigingen wachten'} op sync
              </Text>
            </View>
          )}

          {/* Last sync time */}
          {lastSyncFormatted && (
            <View style={styles.detailItem}>
              <Feather name="clock" size={12} color={colors.mutedForeground} />
              <Text style={styles.detailText}>
                Laatst gesynct: {lastSyncFormatted}
              </Text>
            </View>
          )}

          {/* Retry button */}
          {isOffline && pendingCount > 0 && (
            <Pressable
              style={styles.retryButton}
              onPress={handleRetry}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Feather name="refresh-cw" size={12} color={colors.primary} />
                  <Text style={styles.retryText}>Opnieuw proberen</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      )}
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
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offline: {
    backgroundColor: 'rgba(139,115,85,0.13)',
  },
  online: {
    backgroundColor: '#1A1A1A',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  offlineText: {
    color: '#8B7355',
  },
  onlineText: {
    color: '#E8E8E8',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(139,115,85,0.2)',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  retryText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
});
