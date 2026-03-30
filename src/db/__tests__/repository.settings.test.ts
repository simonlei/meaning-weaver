/**
 * TDD: Repository API Key 存储
 *
 * 红阶段：先写测试，此时实现不存在，测试应当失败。
 */

// Mock react-native Platform before importing repository
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// Mock uuid
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

// --- WebRepository tests (uses localStorage mock) ---
describe('WebRepository - API Key', () => {
  let WebRepository: any;

  beforeEach(() => {
    // Reset module registry so each test gets a fresh WebRepository instance
    jest.resetModules();
    // Reset localStorage mock
    const store: Record<string, string> = {};
    global.localStorage = {
      getItem: jest.fn((k: string) => store[k] ?? null),
      setItem: jest.fn((k: string, v: string) => { store[k] = v; }),
      removeItem: jest.fn((k: string) => { delete store[k]; }),
    } as any;

    // Re-import after resetting modules
    jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
    jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
    const mod = require('../repository');
    WebRepository = mod.WebRepository;
  });

  it('初始状态返回 null', async () => {
    const repo = new WebRepository();
    expect(await repo.getApiKey()).toBeNull();
  });

  it('保存后能读回', async () => {
    const repo = new WebRepository();
    await repo.setApiKey('sk-test-key-123');
    expect(await repo.getApiKey()).toBe('sk-test-key-123');
  });

  it('保存空字符串等同清空', async () => {
    const repo = new WebRepository();
    await repo.setApiKey('some-key');
    await repo.setApiKey('');
    expect(await repo.getApiKey()).toBeNull();
  });
});

// --- SQLiteRepository tests (uses in-memory mock) ---
describe('SQLiteRepository - API Key', () => {
  let SQLiteRepository: any;
  let mockDb: any;

  beforeEach(async () => {
    jest.resetModules();
    jest.mock('react-native', () => ({ Platform: { OS: 'native' } }));
    jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

    const sqlite = require('expo-sqlite');
    mockDb = await sqlite.openDatabaseAsync('test.db');

    // Run the migration manually to set up the database
    const mod = require('../repository');
    SQLiteRepository = mod.SQLiteRepository;
    await mod.runMigrations(mockDb);
  });

  it('初始状态返回 null', async () => {
    const repo = new SQLiteRepository(mockDb);
    expect(await repo.getApiKey()).toBeNull();
  });

  it('保存后能读回', async () => {
    const repo = new SQLiteRepository(mockDb);
    await repo.setApiKey('sk-sqlite-key-456');
    expect(await repo.getApiKey()).toBe('sk-sqlite-key-456');
  });

  it('保存空字符串等同清空', async () => {
    const repo = new SQLiteRepository(mockDb);
    await repo.setApiKey('some-key');
    await repo.setApiKey('');
    expect(await repo.getApiKey()).toBeNull();
  });

  it('覆盖写入（第二次 setApiKey 覆盖第一次）', async () => {
    const repo = new SQLiteRepository(mockDb);
    await repo.setApiKey('first-key');
    await repo.setApiKey('second-key');
    expect(await repo.getApiKey()).toBe('second-key');
  });
});

// --- getRepository() migration version test ---
describe('SQLite migration user_version', () => {
  it('migration 后 user_version 应为 3', async () => {
    jest.resetModules();
    jest.mock('react-native', () => ({ Platform: { OS: 'native' } }));
    jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

    const sqlite = require('expo-sqlite');
    const db = await sqlite.openDatabaseAsync('test-version.db');
    const mod = require('../repository');
    await mod.runMigrations(db);

    const row = await db.getFirstAsync('PRAGMA user_version');
    expect(row?.user_version).toBe(5);
  });
});
