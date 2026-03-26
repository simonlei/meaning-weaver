import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';
import { Report, ReportContent } from '../schema';

export async function insertReport(
  db: SQLite.SQLiteDatabase,
  weekKey: string,
  content: ReportContent,
  fragmentIds: string[],
  modelVersion: string
): Promise<Report> {
  const report: Report = {
    id: uuidv4(),
    week_key: weekKey,
    content: JSON.stringify(content),
    fragment_ids: JSON.stringify(fragmentIds),
    model_version: modelVersion,
    generated_at: Date.now(),
  };

  await db.runAsync(
    `INSERT OR REPLACE INTO reports (id, week_key, content, fragment_ids, model_version, generated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [report.id, report.week_key, report.content, report.fragment_ids, report.model_version, report.generated_at]
  );

  return report;
}

export async function getReportByWeek(
  db: SQLite.SQLiteDatabase,
  weekKey: string
): Promise<Report | null> {
  const row = await db.getFirstAsync<Report>(
    'SELECT * FROM reports WHERE week_key = ?',
    [weekKey]
  );
  return row ?? null;
}

export async function getAllReports(
  db: SQLite.SQLiteDatabase
): Promise<Report[]> {
  return db.getAllAsync<Report>(
    'SELECT * FROM reports ORDER BY generated_at DESC'
  );
}

export async function getLatestReport(
  db: SQLite.SQLiteDatabase
): Promise<Report | null> {
  const row = await db.getFirstAsync<Report>(
    'SELECT * FROM reports ORDER BY generated_at DESC LIMIT 1'
  );
  return row ?? null;
}

export function parseReportContent(report: Report): ReportContent | null {
  try {
    return JSON.parse(report.content) as ReportContent;
  } catch {
    return null;
  }
}
