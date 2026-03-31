module.exports = {
  testEnvironment: 'node',
  globals: {
    __DEV__: true,
  },
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        configFile: false,
        presets: [
          ['D:/work/meaning-weaver/node_modules/expo/internal/babel-preset.js', { lazyImports: false }],
        ],
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|uuid|zod)',
  ],
  moduleNameMapper: {
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.js',
    '^expo-audio$': '<rootDir>/__mocks__/expo-audio.js',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^expo-constants$': '<rootDir>/__mocks__/expo-constants.js',
    '^expo/src/winter/(.*)$': '<rootDir>/__mocks__/expo-winter-runtime.js',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
