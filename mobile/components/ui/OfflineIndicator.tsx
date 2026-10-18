import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import NetInfo from '@react-native-community/netinfo';
import { Clock, CloudUpload, RefreshCw, Wifi, WifiOff } from 'lucide-react-native';
import { tekst } from '../../theme/typography';
import { hapticPatterns } from '../../theme/haptics';
import { useVeldKleuren } from '../veld/BuitenModus';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';

interface OfflineIndicatorProps {
  showWhenOnline?: boolean;
  /** Extra lay-out voor de strook, bv. marge buiten een ScrollView. */
  style?: StyleProp<ViewStyle>;
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

/**
 * Rustige strook bovenaan een veldscherm: alleen zichtbaar zonder verbinding
 * (of met `showWhenOnline`). Toont wat er in de VeldOutbox nog wacht en wanneer
 * die laatst leeg was; online en zonder `showWhenOnline` rendert hij niets.
 */
export function OfflineIndicator({ showWhenOnline = false, style }: OfflineIndicatorProps) {
  const kleuren = useVeldKleuren();
  const rustig = useReducedMotion();
  // Verbindingsstatus, wachtrij en "laatst gesynct" komen uit dezelfde gedeelde
  // store als de invoerschermen: geen eigen NetInfo-listener of tweede wachtrij.
  const { wachtrij, online: isConnected, laatstGesynctOp: lastSyncAt, synchroniseer } = useVeldOpdracht();
  const pendingCount = wachtrij.filter(opdracht => opdracht.status === 'wacht').length;
  const [isSyncing, setIsSyncing] = useState(false);

  const handleRetry = useCallback(async () => {
    void hapticPatterns.tap();
    setIsSyncing(true);
    try {
      // Verse verbindingsstatus: een herstelde verbinding start de sync via de store.
      await NetInfo.refresh().catch(() => undefined);
      await synchroniseer();
    } catch (error) {
      console.warn('[OfflineIndicator] Synchroniseren mislukt:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [synchroniseer]);

  if (isConnected && !showWhenOnline) return null;

  const lastSyncFormatted = formatTime(lastSyncAt);
  const isOffline = !isConnected;
  const voor = isOffline ? kleuren.warning : kleuren.mutedForeground;
  const toonDetails = isOffline || pendingCount > 0;
  const StatusIcoon = isOffline ? WifiOff : Wifi;

  return (
    <Animated.View
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      style={[
        {
          backgroundColor: isOffline ? kleuren.warningSoft : kleuren.muted,
          borderRadius: 12,
          paddingVertical: 8,
          paddingHorizontal: 12,
          gap: 6,
        },
        rustig
          ? null
          : {
              animationName: {
                from: { opacity: 0, transform: [{ translateY: -6 }] },
                to: { opacity: 1, transform: [{ translateY: 0 }] },
              },
              animationDuration: 200,
              animationTimingFunction: 'ease-out',
            },
        style,
      ]}
    >
      {/* Verbindingsstatus */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <StatusIcoon size={16} color={voor} strokeWidth={2.2} />
        <Text style={[tekst.voetnoot, { color: voor, fontWeight: '600', flexShrink: 1 }]}>
          {isConnected ? 'Online' : 'Offline — wijzigingen worden lokaal bewaard'}
        </Text>
      </View>

      {/* Wachtende wijzigingen, laatste sync en opnieuw proberen */}
      {toonDetails && (pendingCount > 0 || lastSyncFormatted) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 12, rowGap: 4, paddingLeft: 24 }}>
          {pendingCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <CloudUpload size={13} color={kleuren.mutedForeground} />
              <Text style={[tekst.bijschrift, tekst.cijfers, { color: kleuren.mutedForeground }]}>
                {pendingCount} {pendingCount === 1 ? 'wijziging wacht' : 'wijzigingen wachten'}
              </Text>
            </View>
          )}

          {lastSyncFormatted && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={13} color={kleuren.mutedForeground} />
              <Text style={[tekst.bijschrift, tekst.cijfers, { color: kleuren.mutedForeground }]}>
                Laatst gesynct {lastSyncFormatted}
              </Text>
            </View>
          )}

          {pendingCount > 0 && (
            <Pressable
              onPress={handleRetry}
              disabled={isSyncing}
              // Kleine tekstknop: verticaal ruim uitbreiden tot een raakvlak van 44pt.
              hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Opnieuw proberen te synchroniseren"
              accessibilityState={{ disabled: isSyncing, busy: isSyncing }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={kleuren.primary} />
              ) : (
                <>
                  <RefreshCw size={13} color={kleuren.primary} strokeWidth={2.2} />
                  <Text style={[tekst.bijschrift, { color: kleuren.primary, fontWeight: '600' }]}>
                    Opnieuw proberen
                  </Text>
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
