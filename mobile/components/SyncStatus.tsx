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
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import type { UseOfflineQueueReturn, QueueItem, QueueItemType, QueueItemStatus } from '@/hooks/use-offline-queue';

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
  uploading: 'Uploaden...',
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
  rand: string;
  tekstKleur: string;
  icoon: string;
  bericht: string;
}

function bepaalStatusConfig(
  modus: SyncModus,
  pendingCount: number
): StatusBalkConfig {
  switch (modus) {
    case 'bezig':
      return {
        modus,
        achtergrond: '#1A2E1A',
        rand: '#4ADE80',
        tekstKleur: '#E8E8E8',
        icoon: 'refresh-cw',
        bericht: 'Synchroniseren...',
      };
    case 'offline':
      return {
        modus,
        achtergrond: '#2A1010',
        rand: '#EF4444',
        tekstKleur: '#E8E8E8',
        icoon: 'wifi-off',
        bericht: 'Geen internetverbinding — offline modus',
      };
    case 'wachtend':
      return {
        modus,
        achtergrond: '#2A2010',
        rand: '#F59E0B',
        tekstKleur: '#E8E8E8',
        icoon: 'clock',
        bericht: `${pendingCount} item${pendingCount !== 1 ? 's' : ''} wachten op synchronisatie`,
      };
    case 'gesynchroniseerd':
    default:
      return {
        modus,
        achtergrond: '#0D1F0D',
        rand: '#4ADE80',
        tekstKleur: '#E8E8E8',
        icoon: 'check-circle',
        bericht: 'Alles gesynchroniseerd',
      };
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
  const statusKleur: Record<QueueItemStatus, string> = {
    pending:   '#F59E0B',
    uploading: '#4ADE80',
    completed: '#4ADE80',
    failed:    '#EF4444',
  };

  return (
    <View style={stijlen.queueItemRij}>
      {/* Icoon */}
      <View style={[stijlen.queueItemIcoonContainer, { backgroundColor: '#1A1A1A' }]}>
        <Feather
          name={TYPE_ICONEN[item.type] as 'image'}
          size={18}
          color="#888"
        />
      </View>

      {/* Info */}
      <View style={stijlen.queueItemInfo}>
        <View style={stijlen.queueItemBovenRij}>
          <Text style={stijlen.queueItemType}>{TYPE_LABELS[item.type]}</Text>
          <View
            style={[
              stijlen.queueItemStatusBadge,
              { backgroundColor: statusKleur[item.status] + '22' },
            ]}
          >
            {item.status === 'uploading' && (
              <ActivityIndicator size={8} color={statusKleur[item.status]} />
            )}
            <Text style={[stijlen.queueItemStatusTekst, { color: statusKleur[item.status] }]}>
              {STATUS_LABELS[item.status]}
            </Text>
          </View>
        </View>
        <Text style={stijlen.queueItemDatum}>{formateerDatum(item.createdAt)}</Text>
        {item.lastError !== undefined && item.status === 'failed' && (
          <Text style={stijlen.queueItemFout} numberOfLines={1}>
            {item.lastError}
          </Text>
        )}
        {item.retryCount > 0 && (
          <Text style={stijlen.queueItemRetry}>
            Poging {item.retryCount}/{3}
          </Text>
        )}
      </View>

      {/* Verwijder-knop */}
      <TouchableOpacity
        style={stijlen.queueItemVerwijder}
        onPress={() => onVerwijder(item.id)}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Feather name="trash-2" size={16} color="#888" />
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

  return (
    <Modal
      visible={zichtbaar}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onSluit}
    >
      <SafeAreaView style={stijlen.paneelContainer} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={stijlen.paneelHeader}>
          <Text style={stijlen.paneelTitel}>Synchronisatie-wachtrij</Text>
          <TouchableOpacity onPress={onSluit}>
            <Feather name="x" size={22} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Actie-knoppen */}
        <View style={stijlen.paneelActies}>
          <TouchableOpacity
            style={[stijlen.syncAllKnop, (isSyncing || isSyncingLokaal) && stijlen.syncAllKnopDisabled]}
            onPress={handleSyncAll}
            disabled={isSyncing || isSyncingLokaal}
            activeOpacity={0.8}
          >
            {(isSyncing || isSyncingLokaal) ? (
              <ActivityIndicator size="small" color="#0A0A0A" />
            ) : (
              <Feather name="refresh-cw" size={16} color="#0A0A0A" />
            )}
            <Text style={stijlen.syncAllKnopTekst}>
              {(isSyncing || isSyncingLokaal) ? 'Synchroniseren...' : 'Alles synchroniseren'}
            </Text>
          </TouchableOpacity>

          {heeftCompleted && (
            <TouchableOpacity
              style={stijlen.opruimenKnop}
              onPress={onClearCompleted}
              activeOpacity={0.7}
            >
              <Text style={stijlen.opruimenKnopTekst}>Voltooide wissen</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={stijlen.paneelLijst} showsVerticalScrollIndicator={false}>
          {/* Wachtend/Uploaden */}
          {pendingItems.length > 0 && (
            <>
              <Text style={stijlen.groepLabel}>
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
              <Text style={[stijlen.groepLabel, { color: '#EF4444' }]}>
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
              <Text style={[stijlen.groepLabel, { color: '#4ADE80' }]}>
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
              <Feather name="check-circle" size={40} color="#4ADE80" />
              <Text style={stijlen.leegPaneelTekst}>Alles gesynchroniseerd</Text>
              <Text style={stijlen.leegPaneelOndertitel}>
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

  const config = bepaalStatusConfig(modus, pendingCount);

  // Animatie voor de balk (subtiele puls bij 'wachtend')
  const schaal = useSharedValue(1);
  const geanimeerdeStijl = useAnimatedStyle(() => ({
    transform: [{ scale: schaal.value }],
  }));

  useEffect(() => {
    if (modus === 'wachtend') {
      schaal.value = withSpring(1.01, { damping: 8 }, () => {
        schaal.value = withSpring(1);
      });
    }
  }, [modus, schaal]);

  return (
    <>
      <Animated.View style={geanimeerdeStijl}>
        <TouchableOpacity
          style={[
            stijlen.statusBalk,
            {
              backgroundColor: config.achtergrond,
              borderBottomColor: config.rand,
            },
          ]}
          onPress={() => setDetailZichtbaar(true)}
          activeOpacity={0.85}
        >
          {/* Icoon / spinner */}
          {modus === 'bezig' ? (
            <ActivityIndicator size="small" color={config.tekstKleur} />
          ) : (
            <Feather
              name={config.icoon as 'check-circle'}
              size={14}
              color={config.tekstKleur}
            />
          )}

          {/* Bericht */}
          <Text style={[stijlen.statusBalkTekst, { color: config.tekstKleur }]}>
            {config.bericht}
          </Text>

          {/* Pijl rechts */}
          {(pendingCount > 0 || queue.length > 0) && (
            <Feather name="chevron-right" size={14} color={config.tekstKleur} style={{ opacity: 0.7 }} />
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
// STIJLEN
// ============================================

const stijlen = StyleSheet.create({
  // Status-balk
  statusBalk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  statusBalkTekst: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Detail-paneel
  paneelContainer: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  paneelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  paneelTitel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#E8E8E8',
  },
  paneelActies: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  syncAllKnop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4ADE80',
  },
  syncAllKnopDisabled: {
    opacity: 0.6,
  },
  syncAllKnopTekst: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  opruimenKnop: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
    justifyContent: 'center',
  },
  opruimenKnopTekst: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },

  paneelLijst: {
    flex: 1,
    padding: 16,
  },
  groepLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    borderBottomColor: '#222',
  },
  queueItemIcoonContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
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
  queueItemType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E8E8E8',
  },
  queueItemStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  queueItemStatusTekst: {
    fontSize: 11,
    fontWeight: '600',
  },
  queueItemDatum: {
    fontSize: 12,
    color: '#888',
  },
  queueItemFout: {
    fontSize: 11,
    color: '#EF4444',
    fontStyle: 'italic',
  },
  queueItemRetry: {
    fontSize: 11,
    color: '#888',
  },
  queueItemVerwijder: {
    padding: 4,
    flexShrink: 0,
  },

  // Lege staat
  leegPaneel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  leegPaneelTekst: {
    fontSize: 17,
    fontWeight: '700',
    color: '#E8E8E8',
  },
  leegPaneelOndertitel: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});
