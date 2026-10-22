/**
 * SyncStatus — Top Tuinen Mobile App
 *
 * Status-balk bovenaan het scherm die de offline sync-status toont.
 * Ondersteunt uitklappend detail-paneel met pending items en retry-acties.
 *
 * Gebruikt:
 *   - useOfflineQueue (mobile/hooks/use-offline-queue.ts)
 *   - @react-native-community/netinfo (aanwezig in package.json)
 *   - react-native-reanimated (aanwezig in package.json)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Text } from './ui/Tekst';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import type { UseOfflineQueueReturn, QueueItem, QueueItemType, QueueItemStatus } from '@/hooks/use-offline-queue';
import { tekst } from '../theme/typography';
import type { ColorScheme } from '../theme/colors';
import { useVeldKleuren } from './veld/BuitenModus';

// ============================================
// TYPES
// ============================================

type SyncModus = 'gesynchroniseerd' | 'wachtend' | 'offline' | 'bezig';

interface SyncStatusProps {
  /** Queue-state van useOfflineQueue */
  queue: QueueItem[];
  pendingCount: number;
  isSyncing: boolean;
  onSyncAll: () => Promise<void>;
  onRemove: UseOfflineQueueReturn['removeFromQueue'];
  onClearCompleted: UseOfflineQueueReturn['clearCompleted'];
}

// ============================================
// HELPERS
// ============================================

const TYPE_LABELS: Record<QueueItemType, string> = {
  foto:     'Foto',
  opname:   'Opname',
  aanvraag: 'Aanvraag',
};

const TYPE_ICONEN: Record<QueueItemType, string> = {
  foto:     'image',
  opname:   'mic',
  aanvraag: 'file-text',
};

const STATUS_LABELS: Record<QueueItemStatus, string> = {
  pending:   'Wachtend',
  uploading: 'Uploaden…',
  completed: 'Voltooid',
  failed:    'Mislukt',
};

function formateerTijdstip(ms: number): string {
  const datum = new Date(ms);
  return datum.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

function formateerDatum(ms: number): string {
  const nu = Date.now();
  const verschil = nu - ms;
  const minuten = Math.floor(verschil / 60_000);
  if (minuten < 1)   return 'Zojuist';
  if (minuten < 60)  return `${minuten} min geleden`;
  const uren = Math.floor(minuten / 60);
  if (uren < 24)     return `${uren}u geleden`;
  return formateerTijdstip(ms);
}

// ============================================
// SUBCOMPONENTEN
// ============================================

interface StatusBalkConfig {
  modus: SyncModus;
  achtergrond: string;
  tekstKleur: string;
  icoon: string;
  bericht: string;
}

// Rustige strook in de toonkleur van de modus: zachte achtergrond, volle tekst.
function bepaalStatusConfig(
  k: ColorScheme,
  modus: SyncModus,
  pendingCount: number
): StatusBalkConfig {
  switch (modus) {
    case 'bezig':
      return {
        modus,
        achtergrond: k.infoSoft,
        tekstKleur: k.info,
        icoon: 'refresh-cw',
        bericht: 'Synchroniseren…',
      };
    case 'offline':
      return {
        modus,
        achtergrond: k.warningSoft,
        tekstKleur: k.warning,
        icoon: 'wifi-off',
        bericht: 'Geen internetverbinding — offline modus',
      };
    case 'wachtend':
      return {
        modus,
        achtergrond: k.warningSoft,
        tekstKleur: k.warning,
        icoon: 'clock',
        bericht: `${pendingCount} item${pendingCount !== 1 ? 's' : ''} wachten op synchronisatie`,
      };
    case 'gesynchroniseerd':
    default:
      return {
        modus,
        achtergrond: k.successSoft,
        tekstKleur: k.success,
        icoon: 'check-circle',
        bericht: 'Alles gesynchroniseerd',
      };
  }
}

function statusToon(k: ColorScheme, status: QueueItemStatus): { voor: string; achter: string } {
  switch (status) {
    case 'pending':
      return { voor: k.warning, achter: k.warningSoft };
    case 'failed':
      return { voor: k.danger, achter: k.dangerSoft };
    default:
      return { voor: k.success, achter: k.successSoft };
  }
}

// ----------------------------------------
// Queue-item rij in het detail-paneel
// ----------------------------------------

interface QueueItemRijProps {
  item: QueueItem;
  onVerwijder: (id: string) => void;
}

const QueueItemRij = React.memo(({ item, onVerwijder }: QueueItemRijProps) => {
  const kleuren = useVeldKleuren();
  const { voor, achter } = statusToon(kleuren, item.status);

  return (
    <View style={[stijlen.queueItemRij, { borderBottomColor: kleuren.border }]}>
      {/* Icoon */}
      <View style={[stijlen.queueItemIcoonContainer, { backgroundColor: kleuren.muted }]}>
        <Feather
          name={TYPE_ICONEN[item.type] as 'image'}
          size={18}
          color={kleuren.mutedForeground}
        />
      </View>

      {/* Info */}
      <View style={stijlen.queueItemInfo}>
        <View style={stijlen.queueItemBovenRij}>
          <Text style={[tekst.kop, { color: kleuren.foreground, fontSize: 16 }]}>{TYPE_LABELS[item.type]}</Text>
          <View style={[stijlen.queueItemStatusBadge, { backgroundColor: achter }]}>
            {item.status === 'uploading' ? (
              <ActivityIndicator size={8} color={voor} />
            ) : (
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: voor }} />
            )}
            <Text style={[tekst.bijschrift, { color: voor, fontWeight: '600' }]}>
              {STATUS_LABELS[item.status]}
            </Text>
          </View>
        </View>
        <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]}>{formateerDatum(item.createdAt)}</Text>
        {item.lastError !== undefined && item.status === 'failed' && (
          <Text style={[tekst.voetnoot, { color: kleuren.danger }]} numberOfLines={2}>
            {item.lastError}
          </Text>
        )}
        {item.retryCount > 0 && (
          <Text style={[tekst.voetnoot, tekst.cijfers, { color: kleuren.mutedForeground }]}>
            Poging {item.retryCount}/{3}
          </Text>
        )}
      </View>

      {/* Verwijder-knop */}
      <TouchableOpacity
        style={stijlen.queueItemVerwijder}
        onPress={() => onVerwijder(item.id)}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`${TYPE_LABELS[item.type]} uit de wachtrij verwijderen`}
      >
        <Feather name="trash-2" size={18} color={kleuren.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
});
QueueItemRij.displayName = 'QueueItemRij';

// ----------------------------------------
// Detail-paneel (modal)
// ----------------------------------------

interface DetailPaneelProps {
  zichtbaar: boolean;
  queue: QueueItem[];
  isSyncing: boolean;
  onSluit: () => void;
  onSyncAll: () => Promise<void>;
  onVerwijder: (id: string) => void;
  onClearCompleted: () => void;
}

function DetailPaneel({
  zichtbaar,
  queue,
  isSyncing,
  onSluit,
  onSyncAll,
  onVerwijder,
  onClearCompleted,
}: DetailPaneelProps) {
  const kleuren = useVeldKleuren();
  const [isSyncingLokaal, setIsSyncingLokaal] = useState(false);

  const handleSyncAll = useCallback(async () => {
    setIsSyncingLokaal(true);
    try {
      await onSyncAll();
    } finally {
      setIsSyncingLokaal(false);
    }
  }, [onSyncAll]);

  const pendingItems = queue.filter((i) => i.status === 'pending' || i.status === 'uploading');
  const failedItems  = queue.filter((i) => i.status === 'failed');
  const completedItems = queue.filter((i) => i.status === 'completed');
  const heeftCompleted = completedItems.length > 0;
  const bezig = isSyncing || isSyncingLokaal;
  const groepLabel = [tekst.voetnoot, stijlen.groepLabel, { color: kleuren.mutedForeground }];

  return (
    <Modal
      visible={zichtbaar}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onSluit}
    >
      <SafeAreaView style={[stijlen.paneelContainer, { backgroundColor: kleuren.background }]} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[stijlen.paneelHeader, { borderBottomColor: kleuren.border }]}>
          <Text accessibilityRole="header" style={[tekst.titel3, { color: kleuren.foreground }]}>
            Synchronisatie-wachtrij
          </Text>
          <TouchableOpacity onPress={onSluit} hitSlop={10} accessibilityRole="button" accessibilityLabel="Sluiten">
            <Feather name="x" size={22} color={kleuren.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Actie-knoppen */}
        <View style={[stijlen.paneelActies, { borderBottomColor: kleuren.border }]}>
          <TouchableOpacity
            style={[stijlen.syncAllKnop, { backgroundColor: kleuren.primary }, bezig && stijlen.syncAllKnopDisabled]}
            onPress={handleSyncAll}
            disabled={bezig}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ disabled: bezig, busy: bezig }}
          >
            {bezig ? (
              <ActivityIndicator size="small" color={kleuren.primaryForeground} />
            ) : (
              <Feather name="refresh-cw" size={16} color={kleuren.primaryForeground} />
            )}
            <Text style={[tekst.kop, { color: kleuren.primaryForeground, fontSize: 16 }]}>
              {bezig ? 'Synchroniseren…' : 'Alles synchroniseren'}
            </Text>
          </TouchableOpacity>

          {heeftCompleted && (
            <TouchableOpacity
              style={[stijlen.opruimenKnop, { borderColor: kleuren.border, backgroundColor: kleuren.card }]}
              onPress={onClearCompleted}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={[tekst.sub, { color: kleuren.foreground, fontWeight: '500' }]}>Voltooide wissen</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={stijlen.paneelLijst} showsVerticalScrollIndicator={false}>
          {/* Wachtend/Uploaden */}
          {pendingItems.length > 0 && (
            <>
              <Text style={groepLabel}>
                Wachtend ({pendingItems.length})
              </Text>
              {pendingItems.map((item) => (
                <QueueItemRij key={item.id} item={item} onVerwijder={onVerwijder} />
              ))}
            </>
          )}

          {/* Mislukt */}
          {failedItems.length > 0 && (
            <>
              <Text style={[groepLabel, { color: kleuren.danger }]}>
                Mislukt ({failedItems.length})
              </Text>
              {failedItems.map((item) => (
                <QueueItemRij key={item.id} item={item} onVerwijder={onVerwijder} />
              ))}
            </>
          )}

          {/* Voltooid */}
          {completedItems.length > 0 && (
            <>
              <Text style={[groepLabel, { color: kleuren.success }]}>
                Voltooid ({completedItems.length})
              </Text>
              {completedItems.map((item) => (
                <QueueItemRij key={item.id} item={item} onVerwijder={onVerwijder} />
              ))}
            </>
          )}

          {/* Lege staat */}
          {queue.length === 0 && (
            <View style={stijlen.leegPaneel}>
              <View style={{ width: 56, height: 56, borderRadius: 17, backgroundColor: kleuren.successSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="check-circle" size={28} color={kleuren.success} />
              </View>
              <Text style={[tekst.kop, { color: kleuren.foreground }]}>Alles gesynchroniseerd</Text>
              <Text style={[tekst.sub, { color: kleuren.mutedForeground, textAlign: 'center' }]}>
                Er zijn geen items in de wachtrij.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ============================================
// HOOFD-COMPONENT
// ============================================

/**
 * SyncStatus
 *
 * Status-balk die de offline sync-toestand weergeeft.
 * Kleur en bericht passen zich automatisch aan op basis van:
 * - Netwerktoestand (online/offline)
 * - Aantal pending items
 * - Sync-status
 *
 * Tik op de balk om een detail-paneel te openen met alle queue-items.
 *
 * @example
 * const queue = useOfflineQueue();
 * <SyncStatus
 *   queue={queue.queue}
 *   pendingCount={queue.pendingCount}
 *   isSyncing={queue.isSyncing}
 *   onSyncAll={queue.syncAll}
 *   onRemove={queue.removeFromQueue}
 *   onClearCompleted={queue.clearCompleted}
 * />
 */
export function SyncStatus({
  queue,
  pendingCount,
  isSyncing,
  onSyncAll,
  onRemove,
  onClearCompleted,
}: SyncStatusProps) {
  const kleuren = useVeldKleuren();
  const [isOnline, setIsOnline] = useState(true);
  const [detailZichtbaar, setDetailZichtbaar] = useState(false);

  // Netwerk-monitoring
  useEffect(() => {
    const afmelden = NetInfo.addEventListener((staat) => {
      setIsOnline(staat.isConnected === true && staat.isInternetReachable !== false);
    });
    return () => afmelden();
  }, []);

  // Bepaal modus
  const modus: SyncModus = (() => {
    if (isSyncing)         return 'bezig';
    if (!isOnline)         return 'offline';
    if (pendingCount > 0)  return 'wachtend';
    return 'gesynchroniseerd';
  })();

  const config = bepaalStatusConfig(kleuren, modus, pendingCount);

  // Animatie voor de balk (subtiele puls bij 'wachtend')
  const schaal = useSharedValue(1);
  const geanimeerdeStijl = useAnimatedStyle(() => ({
    transform: [{ scale: schaal.get() }],
  }));

  useEffect(() => {
    if (modus === 'wachtend') {
      schaal.set(withSpring(1.01, { damping: 8 }, () => {
        schaal.set(withSpring(1));
      }));
    }
  }, [modus, schaal]);

  return (
    <>
      <Animated.View style={geanimeerdeStijl}>
        <TouchableOpacity
          style={[stijlen.statusBalk, { backgroundColor: config.achtergrond }]}
          onPress={() => setDetailZichtbaar(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={config.bericht}
          accessibilityHint="Opent de synchronisatie-wachtrij"
        >
          {/* Icoon / spinner */}
          {modus === 'bezig' ? (
            <ActivityIndicator size="small" color={config.tekstKleur} />
          ) : (
            <Feather
              name={config.icoon as 'check-circle'}
              size={16}
              color={config.tekstKleur}
            />
          )}

          {/* Bericht */}
          <Text style={[tekst.voetnoot, stijlen.statusBalkTekst, { color: config.tekstKleur }]}>
            {config.bericht}
          </Text>

          {/* Pijl rechts */}
          {(pendingCount > 0 || queue.length > 0) && (
            <Feather name="chevron-right" size={16} color={config.tekstKleur} style={{ opacity: 0.7 }} />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Detail-paneel */}
      <DetailPaneel
        zichtbaar={detailZichtbaar}
        queue={queue}
        isSyncing={isSyncing}
        onSluit={() => setDetailZichtbaar(false)}
        onSyncAll={onSyncAll}
        onVerwijder={onRemove}
        onClearCompleted={onClearCompleted}
      />
    </>
  );
}

export default SyncStatus;

// ============================================
// STIJLEN (lay-out; kleuren komen uit het thema)
// ============================================

const stijlen = StyleSheet.create({
  // Status-balk
  statusBalk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  statusBalkTekst: {
    flex: 1,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Detail-paneel
  paneelContainer: {
    flex: 1,
  },
  paneelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  paneelActies: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
  },
  syncAllKnop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: 12,
  },
  syncAllKnopDisabled: {
    opacity: 0.6,
  },
  opruimenKnop: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },

  paneelLijst: {
    flex: 1,
    padding: 16,
  },
  groepLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 16,
  },

  // Queue item rij
  queueItemRij: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  queueItemIcoonContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  queueItemInfo: {
    flex: 1,
    gap: 3,
  },
  queueItemBovenRij: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  queueItemStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  queueItemVerwijder: {
    padding: 6,
    flexShrink: 0,
  },

  // Lege staat
  leegPaneel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
});
