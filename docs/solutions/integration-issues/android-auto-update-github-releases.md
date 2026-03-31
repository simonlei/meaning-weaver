---
title: "Android 应用内自动更新检查（GitHub Releases）"
category: integration-issues
date: 2026-03-31
tags:
  - android
  - auto-update
  - github-api
  - expo
  - react-native
modules:
  - src/services/update/updateService.ts
  - app/_layout.tsx
  - .github/workflows/release-apk.yml
---

# Android 应用内自动更新检查（GitHub Releases）

## 问题

React Native/Expo 应用通过 GitHub Releases 分发 APK（不上 Play Store），用户无法得知何时有新版本，只能手动去 GitHub 页面查看。需要在应用内实现启动时自动检查更新并提醒用户。

## 核心挑战

1. **版本号不统一** — `app.json`（1.0.0）、`package.json`（0.1.0）和 Git tag（v0.0.6）三处版本号不一致
2. **运行时获取版本号** — 需要在 APK 中读到与 Release tag 一致的版本号
3. **安全性** — 防止 API 响应被篡改导致跳转恶意 URL

## 解决方案

### 架构

```
启动 App → useEffect → checkForUpdate()
  ├─ fetch GitHub /releases/latest（静默，不阻塞 UI）
  ├─ Zod 校验响应 → semver 比较
  │   ├─ 无更新 → 静默
  │   └─ 有更新 → Alert.alert()
  │       ├─ 「立即更新」→ Linking.openURL(release 页面)
  │       └─ 「稍后」→ 关闭
  └─ 任何错误 → 静默忽略
```

### 关键实现

**更新服务**（`src/services/update/updateService.ts`）：
- 使用项目的 `Result<T, E>` 模式 + 判别联合错误类型
- `fetch` + `AbortController` 超时（与 `ai/client.ts` 一致）
- `Platform.OS` 和 `__DEV__` guard 防止非生产环境触发
- URL 安全校验：验证域名为 `github.com`

**版本号同步**（CI）：
- 在 `.github/workflows/release-apk.yml` 中添加步骤
- 从 Git tag 提取版本号 → 通过 `process.env` 传入 Node 脚本 → 写入 `app.json`
- 关键：用环境变量而非 shell 字符串插值，避免注入风险

**版本比较**（`compareSemver`）：
- 按 `.` 分段转为数字逐段比较
- 去掉 `v` 前缀，去掉 `-beta` 等预发布后缀
- 不引入第三方 semver 库

## Code Review 发现的关键问题

| 问题 | 严重性 | 修复方式 |
|------|--------|----------|
| CI 中 `$TAG` 直接插入 `node -e` 字符串 → shell 注入 | P1 | 改用 `process.env` + GitHub Actions `env:` |
| `response.json()` 未经 Zod 验证 | P1 | 添加 `GitHubReleaseSchema` |
| `startsWith` URL 校验可被路径穿越绕过 | P2 | 改用 `new URL()` 结构化校验 |
| Promise 缺少 `.catch()` | P2 | 添加空 `.catch()` |
| 预发布标签 `1.0.0-beta` 解析为 NaN | P2 | strip `-` 后缀再比较 |

## 预防建议

1. **CI 中永远不要将 shell 变量插入 `node -e` 字符串**，用 `process.env` 或 `process.argv` 传参
2. **任何外部 API 响应都用 Zod 校验**，即使是 GitHub 这样可信的来源
3. **URL 校验用 `new URL()` 解析**，不要依赖 `startsWith` 字符串匹配
4. **火并忘 (fire-and-forget) 的 Promise 必须加 `.catch()`**，尤其在 root 组件中
