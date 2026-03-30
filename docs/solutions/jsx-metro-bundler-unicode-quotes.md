---
title: JSX 属性中的 Unicode 弯引号导致 Metro 打包失败
tags: [jsx, metro, bundler, unicode, react-native, expo]
date: 2026-03-30
symptom: SyntaxError in Metro bundler but Jest tests pass
---

# JSX 属性中的 Unicode 弯引号导致 Metro 打包失败

## 症状

Metro bundler（Expo 打包）报 `SyntaxError: Unexpected token`，错误指向 JSX
属性值中的中文弯引号位置，但 Jest 单元测试完全通过：

```
SyntaxError: /path/to/Component.tsx: Unexpected token (335:51)

> 335 |   placeholder="补充说明（可选，如"这是我的朋友小李"）"
      |                                    ^
```

## 根本原因

JSX 属性值使用 ASCII 双引号 `"..."` 包裹时，Metro/Hermes parser
会把内部出现的 Unicode 弯引号 `"` (U+201C) / `"` (U+201D) 当作
属性值结束符，产生语法错误。

Jest 使用的 Babel transform 容错性更高，因此单测通过，但
Metro 严格 parser 下报错。这类错误**不会被单元测试捕获**。

## 解决方案

将含有弯引号（或任何非 ASCII 引号类字符）的 JSX 属性值改用
JSX 表达式语法 `{...}` 包裹：

```tsx
// ❌ 错误：双引号属性值内含弯引号
placeholder="补充说明（可选，如"这是我的朋友小李"）"

// ✅ 正确：JSX 表达式，内部弯引号为普通字符
placeholder={'补充说明（可选，如"这是我的朋友小李"）'}

// ✅ 也可以：转义为 Unicode 转义序列
placeholder={'补充说明（可选，如\u201c这是我的朋友小李\u201d）'}
```

## 预防措施

### 1. ESLint 规则

在 `.eslintrc.js` 中启用 `react/no-unescaped-entities`：

```js
rules: {
  'react/no-unescaped-entities': ['error', { forbid: ['"', "'", '>', '}'] }],
}
```

此规则会在 CI/本地 lint 阶段捕获 JSX 中未转义的引号字符。

### 2. 开发原则

- JSX 属性值中含有中文内容时，**优先使用 `{...}` 表达式语法**
- 凡含有 `"` `"` `'` `'` `「」` 等引号类字符，必须用 `{...}` 包裹
- 不能仅依赖单元测试验证 JSX 语法正确性——Metro bundler 比 Babel 更严格

### 3. CI 验证

构建错误只在 Metro 打包时暴露。确保 CI pipeline 包含实际的
Expo build 步骤（而不只是 `jest`），才能在合并前捕获此类问题。

## 实际案例

**文件**：`src/components/FragmentInput.tsx`
**PR**：`feat/photo-description-pipeline`
**修复 commit**：`3145c03`

```tsx
// 修复前
placeholder="补充说明（可选，如"这是我的朋友小李"）"

// 修复后
placeholder={'补充说明（可选，如\u201c这是我的朋友小李\u201d）'}
```
