// Mock for expo-file-system
const deleteAsync = jest.fn().mockResolvedValue(undefined);
const readAsStringAsync = jest.fn().mockResolvedValue('base64encodedstring');
const writeAsStringAsync = jest.fn().mockResolvedValue(undefined);
const getInfoAsync = jest.fn().mockResolvedValue({ exists: true, isDirectory: false });

module.exports = {
  deleteAsync,
  readAsStringAsync,
  writeAsStringAsync,
  getInfoAsync,
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
  documentDirectory: 'file:///mock/documents/',
  cacheDirectory: 'file:///mock/cache/',
};
