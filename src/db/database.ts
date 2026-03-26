import * as SQLite from 'expo-sqlite';
import { seedIfNeeded } from './seedData';

let db: SQLite.SQLiteDatabase | null = null;

const MIGRATIONS = [
  // Version 1: initial schema
  `CREATE TABLE IF NOT EXISTS fragments (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    week_key TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_fragments_created ON fragments(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_fragments_week ON fragments(week_key);

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    week_key TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    fragment_ids TEXT NOT NULL,
    model_version TEXT,
    generated_at INTEGER NOT NULL
  );`,
];

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('meaning-weaver.db');

  // Enable WAL mode for better performance
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA synchronous = NORMAL');

  // Run migrations
  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  let currentVersion = result?.user_version ?? 0;

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    await db.execAsync(MIGRATIONS[i]);
  }

  if (currentVersion < MIGRATIONS.length) {
    await db.execAsync(`PRAGMA user_version = ${MIGRATIONS.length}`);
  }

  // Seed example data on first launch
  await seedIfNeeded(db);

  return db;
}
