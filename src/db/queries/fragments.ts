import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';
import { Fragment, computeWeekKey } from '../schema';

export async function insertFragment(
  db: SQLite.SQLiteDatabase,
  content: string
): Promise<Fragment> {
  const now = Date.now();
  const fragment: Fragment = {
    id: uuidv4(),
    content: content.trim(),
    created_at: now,
    week_key: computeWeekKey(now),
  };

  await db.runAsync(
    'INSERT INTO fragments (id, content, created_at, week_key) VALUES (?, ?, ?, ?)',
    [fragment.id, fragment.content, fragment.created_at, fragment.week_key]
  );

  return fragment;
}

export async function getRecentFragments(
  db: SQLite.SQLiteDatabase,
  limit: number = 50
): Promise<Fragment[]> {
  const rows = await db.getAllAsync<Fragment>(
    'SELECT * FROM fragments ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  return rows;
}

export async function getFragmentsByWeek(
  db: SQLite.SQLiteDatabase,
  weekKey: string
): Promise<Fragment[]> {
  const rows = await db.getAllAsync<Fragment>(
    'SELECT * FROM fragments WHERE week_key = ? ORDER BY created_at ASC',
    [weekKey]
  );
  return rows;
}

export async function getCurrentWeekFragments(
  db: SQLite.SQLiteDatabase
): Promise<Fragment[]> {
  const weekKey = computeWeekKey(Date.now());
  return getFragmentsByWeek(db, weekKey);
}

export async function deleteFragment(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM fragments WHERE id = ?', [id]);
}

export async function getFragmentCount(
  db: SQLite.SQLiteDatabase
): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM fragments'
  );
  return result?.count ?? 0;
}
