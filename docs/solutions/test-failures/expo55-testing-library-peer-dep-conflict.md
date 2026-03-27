---
title: "npm peer dependency conflict: @testing-library/react-native version too low"
category: test-failures
date: 2026-03-27
tags:
  - npm
  - peer-dependencies
  - testing-library
  - expo
  - react-native
---

# npm peer dependency conflict: @testing-library/react-native 版本过低

## Problem

运行 `npm install` 时报错，无法解析依赖树：

```
npm error While resolving: expo-router@55.0.7
npm error Found: @testing-library/react-native@12.9.0
npm error Could not resolve dependency:
npm error peerOptional @testing-library/react-native@">= 13.2.0" from expo-router@55.0.7
npm error Conflicting peer dependency: @testing-library/react-native@13.3.3
```

## Root Cause

安装测试依赖时指定了过低的版本范围 `^12`，并使用了 `--legacy-peer-deps` 绕过冲突检查：

```bash
# 当时执行的命令 — 问题所在
npm install --save-dev @testing-library/react-native@^12 --legacy-peer-deps
```

`--legacy-peer-deps` 会跳过 peer dependency 冲突验证，本地安装成功、测试也能跑，但其他人（或 CI）执行标准 `npm install` 时，npm 严格检查依赖树就会报错。

`expo-router@55` 要求 `@testing-library/react-native >= 13.2.0`，而 v12 系列不满足。

## Solution

升级 `@testing-library/react-native` 到 `^13`：

```bash
npm install --save-dev @testing-library/react-native@^13.2.0 --legacy-peer-deps
```

> 注意：此处仍需 `--legacy-peer-deps` 是因为 `react-test-renderer` 的 peer 依赖，但 `@testing-library/react-native@13` 本身已满足 expo-router 的要求，不会再引发该冲突。

验证修复：

```bash
# 不带 --legacy-peer-deps 的干净安装应当成功（或仅有 react-test-renderer 警告）
npm install
npm test  # 28/28 应当通过
```

## Prevention

1. **不要用 `^12` 指定老版本范围**——添加新测试依赖时，先查官方文档确认与当前 Expo/RN 版本匹配的最低要求。

2. **`--legacy-peer-deps` 是临时逃生口，不是解决方案**——用它安装成功后，检查是否是版本范围写错了，如果是就直接修正版本。

3. **Expo SDK 版本对照表**（截至 2026-03）：

   | Expo SDK | expo-router | @testing-library/react-native |
   |----------|-------------|-------------------------------|
   | 55       | ~55.0.7     | >= 13.2.0                     |

4. **参考命令**——为 Expo 55 项目添加测试依赖的正确姿势：

   ```bash
   npm install --save-dev \
     jest \
     jest-expo@~55.0.0 \
     @testing-library/react-native@^13.2.0 \
     @types/jest \
     --legacy-peer-deps
   ```
