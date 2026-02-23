/**
 * useOfflineQueue Hook — Top Tuinen Mobile App
 *
 * Hook voor het beheren van een persistente offline upload-wachtrij.
 * Items worden opgeslagen in AsyncStorage en foto's worden lokaal
 * bewaard via expo-file-system. Automatische sync bij netwerkherstel.
 *
 * VEREISTE INSTALLATIES (nog niet in package.json):
 *   expo install expo-file-system
 *
 * Reeds aanwezige packages gebruikt:
 *   - @react-native-async-storage/async-storage
 *   - @react-native-community/netinfo
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';

// ============================================
// TYPES
// ============================================

export type QueueItemType = 'foto' | 'opname' | 'aanvraag';
export type QueueItemStatus = 'pending' | 'uploading' | 'completed' | 'failed';

export interface QueueItem {
  id: string;
  type: QueueItemType;
  data: unknown;
  createdAt: number;
  status: QueueItemStatus;
  retryCount: number;
  /** Tijdstip van de volgende retry-poging (ms epoch) */
  nextRetryAt?: number;
  /** Foutmelding van de laatste mislukte poging */
  lastError?: string;
}

export type UploadHandler = (item: QueueItem) => Promise<void>;

export interface UseOfflineQueueReturn {
  addToQueue: (item: Omit<QueueItem, 'id' | 'status' | 'retryCount'>) => Promise<string>;
  queue: QueueItem[];
  pendingCount: number;
  syncAll: () => Promise<void>;
  isSyncing: boolean;
  removeFromQueue: (id: string) => void;
  clearCompleted: () => void;
  registerUploadHandler: (type: QueueItemType, handler: UploadHandler) => void;
}

// ============================================
// CONSTANTEN
// ============================================

const STORAGE_SLEUTEL = '@toptuinen:offline_queue';
const MAX_RETRIES = 3;

/** Basisvertraging voor exponential backoff in milliseconden */
const RETRY_BASIS_MS = 30_000; // 30 seconden

/** Maximale vertraging bij exponential backoff */
const RETRY_MAX_MS = 600_000; // 10 minuten

// ============================================
// INTERNE HELPERS
// ============================================

/**
 * Genereert een eenvoudige unieke ID zonder externe afhankelijkheid.
 */
function genereerId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Berekent de vertraging (ms) voor een volgende retry-poging
 * op basis van exponential backoff met jitter.
 */
function berekenRetryVertraging(retryCount: number): number {
  const exponentiele = RETRY_BASIS_MS * Math.pow(2, retryCount);
  const gejitter = exponentiele * (0.75 + Math.random() * 0.5);
  return Math.min(gejitter, RETRY_MAX_MS);
}

/**
 * Laadt de queue uit AsyncStorage.
 * Retourneert een lege array als er geen data is of de data corrupt is.
 */
async function laadQueue(): Promise<QueueItem[]> {
  try {
    const opgeslagen = await AsyncStorage.getItem(STORAGE_SLEUTEL);
    if (opgeslagen === null) return [];
    const parsed: unknown = JSON.parse(opgeslagen);
    if (!Array.isArray(parsed)) return [];
    return parsed as QueueItem[];
  } catch {
    return [];
  }
}

/**
 * Slaat de queue op in AsyncStorage.
 */
async function slaQueueOp(queue: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_SLEUTEL, JSON.stringify(queue));
}

/**
 * Als een queue-item een lokale bestandslocatie als data bevat,
 * verwijder dan dat bestand van het apparaat na succesvolle upload.
 */
async function ruimLokaalBestandOp(item: QueueItem): Promise<void> {
  if (item.type !== 'foto') return;

  try {
    const data = item.data as Record<string, unknown>;
    const lokaalUri = data.lokaalUri;
    if (typeof lokaalUri === 'string' && lokaalUri.startsWith(FileSystem.documentDirectory ?? '')) {
      const info = await FileSystem.getInfoAsync(lokaalUri);
      if (info.exists) {
        await FileSystem.deleteAsync(lokaalUri, { idempotent: true });
      }
    }
  } catch {
    // Opruimen mislukken is niet fataal — negeer stille fouten
  }
}

// ============================================
// HOOK
// ============================================

/**
 * useOfflineQueue
 *
 * Beheert een persistente offline upload-wachtrij met:
 * - AsyncStorage persistentie (overleeft app restarts)
 * - Automatische sync bij netwerkherstel
 * - Exponential backoff retry-logica (max 3 pogingen)
 * - Pluggable upload-handlers per item-type
 *
 * @example
 * const { addToQueue, queue, syncAll, registerUploadHandler } = useOfflineQueue();
 *
 * // Registreer een handler voor foto-uploads
 * registerUploadHandler('foto', async (item) => {
 *   await uploadFotoNaarServer(item.data);
 * });
 *
 * // Voeg een item toe
 * await addToQueue({ type: 'foto', data: { uri: '...' }, createdAt: Date.now() });
 */
export function useOfflineQueue(): UseOfflineQueueReturn {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Handlers worden buiten state gehouden om re-renders te vermijden
  const handlersRef = useRef<Map<QueueItemType, UploadHandler>>(new Map());
  const syncBezig = useRef(false);

  // ----------------------------------------
  // Queue laden bij opstarten
  // ----------------------------------------
  useEffect(() => {
    let gemount = true;

    const initialiseer = async () => {
      const opgeslagenQueue = await laadQueue();
      if (!gemount) return;

      // Reset 'uploading' statussen naar 'pending' (app was afgesloten tijdens upload)
      const hersteld = opgeslagenQueue.map((item): QueueItem =>
        item.status === 'uploading'
          ? { ...item, status: 'pending' }
          : item
      );

      setQueue(hersteld);
    };

    initialiseer();
    return () => { gemount = false; };
  }, []);

  // ----------------------------------------
  // Automatische sync bij netwerkherstel
  // ----------------------------------------
  useEffect(() => {
    const afmelden = NetInfo.addEventListener((staat) => {
      const isOnline = staat.isConnected === true && staat.isInternetReachable !== false;
      if (isOnline) {
        // Wacht kort om het netwerk te laten stabiliseren
        setTimeout(() => {
          syncAllIntern();
        }, 2000);
      }
    });

    return () => afmelden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------
  // Interne helpers met queue-toegang
  // ----------------------------------------

  /**
   * Werkt de queue bij in state en slaat deze op in AsyncStorage.
   * Accepteert zowel een nieuwe array als een update-functie.
   */
  const updateQueue = useCallback(async (
    bijwerker: QueueItem[] | ((vorige: QueueItem[]) => QueueItem[])
  ): Promise<QueueItem[]> => {
    return new Promise((resolve) => {
      setQueue((vorige) => {
        const nieuw = typeof bijwerker === 'function' ? bijwerker(vorige) : bijwerker;
        // AsyncStorage-schrijf buiten de setState om te houden
        slaQueueOp(nieuw).catch((err) => {
          console.error('[useOfflineQueue] Opslaan mislukt:', err);
        });
        resolve(nieuw);
        return nieuw;
      });
    });
  }, []);

  /**
   * Synchroniseert alle pending (en herroepbare failed) items.
   * Veilig om meerdere keren aan te roepen — blokkeert dubbele runs.
   */
  const syncAllIntern = useCallback(async (): Promise<void> => {
    if (syncBezig.current) return;

    const netInfo = await NetInfo.fetch();
    const isOnline = netInfo.isConnected === true && netInfo.isInternetReachable !== false;
    if (!isOnline) return;

    syncBezig.current = true;
    setIsSyncing(true);

    try {
      // Snapshot van de huidige queue
      let huidigeQueue = await laadQueue();

      const nu = Date.now();
      const teVerwerken = huidigeQueue.filter(
        (item) =>
          item.status === 'pending' ||
          (item.status === 'failed' &&
            item.retryCount < MAX_RETRIES &&
            (item.nextRetryAt === undefined || item.nextRetryAt <= nu))
      );

      for (const item of teVerwerken) {
        const handler = handlersRef.current.get(item.type);
        if (!handler) {
          // Geen handler geregistreerd — sla over
          continue;
        }

        // Markeer als 'uploading'
        huidigeQueue = huidigeQueue.map((q): QueueItem =>
          q.id === item.id ? { ...q, status: 'uploading' } : q
        );
        await slaQueueOp(huidigeQueue);
        setQueue([...huidigeQueue]);

        try {
          await handler(item);

          // Succesvolle upload
          huidigeQueue = huidigeQueue.map((q): QueueItem =>
            q.id === item.id ? { ...q, status: 'completed' } : q
          );
          await ruimLokaalBestandOp(item);
        } catch (err) {
          const foutmelding = err instanceof Error ? err.message : 'Onbekende uploadfout';
          const nieuweRetryCount = item.retryCount + 1;
          const vertraging = berekenRetryVertraging(nieuweRetryCount);

          huidigeQueue = huidigeQueue.map((q): QueueItem =>
            q.id === item.id
              ? {
                  ...q,
                  status: nieuweRetryCount >= MAX_RETRIES ? 'failed' : 'pending',
                  retryCount: nieuweRetryCount,
                  lastError: foutmelding,
                  nextRetryAt: Date.now() + vertraging,
                }
              : q
          );

          console.warn(
            `[useOfflineQueue] Upload mislukt (poging ${nieuweRetryCount}/${MAX_RETRIES}):`,
            foutmelding
          );
        }

        await slaQueueOp(huidigeQueue);
        setQueue([...huidigeQueue]);
      }
    } finally {
      syncBezig.current = false;
      setIsSyncing(false);
    }
  }, []);

  // ----------------------------------------
  // Publieke API
  // ----------------------------------------

  const addToQueue = useCallback(async (
    item: Omit<QueueItem, 'id' | 'status' | 'retryCount'>
  ): Promise<string> => {
    const id = genereerId();
    const nieuwItem: QueueItem = {
      ...item,
      id,
      status: 'pending',
      retryCount: 0,
    };

    await updateQueue((vorige) => [...vorige, nieuwItem]);

    // Probeer direct te synchroniseren als online
    syncAllIntern();

    return id;
  }, [updateQueue, syncAllIntern]);

  const syncAll = useCallback(async (): Promise<void> => {
    await syncAllIntern();
  }, [syncAllIntern]);

  const removeFromQueue = useCallback((id: string): void => {
    updateQueue((vorige) => vorige.filter((item) => item.id !== id));
  }, [updateQueue]);

  const clearCompleted = useCallback((): void => {
    updateQueue((vorige) =>
      vorige.filter((item) => item.status !== 'completed')
    );
  }, [updateQueue]);

  const registerUploadHandler = useCallback((
    type: QueueItemType,
    handler: UploadHandler
  ): void => {
    handlersRef.current.set(type, handler);
  }, []);

  const pendingCount = queue.filter(
    (item) => item.status === 'pending' || item.status === 'uploading'
  ).length;

  return {
    addToQueue,
    queue,
    pendingCount,
    syncAll,
    isSyncing,
    removeFromQueue,
    clearCompleted,
    registerUploadHandler,
  };
}

export default useOfflineQueue;
