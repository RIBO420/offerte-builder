/**
 * Storage Module Exports
 *
 * Central export file for all storage-related functionality.
 */

// Database
export {
  openDatabase,
  initDatabase,
  closeDatabase,
  getDatabase,
  useSQLiteContext,
  getDatabaseStats,
  type SQLiteDatabase,
} from './database';

// Migrations
export {
  migrateDbIfNeeded,
  getDatabaseVersion,
  resetDatabase,
  cleanupOldRecords,
} from './migrations';

// Sync Engine
export {
  SyncEngine,
  generateIdempotencyKey,
  extractTimestamp,
  isIdempotencyKeyExpired,
  type SyncConfig,
  type SyncState,
  type SyncQueueItem,
  type SyncResult,
  type SyncHandler,
} from './sync-engine';
