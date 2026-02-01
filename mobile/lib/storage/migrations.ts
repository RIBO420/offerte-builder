/**
 * Database Migrations voor Top Tuinen Mobile App
 *
 * Schema migraties gebaseerd op het research document: SQLITE-SYNC-RESEARCH.md
 * Gebruikt PRAGMA user_version om de huidige versie te tracken.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

// Huidige database versie - verhoog dit bij elke schema wijziging
const DATABASE_VERSION = 1;

/**
 * Voer database migraties uit indien nodig.
 * Wordt aangeroepen door initDatabase().
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  // Check huidige versie
  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    console.log(
      `[Migrations] Database is up to date (version ${currentVersion})`
    );
    return;
  }

  console.log(
    `[Migrations] Upgrading database from version ${currentVersion} to ${DATABASE_VERSION}`
  );

  // Version 0 -> 1: Initial schema
  if (currentVersion < 1) {
    await migrateToVersion1(db);
  }

  // Future migrations
  // if (currentVersion < 2) {
  //   await migrateToVersion2(db);
  // }

  // Update version
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);

  console.log(`[Migrations] Database upgraded to version ${DATABASE_VERSION}`);
}

/**
 * Migration to version 1: Initial schema
 * Creates all base tables for offline storage and sync.
 */
async function migrateToVersion1(db: SQLiteDatabase): Promise<void> {
  console.log('[Migrations] Running migration to version 1');

  await db.execAsync(`
    -- ============================================
    -- UREN REGISTRATIES (lokale cache + pending syncs)
    -- ============================================
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

    -- ============================================
    -- SYNC QUEUE (outbox pattern)
    -- ============================================
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

    -- ============================================
    -- LOCATION CACHE (GPS data buffer)
    -- ============================================
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

    -- ============================================
    -- OFFLINE METADATA (sync status, cursors, etc.)
    -- ============================================
    CREATE TABLE IF NOT EXISTS offline_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- ============================================
    -- INDEXES for performance
    -- ============================================

    -- Uren registraties indexes
    CREATE INDEX IF NOT EXISTS idx_uren_sync_status ON uren_registraties(sync_status);
    CREATE INDEX IF NOT EXISTS idx_uren_datum ON uren_registraties(datum);
    CREATE INDEX IF NOT EXISTS idx_uren_project ON uren_registraties(project_id);
    CREATE INDEX IF NOT EXISTS idx_uren_medewerker ON uren_registraties(medewerker_clerk_id);

    -- Sync queue indexes
    CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue(status, priority DESC, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_queue_pending ON sync_queue(status) WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_queue_table ON sync_queue(table_name);

    -- Location cache indexes
    CREATE INDEX IF NOT EXISTS idx_location_sync ON location_cache(sync_status);
    CREATE INDEX IF NOT EXISTS idx_location_session ON location_cache(session_id);
    CREATE INDEX IF NOT EXISTS idx_location_recorded ON location_cache(recorded_at);
  `);

  console.log('[Migrations] Version 1 migration completed');
}

/**
 * Get the current database version.
 */
export async function getDatabaseVersion(db: SQLiteDatabase): Promise<number> {
  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  return result?.user_version ?? 0;
}

/**
 * Reset database - WARNING: This deletes all data!
 * Only use for debugging/development.
 */
export async function resetDatabase(db: SQLiteDatabase): Promise<void> {
  console.warn('[Migrations] RESETTING DATABASE - All data will be lost!');

  await db.execAsync(`
    DROP TABLE IF EXISTS uren_registraties;
    DROP TABLE IF EXISTS sync_queue;
    DROP TABLE IF EXISTS location_cache;
    DROP TABLE IF EXISTS offline_metadata;
    PRAGMA user_version = 0;
  `);

  // Re-run migrations
  await migrateDbIfNeeded(db);
}

/**
 * Cleanup old records to manage database size.
 * Removes completed sync items and synced location data older than retention period.
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
