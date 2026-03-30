import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { Fragment, Report, ReportContent, computeWeekKey } from './schema';
import { File } from 'expo-file-system';

// Abstract interface - works on both web (memory) and native (SQLite)
export interface Repository {
  // Fragments
  insertFragment(content: string, photoUri?: string, photoDescription?: string, audioUri?: string): Promise<Fragment>;
  updateFragmentPhotoDescription(id: string, description: string): Promise<void>;
  getRecentFragments(limit: number): Promise<Fragment[]>;
  getFragmentsByWeek(weekKey: string): Promise<Fragment[]>;
  getCurrentWeekFragments(): Promise<Fragment[]>;
  deleteFragment(id: string): Promise<void>;
  getFragmentCount(): Promise<number>;
  // Reports
  insertReport(weekKey: string, content: ReportContent, fragmentIds: string[], modelVersion: string): Promise<Report>;
  getReportByWeek(weekKey: string): Promise<Report | null>;
  getAllReports(): Promise<Report[]>;
  getLatestReport(): Promise<Report | null>;
  // Settings
  getApiKey(): Promise<string | null>;
  setApiKey(key: string): Promise<void>;
  getAsrCredentials(): Promise<{ secretId: string; secretKey: string } | null>;
  setAsrCredentials(secretId: string, secretKey: string): Promise<void>;
}

// ===== localStorage-backed implementation (Web) =====
const STORAGE_KEY_FRAGMENTS = 'mw_fragments';
const STORAGE_KEY_REPORTS = 'mw_reports';
const STORAGE_KEY_API_KEY = 'mw_api_key';

export class WebRepository implements Repository {
  private fragments: Fragment[];
  private reports: Report[];

  constructor() {
    this.fragments = this.load(STORAGE_KEY_FRAGMENTS);
    this.reports = this.load(STORAGE_KEY_REPORTS);
  }

  private load<T>(key: string): T[] {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveFragments() {
    localStorage.setItem(STORAGE_KEY_FRAGMENTS, JSON.stringify(this.fragments));
  }

  private saveReports() {
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(this.reports));
  }

  async insertFragment(content: string, photoUri?: string, photoDescription?: string, audioUri?: string): Promise<Fragment> {
    const now = Date.now();
    const fragment: Fragment = {
      id: uuidv4(),
      content: content.trim(),
      created_at: now,
      week_key: computeWeekKey(now),
      photo_uri: photoUri ?? null,
      photo_description: photoDescription ?? null,
      audio_uri: audioUri ?? null,
    };
    this.fragments.unshift(fragment);
    this.saveFragments();
    return fragment;
  }

  async updateFragmentPhotoDescription(id: string, description: string): Promise<void> {
    const fragment = this.fragments.find((f) => f.id === id);
    if (fragment) {
      fragment.photo_description = description;
      this.saveFragments();
    }
  }

  async getRecentFragments(limit: number): Promise<Fragment[]> {
    return [...this.fragments]
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit);
  }

  async getFragmentsByWeek(weekKey: string): Promise<Fragment[]> {
    return this.fragments
      .filter((f) => f.week_key === weekKey)
      .sort((a, b) => a.created_at - b.created_at);
  }

  async getCurrentWeekFragments(): Promise<Fragment[]> {
    return this.getFragmentsByWeek(computeWeekKey(Date.now()));
  }

  async deleteFragment(id: string): Promise<void> {
    // Web platform: no local file system, skip file cleanup
    this.fragments = this.fragments.filter((f) => f.id !== id);
    this.saveFragments();
  }

  async getFragmentCount(): Promise<number> {
    return this.fragments.length;
  }

  async insertReport(weekKey: string, content: ReportContent, fragmentIds: string[], modelVersion: string): Promise<Report> {
    // Replace existing report for same week
    this.reports = this.reports.filter((r) => r.week_key !== weekKey);
    const report: Report = {
      id: uuidv4(),
      week_key: weekKey,
      content: JSON.stringify(content),
      fragment_ids: JSON.stringify(fragmentIds),
      model_version: modelVersion,
      generated_at: Date.now(),
    };
    this.reports.unshift(report);
    this.saveReports();
    return report;
  }

  async getReportByWeek(weekKey: string): Promise<Report | null> {
    return this.reports.find((r) => r.week_key === weekKey) ?? null;
  }

  async getAllReports(): Promise<Report[]> {
    return [...this.reports].sort((a, b) => b.generated_at - a.generated_at);
  }

  async getLatestReport(): Promise<Report | null> {
    if (this.reports.length === 0) return null;
    return [...this.reports].sort((a, b) => b.generated_at - a.generated_at)[0];
  }

  async getApiKey(): Promise<string | null> {
    const raw = localStorage.getItem(STORAGE_KEY_API_KEY);
    return raw || null;
  }

  async setApiKey(key: string): Promise<void> {
    if (!key) {
      localStorage.removeItem(STORAGE_KEY_API_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY_API_KEY, key);
    }
  }

  async getAsrCredentials(): Promise<{ secretId: string; secretKey: string } | null> {
    const secretId = localStorage.getItem('mw_asr_secret_id');
    const secretKey = localStorage.getItem('mw_asr_secret_key');
    if (!secretId || !secretKey) return null;
    return { secretId, secretKey };
  }

  async setAsrCredentials(secretId: string, secretKey: string): Promise<void> {
    if (!secretId || !secretKey) {
      localStorage.removeItem('mw_asr_secret_id');
      localStorage.removeItem('mw_asr_secret_key');
    } else {
      localStorage.setItem('mw_asr_secret_id', secretId);
      localStorage.setItem('mw_asr_secret_key', secretKey);
    }
  }
}

// ===== SQLite implementation (Native) =====
export class SQLiteRepository implements Repository {
  private db: import('expo-sqlite').SQLiteDatabase;

  constructor(db: import('expo-sqlite').SQLiteDatabase) {
    this.db = db;
  }

  async insertFragment(content: string, photoUri?: string, photoDescription?: string, audioUri?: string): Promise<Fragment> {
    const now = Date.now();
    const fragment: Fragment = {
      id: uuidv4(),
      content: content.trim(),
      created_at: now,
      week_key: computeWeekKey(now),
      photo_uri: photoUri ?? null,
      photo_description: photoDescription ?? null,
      audio_uri: audioUri ?? null,
    };
    await this.db.runAsync(
      'INSERT INTO fragments (id, content, created_at, week_key, photo_uri, photo_description, audio_uri) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [fragment.id, fragment.content, fragment.created_at, fragment.week_key, fragment.photo_uri ?? null, fragment.photo_description ?? null, fragment.audio_uri ?? null]
    );
    return fragment;
  }

  async getRecentFragments(limit: number): Promise<Fragment[]> {
    return this.db.getAllAsync<Fragment>(
      'SELECT * FROM fragments ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
  }

  async updateFragmentPhotoDescription(id: string, description: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE fragments SET photo_description = ? WHERE id = ?',
      [description, id]
    );
  }

  async getFragmentsByWeek(weekKey: string): Promise<Fragment[]> {
    return this.db.getAllAsync<Fragment>(
      'SELECT * FROM fragments WHERE week_key = ? ORDER BY created_at ASC',
      [weekKey]
    );
  }

  async getCurrentWeekFragments(): Promise<Fragment[]> {
    return this.getFragmentsByWeek(computeWeekKey(Date.now()));
  }

  async deleteFragment(id: string): Promise<void> {
    // Clean up local photo and audio files before deleting the DB row
    const row = await this.db.getFirstAsync<{ photo_uri: string | null; audio_uri: string | null }>(
      'SELECT photo_uri, audio_uri FROM fragments WHERE id = ?',
      [id]
    );
    if (row?.photo_uri) {
      try {
        new File(row.photo_uri).delete();
      } catch {
        // File already gone — ignore
      }
    }
    if (row?.audio_uri) {
      try {
        new File(row.audio_uri).delete();
      } catch {
        // File already gone — ignore
      }
    }
    await this.db.runAsync('DELETE FROM fragments WHERE id = ?', [id]);
  }

  async getFragmentCount(): Promise<number> {
    const result = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM fragments'
    );
    return result?.count ?? 0;
  }

  async insertReport(weekKey: string, content: ReportContent, fragmentIds: string[], modelVersion: string): Promise<Report> {
    const report: Report = {
      id: uuidv4(),
      week_key: weekKey,
      content: JSON.stringify(content),
      fragment_ids: JSON.stringify(fragmentIds),
      model_version: modelVersion,
      generated_at: Date.now(),
    };
    await this.db.runAsync(
      `INSERT OR REPLACE INTO reports (id, week_key, content, fragment_ids, model_version, generated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [report.id, report.week_key, report.content, report.fragment_ids, report.model_version, report.generated_at]
    );
    return report;
  }

  async getReportByWeek(weekKey: string): Promise<Report | null> {
    const row = await this.db.getFirstAsync<Report>(
      'SELECT * FROM reports WHERE week_key = ?',
      [weekKey]
    );
    return row ?? null;
  }

  async getAllReports(): Promise<Report[]> {
    return this.db.getAllAsync<Report>(
      'SELECT * FROM reports ORDER BY generated_at DESC'
    );
  }

  async getLatestReport(): Promise<Report | null> {
    const row = await this.db.getFirstAsync<Report>(
      'SELECT * FROM reports ORDER BY generated_at DESC LIMIT 1'
    );
    return row ?? null;
  }

  async getApiKey(): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['api_key']
    );
    return row?.value ?? null;
  }

  async setApiKey(key: string): Promise<void> {
    if (!key) {
      await this.db.runAsync('DELETE FROM settings WHERE key = ?', ['api_key']);
    } else {
      await this.db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['api_key', key]
      );
    }
  }

  async getAsrCredentials(): Promise<{ secretId: string; secretKey: string } | null> {
    const sidRow = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['asr_secret_id']
    );
    const keyRow = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['asr_secret_key']
    );
    if (!sidRow?.value || !keyRow?.value) return null;
    return { secretId: sidRow.value, secretKey: keyRow.value };
  }

  async setAsrCredentials(secretId: string, secretKey: string): Promise<void> {
    if (!secretId || !secretKey) {
      await this.db.runAsync('DELETE FROM settings WHERE key IN (?, ?)', ['asr_secret_id', 'asr_secret_key']);
    } else {
      await this.db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['asr_secret_id', secretId]
      );
      await this.db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['asr_secret_key', secretKey]
      );
    }
  }
}

// ===== Migrations (exported for testing) =====
export async function runMigrations(db: import('expo-sqlite').SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA synchronous = NORMAL');

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(`CREATE TABLE IF NOT EXISTS fragments (
      id TEXT PRIMARY KEY, content TEXT NOT NULL, created_at INTEGER NOT NULL, week_key TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fragments_created ON fragments(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_fragments_week ON fragments(week_key);
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, week_key TEXT NOT NULL UNIQUE, content TEXT NOT NULL,
      fragment_ids TEXT NOT NULL, model_version TEXT, generated_at INTEGER NOT NULL
    );`);
    await db.execAsync('PRAGMA user_version = 1');
  }

  if (currentVersion < 2) {
    await db.execAsync(`CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );`);
    await db.execAsync('PRAGMA user_version = 2');
  }

  if (currentVersion < 3) {
    await db.execAsync('ALTER TABLE fragments ADD COLUMN photo_uri TEXT');
    await db.execAsync('PRAGMA user_version = 3');
  }

  if (currentVersion < 4) {
    await db.execAsync('ALTER TABLE fragments ADD COLUMN audio_uri TEXT');
    await db.execAsync('PRAGMA user_version = 4');
  }

  if (currentVersion < 5) {
    await db.execAsync('ALTER TABLE fragments ADD COLUMN photo_description TEXT');
    await db.execAsync('PRAGMA user_version = 5');
  }
}

// ===== Seed data =====
async function seedIfEmpty(repo: Repository): Promise<void> {
  const count = await repo.getFragmentCount();
  if (count > 0) return;

  // 只预置几条示例碎片，不预置周报
  const contents = [
    '今天在咖啡馆坐了一下午，看着窗外的人来人往。突然意识到自己很久没有这样"什么都不做"了。',
    '和老朋友打了个电话，聊了快一个小时。挂了电话之后心里暖暖的，但也有点感慨——这样的对话越来越少了。',
    '在公司楼下散步的时候看到一棵树发了新芽，拍了一张照片。春天真的来了。',
  ];

  for (const content of contents) {
    await repo.insertFragment(content);
  }
}

// ===== Factory =====
let cachedRepo: Repository | null = null;

export async function getRepository(): Promise<Repository> {
  if (cachedRepo) return cachedRepo;

  if (Platform.OS === 'web') {
    cachedRepo = new WebRepository();
  } else {
    const SQLite = await import('expo-sqlite');
    const db = await SQLite.openDatabaseAsync('meaning-weaver.db');
    await runMigrations(db);
    cachedRepo = new SQLiteRepository(db);
  }

  await seedIfEmpty(cachedRepo);
  return cachedRepo;
}
