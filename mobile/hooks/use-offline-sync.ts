/**
 * Offline Sync Hooks voor Top Tuinen Mobile App
 *
 * React hooks voor het monitoren en beheren van offline sync status.
 * Gebaseerd op het research document: SQLITE-SYNC-RESEARCH.md
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  SyncEngine,
  SyncState,
  SyncQueueItem,
  initDatabase,
  getDatabase,
} from '@/lib/storage';

// ============================================
// SYNC ENGINE SINGLETON
// ============================================

let syncEngineInstance: SyncEngine | null = null;
let initPromise: Promise<SyncEngine> | null = null;

/**
 * Initialize the sync engine singleton.
 * Safe to call multiple times - will only initialize once.
 */
async function getSyncEngine(): Promise<SyncEngine> {
  if (syncEngineInstance) {
    return syncEngineInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const db = await initDatabase();
    const engine = new SyncEngine(db);
    await engine.initialize();
    syncEngineInstance = engine;
    return engine;
  })();

  return initPromise;
}

// ============================================
// HOOKS
// ============================================

/**
 * Hook voor sync status monitoring.
 * Geeft real-time updates over de sync state.
 */
export function useSyncStatus() {
  const [state, setState] = useState<SyncState>({
    isOnline: true,
    isSyncing: false,
    lastSyncAt: null,
    pendingCount: 0,
    errorCount: 0,
  });
  const [isReady, setIsReady] = useState(false);
  const engineRef = useRef<SyncEngine | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const engine = await getSyncEngine();

        if (!mounted) return;

        engineRef.current = engine;

        // Set up state change listener
        engine.setOnStateChange((newState) => {
          if (mounted) {
            setState(newState);
          }
        });

        // Get initial state
        const initialState = await engine.getState();
        if (mounted) {
          setState(initialState);
          setIsReady(true);
        }
      } catch (error) {
        console.error('[useSyncStatus] Failed to initialize:', error);
      }
    };

    init();

    // Poll for state updates (backup for missed events)
    const interval = setInterval(async () => {
      if (engineRef.current && mounted) {
        const newState = await engineRef.current.getState();
        setState(newState);
      }
    }, 10000); // Every 10 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const forceSync = useCallback(async () => {
    if (!engineRef.current) {
      throw new Error('SyncEngine not initialized');
    }
    return engineRef.current.processSyncQueue();
  }, []);

  const retryItem = useCallback(async (itemId: string) => {
    if (!engineRef.current) {
      throw new Error('SyncEngine not initialized');
    }
    return engineRef.current.retryItem(itemId);
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    if (!engineRef.current) {
      throw new Error('SyncEngine not initialized');
    }
    return engineRef.current.removeItem(itemId);
  }, []);

  return {
    ...state,
    isReady,
    forceSync,
    retryItem,
    removeItem,
  };
}

/**
 * Hook voor het aantal pending sync items.
 * Lightweight hook voor UI indicators.
 */
export function usePendingCount() {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const engineRef = useRef<SyncEngine | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const engine = await getSyncEngine();

        if (!mounted) return;

        engineRef.current = engine;

        // Set up state change listener
        engine.setOnStateChange((state) => {
          if (mounted) {
            setCount(state.pendingCount);
          }
        });

        // Get initial count
        const initialCount = await engine.getPendingCount();
        if (mounted) {
          setCount(initialCount);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[usePendingCount] Failed to initialize:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  return { count, isLoading };
}

/**
 * Hook voor het ophalen van failed sync items.
 * Nuttig voor het tonen van een error list aan de gebruiker.
 */
export function useFailedSyncItems() {
  const [items, setItems] = useState<SyncQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const engineRef = useRef<SyncEngine | null>(null);

  const refresh = useCallback(async () => {
    if (!engineRef.current) return;

    setIsLoading(true);
    try {
      const failedItems = await engineRef.current.getFailedItems();
      setItems(failedItems);
    } catch (error) {
      console.error('[useFailedSyncItems] Failed to load items:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const engine = await getSyncEngine();

        if (!mounted) return;

        engineRef.current = engine;

        // Load initial items
        const failedItems = await engine.getFailedItems();
        if (mounted) {
          setItems(failedItems);
          setIsLoading(false);
        }

        // Refresh when state changes
        engine.setOnStateChange(() => {
          if (mounted) {
            refresh();
          }
        });
      } catch (error) {
        console.error('[useFailedSyncItems] Failed to initialize:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [refresh]);

  const retryItem = useCallback(
    async (itemId: string) => {
      if (!engineRef.current) {
        throw new Error('SyncEngine not initialized');
      }
      await engineRef.current.retryItem(itemId);
      await refresh();
    },
    [refresh]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!engineRef.current) {
        throw new Error('SyncEngine not initialized');
      }
      await engineRef.current.removeItem(itemId);
      await refresh();
    },
    [refresh]
  );

  const retryAll = useCallback(async () => {
    if (!engineRef.current) {
      throw new Error('SyncEngine not initialized');
    }

    for (const item of items) {
      await engineRef.current.retryItem(item.id);
    }

    await refresh();
  }, [items, refresh]);

  return {
    items,
    isLoading,
    refresh,
    retryItem,
    removeItem,
    retryAll,
    hasErrors: items.length > 0,
  };
}

/**
 * Hook voor het toevoegen van items aan de sync queue.
 * Gebruik dit voor custom sync operations.
 */
export function useSyncQueue() {
  const engineRef = useRef<SyncEngine | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const engine = await getSyncEngine();

        if (!mounted) return;

        engineRef.current = engine;
        setIsReady(true);
      } catch (error) {
        console.error('[useSyncQueue] Failed to initialize:', error);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const addToQueue = useCallback(
    async (
      tableName: string,
      operation: 'INSERT' | 'UPDATE' | 'DELETE',
      recordId: string,
      payload: object,
      priority: number = 0
    ) => {
      if (!engineRef.current) {
        throw new Error('SyncEngine not initialized');
      }

      return engineRef.current.addToSyncQueue(
        tableName,
        operation,
        recordId,
        payload,
        priority
      );
    },
    []
  );

  const registerHandler = useCallback(
    (
      tableName: string,
      handler: (
        item: SyncQueueItem
      ) => Promise<{ serverId?: string; error?: string }>
    ) => {
      if (!engineRef.current) {
        throw new Error('SyncEngine not initialized');
      }

      engineRef.current.registerHandler(tableName, handler);
    },
    []
  );

  return {
    isReady,
    addToQueue,
    registerHandler,
  };
}

/**
 * Hook voor network status.
 * Simpele hook voor UI indicators.
 */
export function useNetworkStatus() {
  const { isOnline, isReady } = useSyncStatus();

  return {
    isOnline,
    isOffline: !isOnline,
    isReady,
  };
}
