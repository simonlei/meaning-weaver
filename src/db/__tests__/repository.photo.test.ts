/**
 * TDD: photo_uri 支持 — repository 层
 *
 * 红阶段：测试 migration v3、insertFragment 接受 photoUri、
 * deleteFragment 清理本地文件、user_version 应为 3。
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'native' },
}));

jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

// Mock expo-file-system new API
const mockFileDelete = jest.fn();
const mockFileExists = jest.fn().mockReturnValue(true);
const mockPaths = { document: 'file:///mock/documents', cache: 'file:///mock/cache' };
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    get exists() { return mockFileExists(); },
    delete: mockFileDelete,
  })),
  Paths: mockPaths,
}));

describe('Migration v3 — photo_uri 列', () => {
  let db: any;
  let runMigrations: any;
  let SQLiteRepository: any;

  beforeEach(async () => {
    jest.resetModules();
    jest.mock('react-native', () => ({ Platform: { OS: 'native' } }));
    jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
    jest.mock('expo-file-system', () => ({
      File: jest.fn().mockImplementation(() => ({
        get exists() { return mockFileExists(); },
        delete: mockFileDelete,
      })),
      Paths: mockPaths,
    }));

    const sqlite = require('expo-sqlite');
    db = await sqlite.openDatabaseAsync('test-photo.db');
    const mod = require('../repository');
    runMigrations = mod.runMigrations;
    SQLiteRepository = mod.SQLiteRepository;
    await runMigrations(db);
  });

  afterEach(() => {
    mockFileDelete.mockClear();
    mockFileExists.mockReturnValue(true);
  });

  it('migration 后 user_version 应为 4', async () => {
    const row = await db.getFirstAsync('PRAGMA user_version');
    expect(row?.user_version).toBe(5);
  });

  it('fragments 表包含 photo_uri 列', async () => {
    const row = await db.getFirstAsync(
      "SELECT * FROM pragma_table_info('fragments') WHERE name = 'photo_uri'"
    );
    expect(row).not.toBeNull();
    expect(row?.name).toBe('photo_uri');
  });

  it('photo_uri 列可以为 null（旧数据兼容）', async () => {
    const repo = new SQLiteRepository(db);
    const fragment = await repo.insertFragment('纯文字碎片');
    expect(fragment.photo_uri).toBeNull();
    expect(fragment.content).toBe('纯文字碎片');
  });

  it('insertFragment 可以保存 photoUri', async () => {
    const repo = new SQLiteRepository(db);
    const fragment = await repo.insertFragment('文字+照片', 'file:///photos/img001.jpg');
    expect(fragment.photo_uri).toBe('file:///photos/img001.jpg');
    expect(fragment.content).toBe('文字+照片');
  });

  it('insertFragment 照片专用碎片（content 为空字符串）', async () => {
    const repo = new SQLiteRepository(db);
    const fragment = await repo.insertFragment('', 'file:///photos/img002.jpg');
    expect(fragment.content).toBe('');
    expect(fragment.photo_uri).toBe('file:///photos/img002.jpg');
  });

  it('deleteFragment 含照片时调用 file.delete()', async () => {
    const repo = new SQLiteRepository(db);
    const fragment = await repo.insertFragment('有照片', 'file:///mock/documents/img003.jpg');
    await repo.deleteFragment(fragment.id);
    expect(mockFileDelete).toHaveBeenCalled();
  });

  it('deleteFragment 无照片时不调用 file.delete()', async () => {
    const repo = new SQLiteRepository(db);
    const fragment = await repo.insertFragment('纯文字');
    await repo.deleteFragment(fragment.id);
    expect(mockFileDelete).not.toHaveBeenCalled();
  });

  it('deleteFragment 文件不存在时静默成功（idempotent）', async () => {
    mockFileDelete.mockImplementationOnce(() => { throw new Error('File not found'); });
    const repo = new SQLiteRepository(db);
    const fragment = await repo.insertFragment('有照片', 'file:///mock/documents/gone.jpg');
    // Should NOT throw
    await expect(repo.deleteFragment(fragment.id)).resolves.toBeUndefined();
  });
});

describe('WebRepository — photo_uri 支持', () => {
  let WebRepository: any;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
    jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
    jest.mock('expo-file-system', () => ({
      File: jest.fn().mockImplementation(() => ({
        get exists() { return mockFileExists(); },
        delete: mockFileDelete,
      })),
      Paths: mockPaths,
    }));

    const store: Record<string, string> = {};
    global.localStorage = {
      getItem: jest.fn((k: string) => store[k] ?? null),
      setItem: jest.fn((k: string, v: string) => { store[k] = v; }),
      removeItem: jest.fn((k: string) => { delete store[k]; }),
    } as any;

    const mod = require('../repository');
    WebRepository = mod.WebRepository;
  });

  afterEach(() => mockFileDelete.mockClear());

  it('insertFragment 不传 photoUri 时 photo_uri 为 null', async () => {
    const repo = new WebRepository();
    const f = await repo.insertFragment('hello');
    expect(f.photo_uri).toBeNull();
  });

  it('insertFragment 传 photoUri 时保存到 photo_uri', async () => {
    const repo = new WebRepository();
    const f = await repo.insertFragment('hello', 'file:///web/path.jpg');
    expect(f.photo_uri).toBe('file:///web/path.jpg');
  });

  it('deleteFragment 在 web 平台不调用 file.delete()', async () => {
    const repo = new WebRepository();
    const f = await repo.insertFragment('hello', 'file:///web/path.jpg');
    await repo.deleteFragment(f.id);
    // web 平台无本地文件系统，不应调用
    expect(mockFileDelete).not.toHaveBeenCalled();
  });
});
