/**
 * In-memory SQLite mock for testing.
 * Implements the minimal subset of expo-sqlite's SQLiteDatabase API used by repository.ts.
 */

class InMemoryDatabase {
  constructor() {
    this._tables = {};
    this._user_version = 0;
  }

  async execAsync(sql) {
    // Handle PRAGMA journal_mode / synchronous
    if (sql.includes('PRAGMA journal_mode') || sql.includes('PRAGMA synchronous')) {
      return;
    }
    // Handle user_version set
    const uvSet = sql.match(/PRAGMA user_version\s*=\s*(\d+)/);
    if (uvSet) {
      this._user_version = parseInt(uvSet[1]);
      return;
    }
    // Execute multiple statements (split by ';')
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      this._execSingle(stmt);
    }
  }

  _execSingle(sql) {
    // CREATE TABLE IF NOT EXISTS
    const createMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)\s*\(([^)]+)\)/i);
    if (createMatch) {
      const name = createMatch[1];
      if (!this._tables[name]) {
        this._tables[name] = [];
      }
      return;
    }
    // CREATE INDEX IF NOT EXISTS — ignore
    if (/CREATE INDEX IF NOT EXISTS/i.test(sql)) return;
  }

  async getFirstAsync(sql, params = []) {
    // PRAGMA user_version
    if (/PRAGMA user_version/.test(sql) && !sql.includes('=')) {
      return { user_version: this._user_version };
    }
    const rows = await this.getAllAsync(sql, params);
    return rows[0] ?? null;
  }

  async getAllAsync(sql, params = []) {
    // SELECT from table
    const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM\s+(\w+)/i);
    if (!selectMatch) return [];
    const tableName = selectMatch[2];
    let rows = [...(this._tables[tableName] || [])];

    // WHERE key = ?
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
    if (whereMatch && params.length > 0) {
      const col = whereMatch[1];
      const val = params[0];
      rows = rows.filter(r => r[col] === val);
    }

    // ORDER BY col DESC
    const orderMatch = sql.match(/ORDER BY\s+(\w+)\s+(DESC|ASC)/i);
    if (orderMatch) {
      const col = orderMatch[1];
      const dir = orderMatch[2].toUpperCase();
      rows.sort((a, b) => dir === 'DESC' ? (b[col] > a[col] ? 1 : -1) : (a[col] > b[col] ? 1 : -1));
    }

    // LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\?|\d+)/i);
    if (limitMatch) {
      const limit = limitMatch[1] === '?' ? params[params.length - 1] : parseInt(limitMatch[1]);
      rows = rows.slice(0, limit);
    }

    // COUNT(*)
    if (/SELECT COUNT\(\*\)/i.test(sql)) {
      return [{ count: rows.length }];
    }

    return rows;
  }

  async runAsync(sql, params = []) {
    // INSERT OR REPLACE INTO table (cols) VALUES (?,?,...)
    const insertMatch = sql.match(/INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const tableName = insertMatch[1];
      const cols = insertMatch[2].split(',').map(c => c.trim());
      if (!this._tables[tableName]) this._tables[tableName] = [];
      const row = {};
      cols.forEach((col, i) => { row[col] = params[i]; });
      // For OR REPLACE: remove existing row with same PRIMARY KEY (first col)
      if (/INSERT OR REPLACE/i.test(sql)) {
        const pk = cols[0];
        this._tables[tableName] = this._tables[tableName].filter(r => r[pk] !== row[pk]);
      }
      this._tables[tableName].push(row);
      return;
    }

    // DELETE FROM table WHERE col = ?
    const deleteMatch = sql.match(/DELETE FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\?/i);
    if (deleteMatch) {
      const tableName = deleteMatch[1];
      const col = deleteMatch[2];
      if (this._tables[tableName]) {
        this._tables[tableName] = this._tables[tableName].filter(r => r[col] !== params[0]);
      }
      return;
    }
  }
}

module.exports = {
  openDatabaseAsync: jest.fn(async (_name) => new InMemoryDatabase()),
};
