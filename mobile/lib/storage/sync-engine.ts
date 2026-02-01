/**
 * Offline Sync Engine voor Top Tuinen Mobile App
 *
 * Implementeert het Outbox Pattern voor betrouwbare offline sync.
 * Gebaseerd op het research document: SQLITE-SYNC-RESEARCH.md
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// ============================================
// TYPES
// ============================================

export interface SyncConfig {
  minSyncInterval: number; // Minimum seconds between syncs
  maxBatchSize: number; // Max items per sync batch
  retryDelayBase: number; // Base delay for exponential backoff (ms)
  maxRetries: number; // Max retry attempts per item
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: number | null;
  pendingCount: number;
  errorCount: number;
}

export interface SyncQueueItem {
  id: string;
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: string;
  payload: string;
  idempotency_key: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  created_at: number;
  processed_at: number | null;
  sequence_number: number;
}

export interface SyncResult {
  success: boolean;
  reason?: string;
  error?: string;
  processed?: number;
  errors?: number;
}

// Callback type voor server sync operaties
export type SyncHandler = (
  item: SyncQueueItem
) => Promise<{ serverId?: string; error?: string }>;

// ============================================
// IDEMPOTENCY KEY GENERATION (UUID v7)
// ============================================

/**
 * Generate UUID v7 for idempotency keys.
 * Format: timestamp (48 bits) + version (4 bits) + random (12 bits) +
 *         variant (2 bits) + random (62 bits)
 */
export function generateIdempotencyKey(): string {
  const timestamp = Date.now();

  // Convert timestamp to hex (48 bits = 12 hex chars)
  const timestampHex = timestamp.toString(16).padStart(12, '0');

  // Generate random parts
  const randomA = Math.floor(Math.random() * 0xfff)
    .toString(16)
    .padStart(3, '0');
  const randomB = (Math.floor(Math.random() * 0x3fff) | 0x8000)
    .toString(16)
    .padStart(4, '0');
  const randomC = Math.floor(Math.random() * 0xffffffffffff)
    .toString(16)
    .padStart(12, '0');

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
 * Check if idempotency key is expired.
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

// ============================================
// SYNC ENGINE CLASS
// ============================================

const DEFAULT_CONFIG: SyncConfig = {
  minSyncInterval: 30,
  maxBatchSize: 20,
  retryDelayBase: 1000,
  maxRetries: 3,
};

export class SyncEngine {
  private db: SQLiteDatabase;
  private config: SyncConfig;
  private state: SyncState;
  private syncLock: boolean = false;
  private networkSubscription: (() => void) | null = null;
  private syncHandlers: Map<string, SyncHandler> = new Map();
  private onStateChange?: (state: SyncState) => void;

  constructor(db: SQLiteDatabase, config: Partial<SyncConfig> = {}) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isOnline: true,
      isSyncing: false,
      lastSyncAt: null,
      pendingCount: 0,
      errorCount: 0,
    };
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize the sync engine.
   * Sets up network listener and loads initial state.
   */
  async initialize(): Promise<void> {
    // Setup network listener
    this.networkSubscription = NetInfo.addEventListener(
      this.handleNetworkChange.bind(this)
    );

    // Get initial network state
    const netState = await NetInfo.fetch();
    this.state.isOnline = netState.isConnected ?? false;

    // Load pending counts
    await this.updatePendingCounts();

    // Load last sync time from metadata
    const lastSyncAt = await this.getMetadata('lastSyncAt');
    if (lastSyncAt) {
      this.state.lastSyncAt = parseInt(lastSyncAt, 10);
    }

    console.log('[SyncEngine] Initialized', this.state);
  }

  /**
   * Cleanup resources.
   */
  cleanup(): void {
    if (this.networkSubscription) {
      this.networkSubscription();
      this.networkSubscription = null;
    }
  }

  /**
   * Register a sync handler for a specific table.
   */
  registerHandler(tableName: string, handler: SyncHandler): void {
    this.syncHandlers.set(tableName, handler);
  }

  /**
   * Set callback for state changes.
   */
  setOnStateChange(callback: (state: SyncState) => void): void {
    this.onStateChange = callback;
  }

  // ============================================
  // NETWORK HANDLING
  // ============================================

  private handleNetworkChange(netState: NetInfoState): void {
    const wasOffline = !this.state.isOnline;
    this.state.isOnline = netState.isConnected ?? false;

    this.notifyStateChange();

    // Came back online - trigger sync
    if (wasOffline && this.state.isOnline) {
      console.log('[SyncEngine] Network restored, triggering sync');
      this.triggerSync();
    }
  }

  // ============================================
  // SYNC QUEUE MANAGEMENT
  // ============================================

  /**
   * Add an item to the sync queue.
   * This is the core method for the outbox pattern.
   */
  async addToSyncQueue(
    tableName: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    recordId: string,
    payload: object,
    priority: number = 0
  ): Promise<string> {
    const id = generateIdempotencyKey();
    const idempotencyKey =
      (payload as { idempotencyKey?: string }).idempotencyKey ||
      generateIdempotencyKey();
    const now = Date.now();

    // Get next sequence number
    const result = await this.db.getFirstAsync<{ maxSeq: number | null }>(
      'SELECT MAX(sequence_number) as maxSeq FROM sync_queue'
    );
    const maxSeq = result?.maxSeq ?? 0;

    await this.db.runAsync(
      `INSERT INTO sync_queue (
        id, table_name, operation, record_id, payload,
        idempotency_key, status, priority, created_at, sequence_number
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        id,
        tableName,
        operation,
        recordId,
        JSON.stringify(payload),
        idempotencyKey,
        priority,
        now,
        maxSeq + 1,
      ]
    );

    await this.updatePendingCounts();

    // Trigger sync if online
    if (this.state.isOnline) {
      this.triggerSync();
    }

    return id;
  }

  /**
   * Get count of pending sync items.
   */
  async getPendingCount(): Promise<number> {
    const result = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`
    );
    return result?.count ?? 0;
  }

  /**
   * Get count of failed sync items.
   */
  async getErrorCount(): Promise<number> {
    const result = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed'`
    );
    return result?.count ?? 0;
  }

  /**
   * Get all pending items from the sync queue.
   */
  async getPendingItems(limit?: number): Promise<SyncQueueItem[]> {
    const sql = `
      SELECT * FROM sync_queue
      WHERE status = 'pending' AND retry_count < max_retries
      ORDER BY priority DESC, sequence_number ASC
      ${limit ? `LIMIT ${limit}` : ''}
    `;
    return this.db.getAllAsync<SyncQueueItem>(sql);
  }

  /**
   * Get failed items from the sync queue.
   */
  async getFailedItems(): Promise<SyncQueueItem[]> {
    return this.db.getAllAsync<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE status = 'failed' ORDER BY created_at DESC`
    );
  }

  /**
   * Retry a failed sync item.
   */
  async retryItem(itemId: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE sync_queue SET status = 'pending', retry_count = 0, last_error = NULL WHERE id = ?`,
      [itemId]
    );
    await this.updatePendingCounts();

    if (this.state.isOnline) {
      this.triggerSync();
    }
  }

  /**
   * Remove a failed item from the queue.
   */
  async removeItem(itemId: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [itemId]);
    await this.updatePendingCounts();
  }

  // ============================================
  // SYNC EXECUTION
  // ============================================

  /**
   * Trigger a sync (debounced).
   */
  triggerSync(): void {
    setTimeout(() => this.processSyncQueue(), 100);
  }

  /**
   * Process the sync queue.
   * This is the main sync execution method.
   */
  async processSyncQueue(): Promise<SyncResult> {
    // Prevent concurrent syncs
    if (this.syncLock) {
      return { success: false, reason: 'sync_in_progress' };
    }

    if (!this.state.isOnline) {
      return { success: false, reason: 'offline' };
    }

    this.syncLock = true;
    this.state.isSyncing = true;
    this.notifyStateChange();

    let processed = 0;
    let errors = 0;

    try {
      // Get pending items
      const pendingItems = await this.getPendingItems(this.config.maxBatchSize);

      for (const item of pendingItems) {
        try {
          // Mark as processing
          await this.db.runAsync(
            `UPDATE sync_queue SET status = 'processing' WHERE id = ?`,
            [item.id]
          );

          // Get handler for this table
          const handler = this.syncHandlers.get(item.table_name);

          if (!handler) {
            console.warn(
              `[SyncEngine] No handler registered for table: ${item.table_name}`
            );
            await this.markItemFailed(
              item.id,
              `No handler for table: ${item.table_name}`
            );
            errors++;
            continue;
          }

          // Execute the sync
          const result = await handler(item);

          if (result.error) {
            throw new Error(result.error);
          }

          // Mark as completed
          await this.db.runAsync(
            `UPDATE sync_queue
             SET status = 'completed', processed_at = ?
             WHERE id = ?`,
            [Date.now(), item.id]
          );

          // Update source record if it was an INSERT and we got a server ID
          if (item.operation === 'INSERT' && result.serverId) {
            await this.db.runAsync(
              `UPDATE ${item.table_name}
               SET server_id = ?, sync_status = 'synced', server_timestamp = ?
               WHERE id = ?`,
              [result.serverId, Date.now(), item.record_id]
            );
          } else if (item.operation === 'UPDATE' || item.operation === 'DELETE') {
            await this.db.runAsync(
              `UPDATE ${item.table_name}
               SET sync_status = 'synced', server_timestamp = ?
               WHERE id = ?`,
              [Date.now(), item.record_id]
            );
          }

          processed++;
        } catch (error) {
          errors++;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          // Check if it's a conflict error
          const isConflict = errorMessage.includes('CONFLICT');

          // Update retry count
          const newRetryCount = item.retry_count + 1;
          const maxRetriesReached = newRetryCount >= this.config.maxRetries;

          await this.db.runAsync(
            `UPDATE sync_queue
             SET status = ?, retry_count = ?, last_error = ?
             WHERE id = ?`,
            [
              isConflict || maxRetriesReached ? 'failed' : 'pending',
              newRetryCount,
              errorMessage,
              item.id,
            ]
          );

          // Update source record status if failed permanently
          if (isConflict || maxRetriesReached) {
            await this.db.runAsync(
              `UPDATE ${item.table_name}
               SET sync_status = ?, last_error = ?
               WHERE id = ?`,
              [isConflict ? 'conflict' : 'error', errorMessage, item.record_id]
            );
          }

          console.error(
            `[SyncEngine] Failed to sync item ${item.id}:`,
            errorMessage
          );
        }
      }

      // Update last sync time
      this.state.lastSyncAt = Date.now();
      await this.setMetadata('lastSyncAt', this.state.lastSyncAt.toString());

      // Cleanup old completed items (keep last 24 hours)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      await this.db.runAsync(
        `DELETE FROM sync_queue WHERE status = 'completed' AND processed_at < ?`,
        [cutoff]
      );

      return {
        success: true,
        processed,
        errors,
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
      this.notifyStateChange();
    }
  }

  private async markItemFailed(itemId: string, error: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE sync_queue SET status = 'failed', last_error = ? WHERE id = ?`,
      [error, itemId]
    );
  }

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  /**
   * Get the current sync state.
   */
  async getState(): Promise<SyncState> {
    await this.updatePendingCounts();
    return { ...this.state };
  }

  private async updatePendingCounts(): Promise<void> {
    const pending = await this.getPendingCount();
    const errors = await this.getErrorCount();

    this.state.pendingCount = pending;
    this.state.errorCount = errors;
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  // ============================================
  // METADATA HELPERS
  // ============================================

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
