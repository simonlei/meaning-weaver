// Mock for expo-file-system new API (File / Directory / Paths classes)
const mockFileDelete = jest.fn();
const mockFileBase64 = jest.fn().mockResolvedValue('base64encodedstring');
const mockFileExists = jest.fn().mockReturnValue(true);

const File = jest.fn().mockImplementation(() => ({
  get exists() { return mockFileExists(); },
  delete: mockFileDelete,
  base64: mockFileBase64,
  base64Sync: jest.fn().mockReturnValue('base64encodedstring'),
  text: jest.fn().mockResolvedValue(''),
  textSync: jest.fn().mockReturnValue(''),
}));

const mockDirCreate = jest.fn();
const mockDirExists = jest.fn().mockReturnValue(true);

const Directory = jest.fn().mockImplementation(() => ({
  get exists() { return mockDirExists(); },
  create: mockDirCreate,
  list: jest.fn().mockReturnValue([]),
  delete: jest.fn(),
}));

const Paths = {
  document: 'file:///mock/documents',
  cache: 'file:///mock/cache',
  join: (...parts) => parts.join('/'),
  basename: (p) => p.split('/').pop(),
};

module.exports = {
  File,
  Directory,
  Paths,
  // expose mocks for tests that need to inspect/configure them
  __mockFileDelete: mockFileDelete,
  __mockFileBase64: mockFileBase64,
  __mockFileExists: mockFileExists,
  __mockDirCreate: mockDirCreate,
  __mockDirExists: mockDirExists,
};
