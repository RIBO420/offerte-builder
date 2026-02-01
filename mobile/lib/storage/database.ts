/**
 * Database Initialisatie voor Top Tuinen Mobile App
 *
 * Deze module bevat de core database setup met expo-sqlite.
 * Gebaseerd op het research document: SQLITE-SYNC-RESEARCH.md
 */

import * as SQLite from 'expo-sqlite';
import { migrateDbIfNeeded } from './migrations';

// Database naam
const DATABASE_NAME = 'toptuinen.db';

// Singleton database instance
let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Open de database en retourneer de instance.
 * Gebruikt een singleton pattern om meerdere connecties te voorkomen.
 */
export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // Apply performance optimizations
  await applyDatabaseOptimizations(dbInstance);

  return dbInstance;
}

/**
 * Initialiseer de database met schema en migraties.
 * Deze functie moet worden aangeroepen bij app startup.
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await openDatabase();

  // Voer migraties uit
  await migrateDbIfNeeded(db);

  return db;
}

/**
 * Pas performance optimalisaties toe op de database.
 * Gebaseerd op research document sectie 8.1.
 */
async function applyDatabaseOptimizations(
  db: SQLite.SQLiteDatabase
): Promise<void> {
  await db.execAsync(`
    -- WAL mode for better concurrent access
    PRAGMA journal_mode = WAL;

    -- Increase cache size (default is 2000 pages)
    PRAGMA cache_size = -64000;

    -- Synchronous mode: NORMAL is good balance of safety/speed
    PRAGMA synchronous = NORMAL;

    -- Memory-mapped I/O (faster reads)
    PRAGMA mmap_size = 268435456;

    -- Temp store in memory
    PRAGMA temp_store = MEMORY;

    -- Auto-vacuum for space reclamation
    PRAGMA auto_vacuum = INCREMENTAL;
  `);
}

/**
 * Sluit de database verbinding.
 * Gebruik dit bij app cleanup.
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
  }
}

/**
 * Get the current database instance.
 * Throws error if database is not initialized.
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    throw new Error(
      'Database not initialized. Call initDatabase() first.'
    );
  }
  return dbInstance;
}

/**
 * Hook wrapper voor SQLite context in React components.
 * Gebruik dit in components die database access nodig hebben.
 */
export function useSQLiteContext(): SQLite.SQLiteDatabase {
  return getDatabase();
}

/**
 * Database stats voor monitoring en debugging.
 */
export async function getDatabaseStats(): Promise<{
  pageCount: number;
  pageSize: number;
  totalSize: number;
  freePages: number;
}> {
  const db = getDatabase();

  const [pageCount, pageSize, freePages] = await Promise.all([
    db.getFirstAsync<{ page_count: number }>('PRAGMA page_count'),
    db.getFirstAsync<{ page_size: number }>('PRAGMA page_size'),
    db.getFirstAsync<{ freelist_count: number }>('PRAGMA freelist_count'),
  ]);

  const totalSize =
    (pageCount?.page_count ?? 0) * (pageSize?.page_size ?? 4096);

  return {
    pageCount: pageCount?.page_count ?? 0,
    pageSize: pageSize?.page_size ?? 4096,
    totalSize,
    freePages: freePages?.freelist_count ?? 0,
  };
}

/**
 * Export database types for external use
 */
export type { SQLiteDatabase } from 'expo-sqlite';
