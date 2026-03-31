---
title: "refactor: Remove voice recording and ASR functionality"
type: refactor
status: completed
date: 2026-03-31
---

# refactor: Remove voice recording and ASR functionality

## Overview

移除 Meaning Weaver 中所有语音录制、语音识别（ASR）和音频播放功能，包括设置页面中的语音识别 API 密钥配置。清理所有不再使用的代码、依赖和测试。

## Acceptance Criteria

- [x] 删除 ASR 服务层（`src/services/asr/` 整个目录）
- [x] 删除语音录制 hook（`src/hooks/useVoiceRecorder.ts`）
- [x] 删除音频播放上下文（`src/contexts/AudioPlayerContext.tsx`）
- [x] 从 `FragmentInput` 移除麦克风按钮、录音 UI、ASR 集成
- [x] 从 `FragmentList` 移除音频播放按钮（`AudioPlayButton`）
- [x] 从 `SettingsScreen` 移除语音识别 API 配置区域
- [x] 从 `useSettings.ts` 移除 `useAsrCredentials` / `useSaveAsrCredentials` hooks
- [x] 从 `useFragments.ts` 的 `CreateFragmentInput` 移除 `audioUri` 字段
- [x] 从 `schema.ts` 的 `FragmentSchema` 移除 `audio_uri` 字段
- [x] 从 `repository.ts` 移除 ASR 凭据存储和音频文件清理逻辑
- [x] 从 AI prompts/reportGenerator 移除语音碎片占位符逻辑
- [x] 从 `app/_layout.tsx` 移除 `AudioPlayerProvider`（如存在）
- [x] 删除语音相关测试文件（`__tests__/asrService.test.ts`、`__tests__/repository.audio.test.ts`）
- [x] 更新 `SettingsScreen` 测试移除 ASR 相关用例
- [x] 评估是否可移除 `expo-audio` 和 `@noble/hashes` 依赖
- [x] 更新 `CLAUDE.md` 移除语音相关描述
- [x] 所有测试通过（`npm test`）
- [x] ESLint 无错误（`npm run lint`）

## Implementation Plan

### Phase 1: 删除独立的服务和 hook 文件

完全删除以下文件（无其他依赖）：

| 操作 | 文件 |
|------|------|
| 删除 | `src/services/asr/asrService.ts` |
| 删除 | `src/services/asr/sign.ts` |
| 删除 | `src/services/asr/` 目录 |
| 删除 | `src/hooks/useVoiceRecorder.ts` |
| 删除 | `src/contexts/AudioPlayerContext.tsx` |

### Phase 2: 删除测试文件

| 操作 | 文件 |
|------|------|
| 删除 | `__tests__/asrService.test.ts` |
| 删除 | `__tests__/repository.audio.test.ts` |

### Phase 3: 编辑组件 — FragmentInput

**文件：`src/components/FragmentInput.tsx`**

移除内容：
- `useVoiceRecorder` import 及所有录音相关 state
- `useAsrCredentials` import 和使用
- `transcribeAudio` import 和调用
- 麦克风按钮（🎙）及其 `handleMicPress()` handler
- 录音中 UI（计时器、脉冲动画、"录音中，最长 60 秒"）
- 音频预览 chip（🎵 + 时长 + 删除按钮）
- ASR 转录 loading 状态和错误处理 Alert
- `audioUri` 从 fragment 创建参数中移除
- 更新 `canSend` 逻辑：移除 `|| audioUri` 条件

### Phase 4: 编辑组件 — FragmentList

**文件：`src/components/FragmentList.tsx`**

移除内容：
- `AudioPlayButton` 组件整体
- `useAudioPlayer`、`useAudioPlayerStatus` imports（来自 expo-audio）
- `useAudioPlayerContext` import 和使用
- Fragment item 中的 `（语音记录）` 占位显示
- 音频播放 UI（▶/⏸ 按钮、进度条、时间显示）

### Phase 5: 编辑设置页面

**文件：`src/features/settings/SettingsScreen.tsx`**

移除内容：
- "语音识别 API" 配置整个 section
- SecretId / SecretKey 输入框
- 保存/清除凭据按钮
- 腾讯云控制台链接
- 隐私声明文字
- `useAsrCredentials` / `useSaveAsrCredentials` import

**文件：`src/features/settings/__tests__/SettingsScreen.test.tsx`**

- 移除 ASR 凭据相关测试用例

### Phase 6: 编辑 Hooks

**文件：`src/hooks/useSettings.ts`**

- 删除 `settingsKeys.asrCredentials()` query key
- 删除 `useAsrCredentials()` hook
- 删除 `useSaveAsrCredentials()` hook

**文件：`src/hooks/useFragments.ts`**

- 从 `CreateFragmentInput` 类型移除 `audioUri` 字段
- 从 `useCreateFragment` mutation 调用中移除 `audioUri` 传递

### Phase 7: 编辑数据层

**文件：`src/db/schema.ts`**

- 从 `FragmentSchema` 移除 `audio_uri: z.string().nullable()`
- Fragment 类型将不再包含 `audio_uri`

**文件：`src/db/repository.ts`**

- 移除 `getAsrCredentials()` / `setAsrCredentials()` 方法（两个实现）
- 移除 `mw_asr_secret_id` / `mw_asr_secret_key` 存储键
- 从 `insertFragment()` 移除 `audioUri` 参数
- 从 `deleteFragment()` 移除音频文件清理逻辑
- **注意：保留 SQLite migration v4**（`ALTER TABLE fragments ADD COLUMN audio_uri TEXT`），因为已有用户的数据库可能已应用此迁移。列保留但不再使用。

### Phase 8: 编辑 AI 层

**文件：`src/services/ai/prompts.ts`**

- 移除第 127-129 行 `if (f.audio_uri)` 语音记录占位逻辑

**文件：`src/services/ai/reportGenerator.ts`**

- 移除 `safeContent()` 中 `'[语音]'` 音频占位逻辑
- 移除 fallback report 中 `[语音]` 占位

### Phase 9: 编辑 App Layout

**文件：`app/_layout.tsx`**

- 移除 `AudioPlayerProvider` wrapper（如存在）

### Phase 10: 清理依赖和文档

**文件：`package.json`**

评估移除：
- `@noble/hashes` — 仅用于 ASR 签名，如无其他使用则移除
- `expo-audio` — 仅用于录音和播放，如无其他使用则移除

**文件：`CLAUDE.md`**

更新以下内容：
- Data Flow 描述中移除 "Tencent ASR (speech-to-text)"
- Key Layers 中移除 `src/services/asr/` 描述
- Hooks 列表中移除 `useVoiceRecorder`
- 移除 proxy-server ASR 相关描述（如有）
- Architecture / Key Patterns 中移除语音相关内容

**文件：`proxy-server.js`**

- 检查是否有未使用的 ASR 签名路由，如有则移除

### Phase 11: 验证

```bash
npm test            # 所有测试通过
npm run lint        # 无 ESLint 错误
npm run web         # Web 版本正常启动
```

## Technical Considerations

- **数据库迁移 v4 保留**：`audio_uri` 列已存在于用户设备数据库中，不需要新的迁移来删除列（SQLite 不支持 DROP COLUMN 在旧版本）。列保留但代码不再读写。
- **已有音频文件**：用户设备上 `documentDirectory/audio/` 中的录音文件不会被主动清理，但不再被引用。可作为后续版本的清理任务。
- **Fragment 列表兼容性**：旧 fragment 如果有 `audio_uri`，在 schema 移除后查询时该字段会被 Zod `.parse()` 忽略（因为 Zod 默认 strip unknown keys），不会报错。

## Sources

- Voice feature plan: `docs/plans/2026-03-27-003-feat-voice-input-asr-playback-plan.md`
- JSX Unicode quotes gotcha: `docs/solutions/jsx-metro-bundler-unicode-quotes.md`
