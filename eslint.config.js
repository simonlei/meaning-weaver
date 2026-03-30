// eslint.config.js — ESLint v9 flat config
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', '.expo/**', 'coverage/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // -----------------------------------------------------------------------
      // 捕获 JSX 属性/内容中未转义的引号字符（含中文弯引号 " "）
      // Metro bundler 比 Babel 更严格，内部弯引号会被解析为属性终止符
      // 导致 SyntaxError: Unexpected token，而 Jest 单测不会报错
      // 修复方法：使用 JSX 表达式 {''} 包裹含引号的字符串
      // 参见 docs/solutions/jsx-metro-bundler-unicode-quotes.md
      // -----------------------------------------------------------------------
      'react/no-unescaped-entities': ['error', { forbid: ['"', "'", '>', '}'] }],

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // React
      'react/react-in-jsx-scope': 'off', // React 17+ 不需要显式引入
      'react/prop-types': 'off',         // 用 TypeScript 类型代替 PropTypes
    },
  },
];
