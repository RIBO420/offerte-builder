# SQLite Offline Sync Research

**Versie:** 1.0
**Datum:** 2026-02-01
**Task:** #10 Research SQLite offline sync patterns

---

## Inhoudsopgave

1. [Executive Summary](#1-executive-summary)
2. [SQLite Schema Design](#2-sqlite-schema-design)
3. [Sync Engine Architecture](#3-sync-engine-architecture)
4. [Idempotency Key Strategie](#4-idempotency-key-strategie)
5. [Conflict Resolution Patronen](#5-conflict-resolution-patronen)
6. [Background Sync met Expo](#6-background-sync-met-expo)
7. [Battery-Aware Sync Scheduling](#7-battery-aware-sync-scheduling)
8. [Performance Optimalisaties](#8-performance-optimalisaties)
9. [Implementatie Aanbevelingen](#9-implementatie-aanbevelingen)
10. [Bronnen](#10-bronnen)

---

## 1. Executive Summary

Dit document beschrijft de research voor offline sync patterns met expo-sqlite voor de Top Tuinen Medewerkers App. De kernprincipes zijn:

- **SQLite als Single Source of Truth**: De lokale database is altijd leidend; netwerk sync blokkeert nooit de UI
- **Outbox Pattern**: Elke mutatie wordt eerst lokaal opgeslagen in een sync queue
- **Idempotency Keys**: UUID v7 voor deduplicatie en ordering
- **Last-Write-Wins**: Eenvoudige conflict resolution met client timestamps
- **Battery-Aware Scheduling**: Adaptive sync intervals op basis van batterijstatus

---

## 2. SQLite Schema Design

### 2.1 Database Initialisatie

Expo SQLite ondersteunt database migraties via de `onInit` callback in `SQLiteProvider`. We gebruiken `PRAGMA user_version` om de huidige versie te tracken.

```typescript
// lib/storage/database.ts

import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 1;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // Check current version
  const { user_version: currentVersion } = await db.getFirstAsync<{
    user_version: number
  }>('PRAGMA user_version');

  if (currentVersion >= DATABASE_VERSION) {
    return; // Already up to date
  }

  // Enable WAL mode for better performance
  await db.execAsync(`PRAGMA journal_mode = 'wal'`);

  // Version 0 -> 1: Initial schema
  if (currentVersion === 0) {
    await db.execAsync(`
      -- Uren registraties (lokale cache + pending syncs)
      CREATE TABLE IF NOT EXISTS uren_registraties (
        id TEXT PRIMARY KEY,
        server_id TEXT,
        project_id TEXT NOT NULL,
        project_naam TEXT,
        datum TEXT NOT NULL,
        medewerker TEXT NOT NULL,
        medewerker_clerk_id TEXT,
        uren REAL NOT NULL,
        scope TEXT,
        notities TEXT,

        -- Sync metadata
        sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced', 'error', 'conflict')),
        idempotency_key TEXT UNIQUE NOT NULL,
        client_timestamp INTEGER NOT NULL,
        server_timestamp INTEGER,
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,

        -- Timestamps
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Sync queue (outbox pattern)
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        operation TEXT NOT NULL CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')),
        record_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        idempotency_key TEXT UNIQUE NOT NULL,

        -- Status tracking
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
        priority INTEGER DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        last_error TEXT,

        -- Timestamps
        created_at INTEGER NOT NULL,
        processed_at INTEGER,

        -- Ordering
        sequence_number INTEGER
      );

      -- Location cache (GPS data buffer)
      CREATE TABLE IF NOT EXISTS location_cache (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL NOT NULL,
        altitude REAL,
        speed REAL,
        heading REAL,
        battery_level REAL,

        -- Sync metadata
        sync_status TEXT DEFAULT 'pending',
        idempotency_key TEXT UNIQUE NOT NULL,
        recorded_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      -- Offline metadata (last sync times, cursors, etc.)
      CREATE TABLE IF NOT EXISTS offline_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Server data cache (projecten, klanten, etc.)
      CREATE TABLE IF NOT EXISTS cached_projects (
        id TEXT PRIMARY KEY,
        server_id TEXT UNIQUE NOT NULL,
        data TEXT NOT NULL,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_uren_sync_status ON uren_registraties(sync_status);
      CREATE INDEX IF NOT EXISTS idx_uren_datum ON uren_registraties(datum);
      CREATE INDEX IF NOT EXISTS idx_uren_project ON uren_registraties(project_id);
      CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue(status, priority DESC, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_queue_pending ON sync_queue(status) WHERE status = 'pending';
      CREATE INDEX IF NOT EXISTS idx_location_sync ON location_cache(sync_status);
      CREATE INDEX IF NOT EXISTS idx_location_session ON location_cache(session_id);
    `);
  }

  // Future migrations
  // if (currentVersion === 1) {
  //   await db.execAsync(`ALTER TABLE ... ADD COLUMN ...`);
  // }

  // Update version
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
```

### 2.2 Database Provider Setup

```typescript
// app/_layout.tsx

import { SQLiteProvider } from 'expo-sqlite';
import { migrateDbIfNeeded } from '@/lib/storage/database';

export default function RootLayout() {
  return (
    <SQLiteProvider
      databaseName="toptuinen.db"
      onInit={migrateDbIfNeeded}
    >
      {/* Rest of app */}
    </SQLiteProvider>
  );
}
```

### 2.3 Schema Considerations

| Kolom | Type | Doel |
|-------|------|------|
| `id` | TEXT | Client-generated UUID v7 |
| `server_id` | TEXT | Convex document ID na sync |
| `idempotency_key` | TEXT UNIQUE | Deduplicatie op server |
| `sync_status` | TEXT | pending/synced/error/conflict |
| `client_timestamp` | INTEGER | Unix ms voor conflict resolution |
| `retry_count` | INTEGER | Exponential backoff tracking |

---

## 3. Sync Engine Architecture

### 3.1 Core Sync Engine Class

```typescript
// lib/sync/sync-engine.ts

import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { ConvexReactClient } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { generateIdempotencyKey } from './idempotency';
import { BatteryAwareScheduler } from './battery-scheduler';

const SYNC_TASK_NAME = 'TOP_TUINEN_BACKGROUND_SYNC';
const MAX_BATCH_SIZE = 20;
const MAX_RETRIES = 3;

export interface SyncConfig {
  minSyncInterval: number;      // Minimum seconds between syncs
  maxBatchSize: number;         // Max items per sync batch
  retryDelayBase: number;       // Base delay for exponential backoff (ms)
  maxRetries: number;           // Max retry attempts per item
  enableBackgroundSync: boolean;
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: number | null;
  pendingCount: number;
  errorCount: number;
}

export class SyncEngine {
  private db: SQLiteDatabase;
  private convex: ConvexReactClient;
  private config: SyncConfig;
  private state: SyncState;
  private syncLock: boolean = false;
  private networkSubscription: (() => void) | null = null;
  private batteryScheduler: BatteryAwareScheduler;

  constructor(
    db: SQLiteDatabase,
    convex: ConvexReactClient,
    config: Partial<SyncConfig> = {}
  ) {
    this.db = db;
    this.convex = convex;
    this.config = {
      minSyncInterval: 30,
      maxBatchSize: MAX_BATCH_SIZE,
      retryDelayBase: 1000,
      maxRetries: MAX_RETRIES,
      enableBackgroundSync: true,
      ...config,
    };
    this.state = {
      isOnline: true,
      isSyncing: false,
      lastSyncAt: null,
      pendingCount: 0,
      errorCount: 0,
    };
    this.batteryScheduler = new BatteryAwareScheduler();
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async initialize(): Promise<void> {
    // Setup network listener
    this.networkSubscription = NetInfo.addEventListener(
      this.handleNetworkChange.bind(this)
    );

    // Get initial network state
    const netState = await NetInfo.fetch();
    this.state.isOnline = netState.isConnected ?? false;

    // Register background task
    if (this.config.enableBackgroundSync) {
      await this.registerBackgroundTask();
    }

    // Load pending counts
    await this.updatePendingCounts();

    // Initial sync if online
    if (this.state.isOnline) {
      this.triggerSync();
    }
  }

  async cleanup(): Promise<void> {
    if (this.networkSubscription) {
      this.networkSubscription();
      this.networkSubscription = null;
    }
    if (this.config.enableBackgroundSync) {
      await BackgroundFetch.unregisterTaskAsync(SYNC_TASK_NAME);
    }
  }

  // ============================================
  // NETWORK HANDLING
  // ============================================

  private handleNetworkChange(state: NetInfoState): void {
    const wasOffline = !this.state.isOnline;
    this.state.isOnline = state.isConnected ?? false;

    // Came back online - trigger sync
    if (wasOffline && this.state.isOnline) {
      console.log('[SyncEngine] Network restored, triggering sync');
      this.triggerSync();
    }
  }

  // ============================================
  // LOCAL OPERATIONS (Write to SQLite first)
  // ============================================

  async addUrenRegistratie(entry: {
    projectId: string;
    projectNaam?: string;
    datum: string;
    medewerker: string;
    medewerkerClerkId?: string;
    uren: number;
    scope?: string;
    notities?: string;
  }): Promise<string> {
    const id = generateIdempotencyKey(); // UUID v7
    const idempotencyKey = generateIdempotencyKey();
    const now = Date.now();

    // Insert into local database
    await this.db.runAsync(
      `INSERT INTO uren_registraties (
        id, project_id, project_naam, datum, medewerker, medewerker_clerk_id,
        uren, scope, notities, sync_status, idempotency_key,
        client_timestamp, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [
        id,
        entry.projectId,
        entry.projectNaam ?? null,
        entry.datum,
        entry.medewerker,
        entry.medewerkerClerkId ?? null,
        entry.uren,
        entry.scope ?? null,
        entry.notities ?? null,
        idempotencyKey,
        now,
        now,
        now,
      ]
    );

    // Add to sync queue
    await this.addToSyncQueue('uren_registraties', 'INSERT', id, {
      ...entry,
      idempotencyKey,
      clientTimestamp: now,
    });

    // Update counts
    await this.updatePendingCounts();

    // Trigger sync if online
    if (this.state.isOnline) {
      this.triggerSync();
    }

    return id;
  }

  async updateUrenRegistratie(
    id: string,
    updates: Partial<{
      uren: number;
      scope: string;
      notities: string;
    }>
  ): Promise<void> {
    const now = Date.now();
    const idempotencyKey = generateIdempotencyKey();

    // Get current record
    const current = await this.db.getFirstAsync<{ server_id: string | null }>(
      'SELECT server_id FROM uren_registraties WHERE id = ?',
      [id]
    );

    if (!current) {
      throw new Error(`Record not found: ${id}`);
    }

    // Update locally
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.uren !== undefined) {
      setClauses.push('uren = ?');
      values.push(updates.uren);
    }
    if (updates.scope !== undefined) {
      setClauses.push('scope = ?');
      values.push(updates.scope);
    }
    if (updates.notities !== undefined) {
      setClauses.push('notities = ?');
      values.push(updates.notities);
    }

    setClauses.push('sync_status = ?', 'updated_at = ?', 'client_timestamp = ?');
    values.push('pending', now, now, id);

    await this.db.runAsync(
      `UPDATE uren_registraties SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );

    // Add to sync queue
    await this.addToSyncQueue('uren_registraties', 'UPDATE', id, {
      serverId: current.server_id,
      updates,
      idempotencyKey,
      clientTimestamp: now,
    });

    await this.updatePendingCounts();

    if (this.state.isOnline) {
      this.triggerSync();
    }
  }

  async deleteUrenRegistratie(id: string): Promise<void> {
    const now = Date.now();
    const idempotencyKey = generateIdempotencyKey();

    // Get current record
    const current = await this.db.getFirstAsync<{
      server_id: string | null;
      sync_status: string;
    }>(
      'SELECT server_id, sync_status FROM uren_registraties WHERE id = ?',
      [id]
    );

    if (!current) {
      return; // Already deleted
    }

    // If never synced, just delete locally
    if (!current.server_id || current.sync_status === 'pending') {
      await this.db.runAsync(
        'DELETE FROM uren_registraties WHERE id = ?',
        [id]
      );
      // Remove any pending queue items
      await this.db.runAsync(
        'DELETE FROM sync_queue WHERE record_id = ?',
        [id]
      );
    } else {
      // Mark as deleted locally, queue delete for server
      await this.db.runAsync(
        `UPDATE uren_registraties
         SET sync_status = 'pending', updated_at = ?
         WHERE id = ?`,
        [now, id]
      );

      await this.addToSyncQueue('uren_registraties', 'DELETE', id, {
        serverId: current.server_id,
        idempotencyKey,
        clientTimestamp: now,
      });
    }

    await this.updatePendingCounts();

    if (this.state.isOnline) {
      this.triggerSync();
    }
  }

  // ============================================
  // SYNC QUEUE MANAGEMENT
  // ============================================

  private async addToSyncQueue(
    tableName: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    recordId: string,
    payload: object
  ): Promise<void> {
    const id = generateIdempotencyKey();
    const now = Date.now();

    // Get next sequence number
    const { maxSeq } = await this.db.getFirstAsync<{ maxSeq: number | null }>(
      'SELECT MAX(sequence_number) as maxSeq FROM sync_queue'
    ) ?? { maxSeq: 0 };

    await this.db.runAsync(
      `INSERT INTO sync_queue (
        id, table_name, operation, record_id, payload,
        idempotency_key, status, created_at, sequence_number
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id,
        tableName,
        operation,
        recordId,
        JSON.stringify(payload),
        (payload as any).idempotencyKey,
        now,
        (maxSeq ?? 0) + 1,
      ]
    );
  }

  // ============================================
  // SYNC EXECUTION
  // ============================================

  triggerSync(): void {
    // Debounce and async execute
    setTimeout(() => this.executeSync(), 100);
  }

  async executeSync(): Promise<SyncResult> {
    // Prevent concurrent syncs
    if (this.syncLock) {
      return { success: false, reason: 'sync_in_progress' };
    }

    if (!this.state.isOnline) {
      return { success: false, reason: 'offline' };
    }

    this.syncLock = true;
    this.state.isSyncing = true;

    try {
      // 1. Push local changes to server
      const pushResult = await this.pushChanges();

      // 2. Pull server changes (optional, based on app needs)
      // const pullResult = await this.pullChanges();

      // Update last sync time
      this.state.lastSyncAt = Date.now();
      await this.setMetadata('lastSyncAt', this.state.lastSyncAt.toString());

      return {
        success: true,
        pushed: pushResult.processed,
        errors: pushResult.errors,
      };
    } catch (error) {
      console.error('[SyncEngine] Sync failed:', error);
      return {
        success: false,
        reason: 'sync_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.syncLock = false;
      this.state.isSyncing = false;
      await this.updatePendingCounts();
    }
  }

  private async pushChanges(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    // Get pending items, ordered by sequence
    const pendingItems = await this.db.getAllAsync<SyncQueueItem>(
      `SELECT * FROM sync_queue
       WHERE status = 'pending' AND retry_count < ?
       ORDER BY sequence_number ASC
       LIMIT ?`,
      [this.config.maxRetries, this.config.maxBatchSize]
    );

    for (const item of pendingItems) {
      try {
        // Mark as processing
        await this.db.runAsync(
          `UPDATE sync_queue SET status = 'processing' WHERE id = ?`,
          [item.id]
        );

        // Process based on table and operation
        await this.processSyncItem(item);

        // Mark as completed
        await this.db.runAsync(
          `UPDATE sync_queue
           SET status = 'completed', processed_at = ?
           WHERE id = ?`,
          [Date.now(), item.id]
        );

        processed++;
      } catch (error) {
        errors++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Check if it's a conflict error
        const isConflict = errorMessage.includes('CONFLICT');

        // Increment retry count
        await this.db.runAsync(
          `UPDATE sync_queue
           SET status = ?, retry_count = retry_count + 1, last_error = ?
           WHERE id = ?`,
          [
            isConflict ? 'failed' : 'pending',
            errorMessage,
            item.id,
          ]
        );

        // Update source record status if max retries reached
        if (item.retry_count + 1 >= this.config.maxRetries || isConflict) {
          await this.db.runAsync(
            `UPDATE ${item.table_name}
             SET sync_status = ?, last_error = ?
             WHERE id = ?`,
            [isConflict ? 'conflict' : 'error', errorMessage, item.record_id]
          );
        }

        console.error(`[SyncEngine] Failed to sync item ${item.id}:`, errorMessage);
      }
    }

    // Cleanup old completed items (keep last 24 hours)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    await this.db.runAsync(
      `DELETE FROM sync_queue WHERE status = 'completed' AND processed_at < ?`,
      [cutoff]
    );

    return { processed, errors };
  }

  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    const payload = JSON.parse(item.payload);

    switch (item.table_name) {
      case 'uren_registraties':
        await this.syncUrenRegistratie(item.operation, item.record_id, payload);
        break;
      case 'location_cache':
        await this.syncLocationData(item.operation, item.record_id, payload);
        break;
      default:
        throw new Error(`Unknown table: ${item.table_name}`);
    }
  }

  private async syncUrenRegistratie(
    operation: string,
    recordId: string,
    payload: any
  ): Promise<void> {
    switch (operation) {
      case 'INSERT':
        // Call Convex mutation with idempotency key
        const serverId = await this.convex.mutation(
          api.urenRegistraties.addWithSync,
          {
            projectId: payload.projectId,
            datum: payload.datum,
            medewerker: payload.medewerker,
            medewerkerClerkId: payload.medewerkerClerkId,
            uren: payload.uren,
            scope: payload.scope,
            notities: payload.notities,
            idempotencyKey: payload.idempotencyKey,
            clientTimestamp: payload.clientTimestamp,
          }
        );

        // Update local record with server ID
        await this.db.runAsync(
          `UPDATE uren_registraties
           SET server_id = ?, sync_status = 'synced', server_timestamp = ?
           WHERE id = ?`,
          [serverId, Date.now(), recordId]
        );
        break;

      case 'UPDATE':
        await this.convex.mutation(api.urenRegistraties.updateWithSync, {
          id: payload.serverId,
          updates: payload.updates,
          idempotencyKey: payload.idempotencyKey,
          clientTimestamp: payload.clientTimestamp,
        });

        await this.db.runAsync(
          `UPDATE uren_registraties
           SET sync_status = 'synced', server_timestamp = ?
           WHERE id = ?`,
          [Date.now(), recordId]
        );
        break;

      case 'DELETE':
        await this.convex.mutation(api.urenRegistraties.deleteWithSync, {
          id: payload.serverId,
          idempotencyKey: payload.idempotencyKey,
        });

        // Remove from local database
        await this.db.runAsync(
          'DELETE FROM uren_registraties WHERE id = ?',
          [recordId]
        );
        break;
    }
  }

  private async syncLocationData(
    operation: string,
    recordId: string,
    payload: any
  ): Promise<void> {
    // Batch location syncs for efficiency
    // Implementation depends on location tracking requirements
  }

  // ============================================
  // BACKGROUND SYNC
  // ============================================

  private async registerBackgroundTask(): Promise<void> {
    // Define the task
    TaskManager.defineTask(SYNC_TASK_NAME, async () => {
      try {
        // Check battery level
        const shouldSync = await this.batteryScheduler.shouldSync();
        if (!shouldSync) {
          return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const result = await this.executeSync();

        return result.success
          ? BackgroundFetch.BackgroundFetchResult.NewData
          : BackgroundFetch.BackgroundFetchResult.Failed;
      } catch (error) {
        console.error('[SyncEngine] Background sync failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    // Register with system
    await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
      minimumInterval: this.config.minSyncInterval,
      stopOnTerminate: false,  // Android: continue after app close
      startOnBoot: true,       // Android: start on device boot
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  private async updatePendingCounts(): Promise<void> {
    const { pending } = await this.db.getFirstAsync<{ pending: number }>(
      `SELECT COUNT(*) as pending FROM uren_registraties WHERE sync_status = 'pending'`
    ) ?? { pending: 0 };

    const { errors } = await this.db.getFirstAsync<{ errors: number }>(
      `SELECT COUNT(*) as errors FROM uren_registraties WHERE sync_status = 'error'`
    ) ?? { errors: 0 };

    this.state.pendingCount = pending;
    this.state.errorCount = errors;
  }

  async getPendingCount(): Promise<number> {
    const result = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`
    );
    return result?.count ?? 0;
  }

  async getState(): Promise<SyncState> {
    await this.updatePendingCounts();
    return { ...this.state };
  }

  private async setMetadata(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO offline_metadata (key, value, updated_at)
       VALUES (?, ?, ?)`,
      [key, value, Date.now()]
    );
  }

  private async getMetadata(key: string): Promise<string | null> {
    const result = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM offline_metadata WHERE key = ?',
      [key]
    );
    return result?.value ?? null;
  }
}

// Types
interface SyncQueueItem {
  id: string;
  table_name: string;
  operation: string;
  record_id: string;
  payload: string;
  idempotency_key: string;
  status: string;
  retry_count: number;
  created_at: number;
  sequence_number: number;
}

interface SyncResult {
  success: boolean;
  reason?: string;
  error?: string;
  pushed?: number;
  errors?: number;
}
```

### 3.2 React Hook voor Sync Engine

```typescript
// hooks/use-sync-engine.ts

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useConvex } from 'convex/react';
import { SyncEngine, SyncState } from '@/lib/sync/sync-engine';

export function useSyncEngine() {
  const db = useSQLiteContext();
  const convex = useConvex();
  const engineRef = useRef<SyncEngine | null>(null);
  const [state, setState] = useState<SyncState>({
    isOnline: true,
    isSyncing: false,
    lastSyncAt: null,
    pendingCount: 0,
    errorCount: 0,
  });

  useEffect(() => {
    const engine = new SyncEngine(db, convex);
    engineRef.current = engine;

    engine.initialize().then(() => {
      engine.getState().then(setState);
    });

    // Poll for state updates
    const interval = setInterval(async () => {
      if (engineRef.current) {
        const newState = await engineRef.current.getState();
        setState(newState);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      engine.cleanup();
    };
  }, [db, convex]);

  const addUrenRegistratie = useCallback(
    async (entry: Parameters<SyncEngine['addUrenRegistratie']>[0]) => {
      if (!engineRef.current) throw new Error('SyncEngine not initialized');
      return engineRef.current.addUrenRegistratie(entry);
    },
    []
  );

  const updateUrenRegistratie = useCallback(
    async (id: string, updates: Parameters<SyncEngine['updateUrenRegistratie']>[1]) => {
      if (!engineRef.current) throw new Error('SyncEngine not initialized');
      return engineRef.current.updateUrenRegistratie(id, updates);
    },
    []
  );

  const deleteUrenRegistratie = useCallback(
    async (id: string) => {
      if (!engineRef.current) throw new Error('SyncEngine not initialized');
      return engineRef.current.deleteUrenRegistratie(id);
    },
    []
  );

  const forceSync = useCallback(async () => {
    if (!engineRef.current) throw new Error('SyncEngine not initialized');
    return engineRef.current.executeSync();
  }, []);

  return {
    state,
    addUrenRegistratie,
    updateUrenRegistratie,
    deleteUrenRegistratie,
    forceSync,
    isReady: engineRef.current !== null,
  };
}
```

---

## 4. Idempotency Key Strategie

### 4.1 UUID v7 Implementatie

UUID v7 is de aanbevolen keuze voor idempotency keys vanwege:

- **Timestamp component**: Eerste 48 bits bevatten millisecond timestamp
- **Sorteerbaar**: Chronologisch gesorteerd voor database performance
- **Uniek**: Random bits voorkomen collisions
- **Detecteerbaar**: Verouderde keys herkenbaar aan timestamp

```typescript
// lib/sync/idempotency.ts

/**
 * Generate UUID v7
 * Format: timestamp (48 bits) + version (4 bits) + random (12 bits) +
 *         variant (2 bits) + random (62 bits)
 */
export function generateIdempotencyKey(): string {
  const timestamp = Date.now();

  // Convert timestamp to hex (48 bits = 12 hex chars)
  const timestampHex = timestamp.toString(16).padStart(12, '0');

  // Generate random parts
  const randomA = Math.floor(Math.random() * 0xfff).toString(16).padStart(3, '0');
  const randomB = (Math.floor(Math.random() * 0x3fff) | 0x8000).toString(16).padStart(4, '0');
  const randomC = Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, '0');

  // Construct UUID v7
  // Format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
  return [
    timestampHex.slice(0, 8),
    timestampHex.slice(8, 12) + '7' + randomA.slice(0, 1),
    randomA.slice(1) + randomB.slice(0, 1),
    randomB.slice(1),
    randomC,
  ].join('-');
}

/**
 * Extract timestamp from UUID v7
 */
export function extractTimestamp(uuidV7: string): number {
  const hex = uuidV7.replace(/-/g, '').slice(0, 12);
  return parseInt(hex, 16);
}

/**
 * Check if idempotency key is expired
 * Default window: 24 hours
 */
export function isIdempotencyKeyExpired(
  key: string,
  windowMs: number = 24 * 60 * 60 * 1000
): boolean {
  try {
    const timestamp = extractTimestamp(key);
    return Date.now() - timestamp > windowMs;
  } catch {
    return true; // Invalid key = expired
  }
}

/**
 * Validate idempotency key format
 */
export function isValidIdempotencyKey(key: string): boolean {
  const uuidV7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV7Regex.test(key);
}
```

### 4.2 Server-Side Idempotency Check

```typescript
// convex/urenRegistraties.ts

import { mutation } from './_generated/server';
import { v } from 'convex/values';

export const addWithSync = mutation({
  args: {
    projectId: v.id('projecten'),
    datum: v.string(),
    medewerker: v.string(),
    medewerkerClerkId: v.optional(v.string()),
    uren: v.number(),
    scope: v.optional(v.string()),
    notities: v.optional(v.string()),
    idempotencyKey: v.string(),
    clientTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Check for existing idempotency key (deduplication)
    const existing = await ctx.db
      .query('urenRegistraties')
      .withIndex('by_idempotency', (q) => q.eq('idempotencyKey', args.idempotencyKey))
      .first();

    if (existing) {
      // Duplicate request - return existing ID (idempotent response)
      console.log(`[Idempotency] Duplicate request detected: ${args.idempotencyKey}`);
      return existing._id;
    }

    // 2. Validate idempotency key age (optional, prevent replay attacks)
    const keyAge = Date.now() - extractTimestampFromKey(args.idempotencyKey);
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (keyAge > maxAge) {
      throw new Error('Idempotency key expired');
    }

    // 3. Insert new record
    const id = await ctx.db.insert('urenRegistraties', {
      projectId: args.projectId,
      datum: args.datum,
      medewerker: args.medewerker,
      medewerkerClerkId: args.medewerkerClerkId,
      uren: args.uren,
      scope: args.scope,
      notities: args.notities,
      bron: 'app',
      idempotencyKey: args.idempotencyKey,
      clientTimestamp: args.clientTimestamp,
      syncStatus: 'synced',
    });

    return id;
  },
});

function extractTimestampFromKey(key: string): number {
  try {
    const hex = key.replace(/-/g, '').slice(0, 12);
    return parseInt(hex, 16);
  } catch {
    return 0;
  }
}
```

### 4.3 Idempotency Best Practices

| Practice | Beschrijving |
|----------|--------------|
| **Unique per operation** | Elke actie krijgt een nieuwe key |
| **Scope per user** | Keys zijn uniek binnen user context |
| **Time window** | Keys verlopen na 24-168 uur |
| **Database constraint** | UNIQUE constraint op idempotency_key |
| **Atomic check** | Check + insert in 1 transaction |

---

## 5. Conflict Resolution Patronen

### 5.1 Last-Write-Wins (LWW) Strategie

Voor de Top Tuinen app kiezen we Last-Write-Wins als primaire conflict resolution strategie vanwege:

- **Eenvoud**: Simpel te implementeren en debuggen
- **Voorspelbaarheid**: Gebruikers begrijpen "nieuwste wint"
- **Performance**: Geen merge logic overhead
- **Use case fit**: Urenregistraties zijn single-user entries

```typescript
// lib/sync/conflict-resolution.ts

export interface ConflictResolutionResult {
  winner: 'client' | 'server';
  resolvedData: any;
  conflictDetails?: {
    clientTimestamp: number;
    serverTimestamp: number;
    clientData: any;
    serverData: any;
  };
}

/**
 * Last-Write-Wins conflict resolution
 * Compares client_timestamp to determine winner
 */
export function resolveConflictLWW(
  clientData: { clientTimestamp: number; data: any },
  serverData: { clientTimestamp: number; data: any }
): ConflictResolutionResult {
  const clientWins = clientData.clientTimestamp > serverData.clientTimestamp;

  return {
    winner: clientWins ? 'client' : 'server',
    resolvedData: clientWins ? clientData.data : serverData.data,
    conflictDetails: {
      clientTimestamp: clientData.clientTimestamp,
      serverTimestamp: serverData.clientTimestamp,
      clientData: clientData.data,
      serverData: serverData.data,
    },
  };
}

/**
 * Field-level merge for partial updates
 * Merges non-conflicting fields, LWW for conflicts
 */
export function mergeWithLWW(
  clientData: Record<string, { value: any; timestamp: number }>,
  serverData: Record<string, { value: any; timestamp: number }>
): Record<string, any> {
  const result: Record<string, any> = {};
  const allKeys = new Set([
    ...Object.keys(clientData),
    ...Object.keys(serverData),
  ]);

  for (const key of allKeys) {
    const clientField = clientData[key];
    const serverField = serverData[key];

    if (!clientField) {
      result[key] = serverField.value;
    } else if (!serverField) {
      result[key] = clientField.value;
    } else {
      // Both have the field - LWW
      result[key] = clientField.timestamp > serverField.timestamp
        ? clientField.value
        : serverField.value;
    }
  }

  return result;
}
```

### 5.2 Server-Side Conflict Detection

```typescript
// convex/urenRegistraties.ts

export const updateWithSync = mutation({
  args: {
    id: v.id('urenRegistraties'),
    updates: v.object({
      uren: v.optional(v.number()),
      scope: v.optional(v.string()),
      notities: v.optional(v.string()),
    }),
    idempotencyKey: v.string(),
    clientTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // Check idempotency
    const existingOp = await ctx.db
      .query('syncOperations')
      .withIndex('by_idempotency', (q) => q.eq('idempotencyKey', args.idempotencyKey))
      .first();

    if (existingOp) {
      return existingOp.result;
    }

    // Get current server state
    const current = await ctx.db.get(args.id);
    if (!current) {
      throw new Error('Record not found');
    }

    // Conflict detection: server has newer version
    if (current.clientTimestamp && current.clientTimestamp > args.clientTimestamp) {
      // Option 1: Reject with conflict error
      throw new ConvexError({
        code: 'CONFLICT',
        message: 'Server has newer version',
        serverData: current,
        serverTimestamp: current.clientTimestamp,
      });

      // Option 2: Auto-merge with LWW (alternative approach)
      // const merged = mergeWithLWW(args.updates, current);
      // await ctx.db.patch(args.id, merged);
    }

    // No conflict - apply updates
    await ctx.db.patch(args.id, {
      ...args.updates,
      clientTimestamp: args.clientTimestamp,
      updatedAt: Date.now(),
    });

    // Log operation for idempotency
    await ctx.db.insert('syncOperations', {
      idempotencyKey: args.idempotencyKey,
      operation: 'UPDATE',
      recordId: args.id,
      result: 'success',
      createdAt: Date.now(),
    });

    return 'success';
  },
});
```

### 5.3 Conflict Resolution Strategieen Vergelijking

| Strategie | Voordelen | Nadelen | Use Case |
|-----------|-----------|---------|----------|
| **Last-Write-Wins** | Simpel, snel | Data loss mogelijk | Single-user data |
| **First-Write-Wins** | Preserveert origineel | Latere changes verloren | Immutable records |
| **Manual Merge** | User control | UX overhead | Collaborative docs |
| **CRDT** | Automatisch, correct | Complex, overhead | Real-time collab |
| **Field-level LWW** | Granular merge | Meer complexity | Partial updates |

### 5.4 Client-Side Conflict Handling

```typescript
// lib/sync/conflict-handler.ts

export type ConflictAction = 'use_client' | 'use_server' | 'manual_merge';

export interface ConflictEvent {
  recordId: string;
  tableName: string;
  clientData: any;
  serverData: any;
  clientTimestamp: number;
  serverTimestamp: number;
}

export class ConflictHandler {
  private conflictQueue: ConflictEvent[] = [];
  private onConflict?: (event: ConflictEvent) => Promise<ConflictAction>;

  constructor(onConflict?: (event: ConflictEvent) => Promise<ConflictAction>) {
    this.onConflict = onConflict;
  }

  async handleConflict(event: ConflictEvent): Promise<ConflictAction> {
    // Default: auto-resolve with LWW
    if (!this.onConflict) {
      return event.clientTimestamp > event.serverTimestamp
        ? 'use_client'
        : 'use_server';
    }

    // Custom handler (e.g., show UI)
    return this.onConflict(event);
  }

  getConflictCount(): number {
    return this.conflictQueue.length;
  }

  getPendingConflicts(): ConflictEvent[] {
    return [...this.conflictQueue];
  }
}
```

---

## 6. Background Sync met Expo

### 6.1 expo-background-fetch Implementatie

```typescript
// lib/sync/background-sync.ts

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import NetInfo from '@react-native-community/netinfo';

const SYNC_TASK_NAME = 'TOP_TUINEN_BACKGROUND_SYNC';

// Task definition (MUST be in global scope)
TaskManager.defineTask(SYNC_TASK_NAME, async () => {
  console.log('[BackgroundSync] Task started');

  try {
    // Pre-flight checks
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('[BackgroundSync] No network, skipping');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const batteryLevel = await Battery.getBatteryLevelAsync();
    const isLowPower = await Battery.isLowPowerModeEnabledAsync();

    if (batteryLevel < 0.15 || isLowPower) {
      console.log('[BackgroundSync] Low battery, skipping');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Import sync engine (lazy to avoid circular deps)
    const { getSyncEngine } = await import('./sync-engine-singleton');
    const engine = getSyncEngine();

    if (!engine) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const result = await engine.executeSync();

    console.log('[BackgroundSync] Task completed:', result);

    return result.success
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.Failed;

  } catch (error) {
    console.error('[BackgroundSync] Task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<boolean> {
  try {
    // Check if already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK_NAME);
    if (isRegistered) {
      console.log('[BackgroundSync] Already registered');
      return true;
    }

    // Check availability
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
      console.warn('[BackgroundSync] Background fetch restricted');
      return false;
    }
    if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
      console.warn('[BackgroundSync] Background fetch denied');
      return false;
    }

    // Register task
    await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
      minimumInterval: 15 * 60, // 15 minutes minimum (iOS constraint)
      stopOnTerminate: false,   // Android: keep running after app close
      startOnBoot: true,        // Android: start on device boot
    });

    console.log('[BackgroundSync] Registered successfully');
    return true;

  } catch (error) {
    console.error('[BackgroundSync] Registration failed:', error);
    return false;
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK_NAME);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(SYNC_TASK_NAME);
      console.log('[BackgroundSync] Unregistered');
    }
  } catch (error) {
    console.error('[BackgroundSync] Unregister failed:', error);
  }
}

export async function getBackgroundSyncStatus(): Promise<{
  isAvailable: boolean;
  isRegistered: boolean;
  status: BackgroundFetch.BackgroundFetchStatus;
}> {
  const status = await BackgroundFetch.getStatusAsync();
  const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK_NAME);

  return {
    isAvailable: status === BackgroundFetch.BackgroundFetchStatus.Available,
    isRegistered,
    status,
  };
}
```

### 6.2 Platform Specifieke Consideraties

| Platform | API | Min Interval | Beperkingen |
|----------|-----|--------------|-------------|
| **iOS** | BGTaskScheduler | 15 min | System controlled, no guarantees |
| **Android** | WorkManager | Configurable | Doze mode, battery optimization |

```typescript
// lib/sync/platform-config.ts

import { Platform } from 'react-native';

export const SYNC_CONFIG = Platform.select({
  ios: {
    minimumInterval: 15 * 60, // 15 min (iOS minimum)
    enablePreciseTiming: false, // iOS doesn't support
    useForegroundService: false,
  },
  android: {
    minimumInterval: 15 * 60, // Match iOS for consistency
    enablePreciseTiming: true,
    useForegroundService: true, // For location tracking
  },
  default: {
    minimumInterval: 15 * 60,
    enablePreciseTiming: false,
    useForegroundService: false,
  },
});
```

---

## 7. Battery-Aware Sync Scheduling

### 7.1 Battery Scheduler Implementation

```typescript
// lib/sync/battery-scheduler.ts

import * as Battery from 'expo-battery';
import NetInfo from '@react-native-community/netinfo';

export interface BatteryState {
  level: number;           // 0-1
  isCharging: boolean;
  isLowPowerMode: boolean;
}

export interface SyncScheduleConfig {
  // Battery thresholds
  criticalBatteryLevel: number;   // Don't sync below this
  lowBatteryLevel: number;        // Reduce sync frequency

  // Intervals (seconds)
  normalInterval: number;
  lowBatteryInterval: number;
  chargingInterval: number;

  // Network preferences
  preferWifi: boolean;
  syncOnCellular: boolean;
}

const DEFAULT_CONFIG: SyncScheduleConfig = {
  criticalBatteryLevel: 0.10,  // 10%
  lowBatteryLevel: 0.20,       // 20%
  normalInterval: 15 * 60,     // 15 min
  lowBatteryInterval: 60 * 60, // 1 hour
  chargingInterval: 5 * 60,    // 5 min
  preferWifi: true,
  syncOnCellular: true,
};

export class BatteryAwareScheduler {
  private config: SyncScheduleConfig;
  private batterySubscription: Battery.Subscription | null = null;
  private currentBatteryState: BatteryState = {
    level: 1,
    isCharging: false,
    isLowPowerMode: false,
  };

  constructor(config: Partial<SyncScheduleConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    // Get initial state
    await this.updateBatteryState();

    // Subscribe to battery changes
    this.batterySubscription = Battery.addBatteryStateListener(({ batteryState }) => {
      this.currentBatteryState.isCharging =
        batteryState === Battery.BatteryState.CHARGING ||
        batteryState === Battery.BatteryState.FULL;
    });

    Battery.addLowPowerModeListener(({ lowPowerMode }) => {
      this.currentBatteryState.isLowPowerMode = lowPowerMode;
    });
  }

  cleanup(): void {
    if (this.batterySubscription) {
      this.batterySubscription.remove();
      this.batterySubscription = null;
    }
  }

  private async updateBatteryState(): Promise<void> {
    const [level, state, lowPower] = await Promise.all([
      Battery.getBatteryLevelAsync(),
      Battery.getBatteryStateAsync(),
      Battery.isLowPowerModeEnabledAsync(),
    ]);

    this.currentBatteryState = {
      level,
      isCharging:
        state === Battery.BatteryState.CHARGING ||
        state === Battery.BatteryState.FULL,
      isLowPowerMode: lowPower,
    };
  }

  /**
   * Determine if sync should proceed based on battery state
   */
  async shouldSync(): Promise<boolean> {
    await this.updateBatteryState();
    const { level, isCharging, isLowPowerMode } = this.currentBatteryState;

    // Always sync when charging
    if (isCharging) {
      return true;
    }

    // Don't sync at critical battery
    if (level < this.config.criticalBatteryLevel) {
      console.log('[BatteryScheduler] Critical battery, sync blocked');
      return false;
    }

    // Don't sync in low power mode (user preference)
    if (isLowPowerMode) {
      console.log('[BatteryScheduler] Low power mode, sync blocked');
      return false;
    }

    return true;
  }

  /**
   * Get optimal sync interval based on current conditions
   */
  async getOptimalInterval(): Promise<number> {
    await this.updateBatteryState();
    const { level, isCharging } = this.currentBatteryState;

    // Charging: sync frequently
    if (isCharging) {
      return this.config.chargingInterval;
    }

    // Low battery: sync less frequently
    if (level < this.config.lowBatteryLevel) {
      return this.config.lowBatteryInterval;
    }

    // Normal: default interval
    return this.config.normalInterval;
  }

  /**
   * Check network conditions for sync
   */
  async shouldSyncOnCurrentNetwork(): Promise<boolean> {
    const netInfo = await NetInfo.fetch();

    if (!netInfo.isConnected) {
      return false;
    }

    // Prefer WiFi
    if (this.config.preferWifi && netInfo.type === 'wifi') {
      return true;
    }

    // Allow cellular if configured
    if (netInfo.type === 'cellular') {
      return this.config.syncOnCellular;
    }

    return true;
  }

  /**
   * Get current battery state
   */
  getBatteryState(): BatteryState {
    return { ...this.currentBatteryState };
  }
}
```

### 7.2 Adaptive Sync Strategy

```typescript
// lib/sync/adaptive-sync.ts

import { BatteryAwareScheduler } from './battery-scheduler';
import { SyncEngine } from './sync-engine';

export class AdaptiveSyncManager {
  private scheduler: BatteryAwareScheduler;
  private syncEngine: SyncEngine;
  private syncTimer: NodeJS.Timeout | null = null;
  private isActive: boolean = false;

  constructor(syncEngine: SyncEngine) {
    this.syncEngine = syncEngine;
    this.scheduler = new BatteryAwareScheduler();
  }

  async start(): Promise<void> {
    if (this.isActive) return;

    await this.scheduler.initialize();
    this.isActive = true;
    this.scheduleNextSync();
  }

  stop(): void {
    this.isActive = false;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.scheduler.cleanup();
  }

  private async scheduleNextSync(): Promise<void> {
    if (!this.isActive) return;

    const interval = await this.scheduler.getOptimalInterval();

    console.log(`[AdaptiveSync] Next sync in ${interval}s`);

    this.syncTimer = setTimeout(async () => {
      await this.performSync();
      this.scheduleNextSync(); // Schedule next
    }, interval * 1000);
  }

  private async performSync(): Promise<void> {
    // Pre-flight checks
    const shouldSync = await this.scheduler.shouldSync();
    const hasNetwork = await this.scheduler.shouldSyncOnCurrentNetwork();

    if (!shouldSync || !hasNetwork) {
      console.log('[AdaptiveSync] Conditions not met, skipping');
      return;
    }

    // Execute sync
    const result = await this.syncEngine.executeSync();

    console.log('[AdaptiveSync] Sync completed:', result);
  }

  /**
   * Force immediate sync (user triggered)
   */
  async forceSync(): Promise<void> {
    // Clear scheduled sync
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    await this.performSync();

    // Reschedule
    this.scheduleNextSync();
  }
}
```

---

## 8. Performance Optimalisaties

### 8.1 Database Optimalisaties

```typescript
// lib/storage/db-optimizations.ts

import { type SQLiteDatabase } from 'expo-sqlite';

/**
 * Apply performance optimizations to SQLite database
 */
export async function applyDbOptimizations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    -- WAL mode for better concurrent access
    PRAGMA journal_mode = WAL;

    -- Increase cache size (default is 2000 pages)
    PRAGMA cache_size = -64000; -- 64MB

    -- Synchronous mode: NORMAL is good balance of safety/speed
    PRAGMA synchronous = NORMAL;

    -- Memory-mapped I/O (faster reads)
    PRAGMA mmap_size = 268435456; -- 256MB

    -- Temp store in memory
    PRAGMA temp_store = MEMORY;

    -- Auto-vacuum for space reclamation
    PRAGMA auto_vacuum = INCREMENTAL;
  `);
}

/**
 * Batch insert for better performance
 */
export async function batchInsert<T>(
  db: SQLiteDatabase,
  tableName: string,
  columns: string[],
  rows: T[],
  batchSize: number = 100
): Promise<void> {
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    await db.withExclusiveTransactionAsync(async (txDb) => {
      for (const row of batch) {
        const values = columns.map((col) => (row as any)[col]);
        await txDb.runAsync(sql, values);
      }
    });
  }
}

/**
 * Prepared statement wrapper for repeated queries
 */
export class PreparedQuery<T> {
  private db: SQLiteDatabase;
  private sql: string;

  constructor(db: SQLiteDatabase, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  async execute(params: any[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(this.sql, params);
  }

  async executeFirst(params: any[] = []): Promise<T | null> {
    return this.db.getFirstAsync<T>(this.sql, params);
  }
}
```

### 8.2 Sync Queue Optimalisaties

```typescript
// lib/sync/queue-optimizations.ts

/**
 * Batch sync operations for network efficiency
 */
export function batchSyncOperations(
  items: SyncQueueItem[],
  maxBatchSize: number = 50
): SyncQueueItem[][] {
  const batches: SyncQueueItem[][] = [];

  // Group by table and operation type
  const groups = new Map<string, SyncQueueItem[]>();

  for (const item of items) {
    const key = `${item.table_name}:${item.operation}`;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  // Split groups into batches
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += maxBatchSize) {
      batches.push(group.slice(i, i + maxBatchSize));
    }
  }

  return batches;
}

/**
 * Compress location data before sync
 */
export function compressLocationBatch(
  locations: LocationPoint[]
): CompressedLocationBatch {
  if (locations.length === 0) {
    return { points: [], compression: 'none' };
  }

  // Delta encoding for sequential points
  const compressed: DeltaPoint[] = [];
  let prev = locations[0];

  compressed.push({
    lat: Math.round(prev.latitude * 1e6),
    lng: Math.round(prev.longitude * 1e6),
    t: prev.recordedAt,
    acc: Math.round(prev.accuracy),
  });

  for (let i = 1; i < locations.length; i++) {
    const curr = locations[i];
    compressed.push({
      lat: Math.round((curr.latitude - prev.latitude) * 1e6),
      lng: Math.round((curr.longitude - prev.longitude) * 1e6),
      t: curr.recordedAt - prev.recordedAt,
      acc: Math.round(curr.accuracy),
    });
    prev = curr;
  }

  return {
    points: compressed,
    compression: 'delta',
    baseTimestamp: locations[0].recordedAt,
  };
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: number;
}

interface DeltaPoint {
  lat: number;
  lng: number;
  t: number;
  acc: number;
}

interface CompressedLocationBatch {
  points: DeltaPoint[];
  compression: 'none' | 'delta';
  baseTimestamp?: number;
}
```

### 8.3 Memory Management

```typescript
// lib/sync/memory-management.ts

/**
 * Cleanup old sync records to manage database size
 */
export async function cleanupOldRecords(
  db: SQLiteDatabase,
  retentionDays: number = 30
): Promise<{ deleted: number }> {
  const cutoffTimestamp = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  // Delete completed sync queue items older than retention
  const queueResult = await db.runAsync(
    `DELETE FROM sync_queue
     WHERE status = 'completed' AND processed_at < ?`,
    [cutoffTimestamp]
  );

  // Delete synced location cache older than retention
  const locationResult = await db.runAsync(
    `DELETE FROM location_cache
     WHERE sync_status = 'synced' AND created_at < ?`,
    [cutoffTimestamp]
  );

  // Vacuum to reclaim space
  await db.execAsync('PRAGMA incremental_vacuum(1000)');

  return {
    deleted: (queueResult.changes ?? 0) + (locationResult.changes ?? 0),
  };
}

/**
 * Get database size info
 */
export async function getDatabaseStats(
  db: SQLiteDatabase
): Promise<{
  pageCount: number;
  pageSize: number;
  totalSize: number;
  freePages: number;
}> {
  const [pageCount, pageSize, freePages] = await Promise.all([
    db.getFirstAsync<{ page_count: number }>('PRAGMA page_count'),
    db.getFirstAsync<{ page_size: number }>('PRAGMA page_size'),
    db.getFirstAsync<{ freelist_count: number }>('PRAGMA freelist_count'),
  ]);

  const totalSize = (pageCount?.page_count ?? 0) * (pageSize?.page_size ?? 4096);

  return {
    pageCount: pageCount?.page_count ?? 0,
    pageSize: pageSize?.page_size ?? 4096,
    totalSize,
    freePages: freePages?.freelist_count ?? 0,
  };
}
```

---

## 9. Implementatie Aanbevelingen

### 9.1 Prioriteiten

| Prioriteit | Component | Reden |
|------------|-----------|-------|
| **P0** | SQLite schema + migrations | Foundation voor alles |
| **P0** | Idempotency keys | Voorkom duplicaten |
| **P0** | Basic SyncEngine | Core offline support |
| **P1** | Background sync | UX voor app in background |
| **P1** | Battery-aware scheduling | Voorkom battery drain |
| **P2** | Conflict resolution UI | Edge case handling |
| **P2** | Performance optimalisaties | Scale considerations |

### 9.2 Testing Strategy

```typescript
// __tests__/sync-engine.test.ts

describe('SyncEngine', () => {
  describe('Idempotency', () => {
    it('should generate unique idempotency keys', async () => {
      const keys = new Set();
      for (let i = 0; i < 1000; i++) {
        keys.add(generateIdempotencyKey());
      }
      expect(keys.size).toBe(1000);
    });

    it('should not create duplicates on retry', async () => {
      const engine = new SyncEngine(db, convex);
      const entry = { projectId: 'p1', datum: '2026-02-01', medewerker: 'Jan', uren: 8 };

      // Simulate network failure on first try
      mockConvex.mockRejectedValueOnce(new Error('Network error'));

      const id1 = await engine.addUrenRegistratie(entry);
      await engine.executeSync(); // Fails

      // Retry succeeds
      mockConvex.mockResolvedValueOnce('server-id-1');
      await engine.executeSync();

      // Should have exactly 1 record
      const records = await db.getAllAsync('SELECT * FROM uren_registraties');
      expect(records.length).toBe(1);
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect server conflict', async () => {
      // Setup: client has older timestamp
      const clientTimestamp = Date.now() - 60000;
      const serverTimestamp = Date.now();

      mockConvex.mockRejectedValueOnce({
        code: 'CONFLICT',
        serverTimestamp,
      });

      await engine.executeSync();

      const record = await db.getFirstAsync(
        'SELECT sync_status FROM uren_registraties WHERE id = ?',
        [recordId]
      );
      expect(record.sync_status).toBe('conflict');
    });
  });

  describe('Battery Awareness', () => {
    it('should skip sync at critical battery', async () => {
      mockBattery.getBatteryLevelAsync.mockResolvedValue(0.05);

      const shouldSync = await scheduler.shouldSync();
      expect(shouldSync).toBe(false);
    });

    it('should sync when charging regardless of level', async () => {
      mockBattery.getBatteryLevelAsync.mockResolvedValue(0.05);
      mockBattery.getBatteryStateAsync.mockResolvedValue(Battery.BatteryState.CHARGING);

      const shouldSync = await scheduler.shouldSync();
      expect(shouldSync).toBe(true);
    });
  });
});
```

### 9.3 Monitoring & Debugging

```typescript
// lib/sync/sync-logger.ts

export class SyncLogger {
  private logs: SyncLogEntry[] = [];
  private maxLogs: number = 1000;

  log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: any
  ): void {
    const entry: SyncLogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
    };

    this.logs.push(entry);

    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output in dev
    if (__DEV__) {
      const prefix = `[Sync:${level.toUpperCase()}]`;
      console.log(prefix, message, data ?? '');
    }
  }

  getLogs(filter?: { level?: string; since?: number }): SyncLogEntry[] {
    return this.logs.filter((log) => {
      if (filter?.level && log.level !== filter.level) return false;
      if (filter?.since && log.timestamp < filter.since) return false;
      return true;
    });
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

interface SyncLogEntry {
  timestamp: number;
  level: string;
  message: string;
  data?: any;
}
```

---

## 10. Bronnen

### Officiële Documentatie
- [Expo SQLite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Expo Background Fetch](https://docs.expo.dev/versions/latest/sdk/background-fetch/)
- [Expo Battery](https://docs.expo.dev/versions/latest/sdk/battery/)
- [Expo Local-First Guide](https://docs.expo.dev/guides/local-first/)

### Research Artikelen
- [Expo SQLite: A Complete Guide for Offline-First React Native Apps](https://medium.com/@aargon007/expo-sqlite-a-complete-guide-for-offline-first-react-native-apps-984fd50e3adb)
- [How to Build Offline-First SQLite Sync in Expo](https://dev.to/sathish_daggula/how-to-build-offline-first-sqlite-sync-in-expo-1lli)
- [Conflict Resolution: Using Last-Write-Wins vs. CRDTs](https://dzone.com/articles/conflict-resolution-using-last-write-wins-vs-crdts)
- [TypeScript CRDT Toolkits for Offline-First Apps](https://medium.com/@2nick2patel2/typescript-crdt-toolkits-for-offline-first-apps-conflict-free-sync-without-tears-df456c7a169b)
- [On Idempotency Keys - Gunnar Morling](https://www.morling.dev/blog/on-idempotency-keys/)
- [Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys)
- [Offline-First Architecture: Designing for Reality](https://medium.com/@jusuftopic/offline-first-architecture-designing-for-reality-not-just-the-cloud-e5fd18e50a79)

### Libraries & Tools
- [OP-SQLite Documentation](https://op-engineering.github.io/op-sqlite/) - High-performance SQLite alternative
- [Drizzle ORM](https://orm.drizzle.team/) - Type-safe SQL
- [TanStack Query](https://tanstack.com/query) - Caching layer

---

*Document gegenereerd op 2026-02-01 als onderdeel van Task #10: Research SQLite offline sync patterns*
