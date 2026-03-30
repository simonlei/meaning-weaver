---
title: 语音输入 + 腾讯云 ASR + 音频回放
type: feat
status: completed
date: 2026-03-27
origin: docs/brainstorms/2026-03-26-meaning-weaver-brainstorm.md
---

# ✨ feat: 语音输入 + 腾讯云 ASR + 音频回放

## Overview

在现有文字和照片输入基础上，增加语音录制作为第三种碎片输入方式。用户录音结束后，调用腾讯云**一句话识别 (SentenceRecognition) API** 将语音转文字，转录文本填入现有的 `TextInput`（可编辑）后按原有文字路径生成周报。已录制的语音可在碎片列表中回放。

> **来自 Brainstorm（see brainstorm: docs/brainstorms/2026-03-26-meaning-weaver-brainstorm.md）**
> 多模态输入（文字 + 语音 + 照片）是 MVP 核心体验之一；语音录制在 MVP Scope 中被明确列出。

---

## Problem Statement / Motivation

- 手机键盘内置语音输入虽然零代码可用，但体验分散、无法保留原始录音、无法回放
- 用户在通勤、散步等场景无法打字，语音是最低摩擦的输入方式
- 保留原始音频 + 允许回放，可大幅提升碎片的情绪还原度（文字丢失语气和情感信息）
- 腾讯云是项目已有的 AI 服务商（Hunyuan），统一在同一云账号下可简化权限管理

---

## Proposed Solution

### 核心流程

```
用户按住🎙 录音
  → 松手停止录音（或达到 60s 上限自动停止）
  → 音频文件保存到本地 documentDirectory/audio/
  → 调用代理服务器 /api/transcribe（腾讯云 ASR 签名在服务端完成）
  → 转录文本填入 TextInput（用户可编辑）
  → 音频预览 chip 显示在输入栏上方（含时长 + ✕ 移除按钮）
  → 点击「记录」保存 fragment（content = 文本，audio_uri = 本地路径）

碎片列表中带 audio_uri 的碎片显示 ▶ 播放按钮
  → 点击播放/暂停，同一时间只有一条音频播放
```

### 关键技术选型

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 录音库 | `expo-audio`（SDK 55 新 API） | `expo-av` 已进入维护模式，expo-audio 是 SDK 53+ 推荐替代 |
| 腾讯 ASR 产品 | **一句话识别 SentenceRecognition**（同步，≤60s） | 语音碎片本质是短语音；同步返回、低延迟、无需异步轮询 |
| ASR 鉴权方式 | **代理服务器**处理 TC3-HMAC-SHA256 签名 | SecretKey 绝不进入客户端 App Bundle；与现有 proxy-server.js 架构一致 |
| 录音格式 | M4A/AAC 16kHz 单声道 32kbps | Tencent ASR 支持 m4a；16kHz 单声道是语音识别最佳格式；文件最小 |
| 播放器状态管理 | React Context（AudioPlayerContext） | 保证全局单一播放实例，避免多条音频同时播放 |

---

## Technical Considerations

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  FragmentInput.tsx  (UI 层)                         │
│  ┌──────────────────────────────────────────────┐  │
│  │  VoiceRecorderButton (新增)                  │  │
│  │  ← useVoiceRecorder hook                     │  │
│  │  ← transcribeAudio(uri) → asrService.ts      │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
        ↓ audioUri + transcribedText
┌─────────────────────────────────────────────────────┐
│  useCreateFragment (useFragments.ts)                │
│  ← Repository.insertFragment(content, photoUri,    │
│                               audioUri)  ← 新增参数 │
└─────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────┐
│  SQLite fragments 表  (migration v4: audio_uri TEXT) │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  FragmentList → FragmentItem (UI 层)                │
│  ← AudioPlayerContext (单一播放实例管理)             │
│  ← useAudioPlayer(fragment.audio_uri)               │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  proxy-server.js  ← 新增 /api/transcribe 路由       │
│  → TC3-HMAC-SHA256 签名                             │
│  → https://asr.tencentcloudapi.com                  │
│    Action: SentenceRecognition                      │
└─────────────────────────────────────────────────────┘
```

### 腾讯云 ASR API 关键参数

```
Endpoint:  https://asr.tencentcloudapi.com
Action:    SentenceRecognition
Version:   2019-06-14
Auth:      TC3-HMAC-SHA256（SecretId + SecretKey）
SourceType: 1（Base64 内联）
VoiceFormat: m4a
EngSerViceType: 16k_zh
Max:       60s / 3MB
Free Quota: 5,000 次/月
Cost:      ¥0.015/次（后付费）；¥72 = 30,000 次预付包
```

### 数据库变更（migration v4）

```sql
ALTER TABLE fragments ADD COLUMN audio_uri TEXT;
```

> 幂等写法同 v3 的 `photo_uri` 迁移，使用 `PRAGMA user_version` 版本号控制。

### 隐私声明

本功能首次使用时必须向用户展示一次性告知弹窗：
*"语音录音将发送至腾讯云服务器进行转录，转录完成后服务器不保留音频。原始音频仅存储在您的设备本地。"*

---

## System-Wide Impact

### Interaction Graph

```
用户点击「记录」(带 audioUri)
  → useCreateFragment.mutate({ content, photoUri, audioUri })
    → Repository.insertFragment(content, photoUri, audioUri)
      → SQLite INSERT（新增 audio_uri 列）
        → TanStack Query invalidateQueries(fragmentKeys.all)
          → FragmentList re-render
            → FragmentItem 渲染 ▶ 播放按钮（当 audio_uri 非 null）

用户删除碎片（带 audioUri）
  → deleteFragment(id)
    → FileSystem.deleteAsync(audio_uri)   ← 新增
    → FileSystem.deleteAsync(photo_uri)   ← 已有
    → SQLite DELETE
      → TanStack Query invalidate
```

### Error Propagation

```
ASR 失败路径:
  fetch /api/transcribe
    → 网络超时 → AIError{ kind: 'network' } → Alert("识别失败，是否保存语音无文字？")
    → 401/403   → AIError{ kind: 'auth' }    → Alert("ASR 凭证无效，请检查设置")
    → 429       → AIError{ kind: 'rate_limit' } → Alert("识别频率超限，请稍后重试")
    → 音频过大  → AIError{ kind: 'invalid_response' } → Alert("录音过长，请在60秒内")
```

> 所有 ASR 错误遵循现有 `Result<T, E>` 模式（`src/lib/result.ts`）。

### State Lifecycle Risks

- 录音中途 App 被切换到后台：`expo-audio` 的 `AudioSession` 中断事件必须被监听，触发 `recorder.stop()` 以避免文件损坏
- 录音文件写入成功但转录失败：音频文件保留在本地，用户可选择保存"语音记录（未转录）"或丢弃
- `deleteFragment` 文件清理失败（文件已不存在）：使用 `idempotent: true` 参数，不崩溃

### API Surface Parity

| 接口 | 是否需要变更 |
|------|------------|
| `Repository` interface | ✅ `insertFragment` 新增 `audioUri?: string` 参数 |
| `SQLiteRepository.insertFragment` | ✅ 同上 |
| `SQLiteRepository.deleteFragment` | ✅ 新增 audio 文件清理 |
| `WebRepository.insertFragment` | ✅ 传递 audioUri（存入 localStorage 对象） |
| `WebRepository.deleteFragment` | ✅ 跳过文件清理（Web 无文件系统） |
| `FragmentSchema` (Zod) | ✅ 新增 `audio_uri: z.string().nullable().optional()` |
| `buildUserPrompt` (prompts.ts) | ✅ 空 content 的语音碎片增加 `（语音记录）` 占位 |
| `createFallbackReport` | ✅ 同上，延伸现有 `[照片]` 模式 |

---

## Acceptance Criteria

### 功能需求

- [x] **AC-1.1** `FragmentInput` 在 iOS/Android 上显示 🎙 麦克风按钮，Web 上隐藏（同 `Platform.OS !== 'web'` 现有模式）
- [x] **AC-1.2** 首次使用触发系统麦克风权限申请，中文说明文字
- [x] **AC-1.3** 权限拒绝时展示 Alert，不开始录音
- [x] **AC-1.4** 录音中显示计时器（`00:23`）和脉冲动画，photo 和 send 按钮禁用
- [x] **AC-1.5** 录音达到 **60 秒**自动停止并通知用户
- [x] **AC-1.6** 录音文件保存至 `FileSystem.documentDirectory + 'audio/'`，格式 M4A 16kHz 单声道
- [x] **AC-2.1** 停止录音后立即调用 `/api/transcribe`，显示 "正在识别..." loading 态
- [x] **AC-2.2** 转录成功后文本填入 `TextInput`（可编辑）；音频时长 chip 显示在输入栏上方
- [x] **AC-2.3** 转录失败时按错误类型展示 Alert（网络/鉴权/频率限制），提供「重试 / 保存无文字语音 / 丢弃」三选一
- [x] **AC-2.4** ASR 凭证未配置时显示提示并链接到设置页
- [x] **AC-3.1** `FragmentSchema` Zod 定义包含 `audio_uri: z.string().nullable().optional()`
- [x] **AC-3.2** SQLite migration v4 幂等地添加 `audio_uri TEXT` 列
- [x] **AC-3.3** `canSend = text.trim().length > 0 || photoUri !== null || audioUri !== null`
- [x] **AC-3.4** 点击 ✕ 移除音频 chip 时，本地文件被删除，状态重置
- [x] **AC-4.1** `FragmentItem` 在 `audio_uri` 非 null 时显示 ▶/⏸ 播放按钮和进度条
- [x] **AC-4.2** 播放 A 时自动停止 B（`AudioPlayerContext` 单一实例）
- [x] **AC-4.3** 文件丢失时隐藏播放按钮，不崩溃
- [x] **AC-5.1** `deleteFragment` 在删除 DB 行前清理 `audio_uri` 文件（镜像 `photo_uri` 现有逻辑）
- [x] **AC-5.2** 空 `content` 的语音碎片在 `FragmentList` 显示 `（语音记录）` 占位文本
- [x] **AC-6.1** `buildUserPrompt` 将空 content 语音碎片输出为 `（语音记录，约 NN 秒）`
- [x] **AC-7.1** `SettingsScreen` 新增"语音识别 API"区块，含 SecretId + SecretKey 输入框
- [ ] **AC-7.2** 首次使用语音输入时展示隐私告知弹窗（一次性）
- [x] **AC-8.1** `app.json` 添加 `ios.infoPlist.NSMicrophoneUsageDescription`（中文）
- [x] **AC-8.2** `app.json` 添加 `android.permissions: ["RECORD_AUDIO"]` 及 expo-audio 插件

### 非功能需求

- [ ] 转录请求 p95 < 2s（短语音，≤10s）
- [ ] 录音文件大小：60s M4A ≤ 240KB（16kHz 单声道 32kbps）
- [ ] Web 平台上所有语音功能静默禁用，不报错

---

## Success Metrics

| 指标 | 目标 |
|------|------|
| 语音碎片占比 | 新增碎片中 ≥20% 使用语音输入（验证需求真实性） |
| 转录成功率 | ≥95%（网络正常情况下） |
| 录音→文本延迟 | p95 < 3s（含网络往返） |
| 用户编辑率 | 转录文本被用户修改的比例（质量参考指标） |

---

## Dependencies & Risks

### 依赖

| 依赖 | 类型 | 备注 |
|------|------|------|
| `expo-audio` | NPM 新增 | 需 `npx expo install expo-audio` |
| 腾讯云 ASR 账号 | 外部服务 | 同一腾讯云账号，开通"语音识别"服务，获取 SecretId + SecretKey |
| `proxy-server.js` 扩展 | 内部 | 新增 `/api/transcribe` 路由，添加 TC3-HMAC-SHA256 签名实现 |
| Migration v4 | DB | 不可逆（但非破坏性） |

### 风险

| 风险 | 等级 | 缓解 |
|------|------|------|
| TC3-HMAC-SHA256 签名实现复杂 | 🔴 高 | 使用 `tencentcloud-sdk-nodejs` 官方包在服务端处理，避免手写签名 |
| 隐私原则冲突（语音上传云端） | 🔴 高 | 首次使用强制告知弹窗；仅发送音频不保留原文；明确写入设置页说明 |
| 两套腾讯云凭证（Hunyuan Key + SecretId/Key）令用户困惑 | 🟡 中 | Settings 页分区清晰标注，附腾讯云控制台直链 |
| `expo-audio` SDK 55 录音 + 播放 API 稳定性 | 🟡 中 | 对照官方 SDK 55 文档验证 `useAudioRecorder` + `useAudioPlayer` 同时使用场景 |
| Android 录音格式兼容性 | 🟡 中 | 显式配置 `AndroidOutputFormat.MPEG_4 + AndroidAudioEncoder.AAC` 保证一致性 |
| App 切换到后台时录音中断 | 🟡 中 | 监听 AudioSession 中断事件，graceful stop |

---

## Implementation Phases

### Phase 1：录音基础设施

**文件改动：**

- `package.json` — 添加 `expo-audio`
- `app.json` — 麦克风权限声明 + expo-audio 插件配置
- `src/hooks/useVoiceRecorder.ts`（新建） — 封装 `useAudioRecorder`，返回 `{ startRecording, stopRecording, isRecording, durationMs, metering, audioUri }`
- `src/services/asr/asrService.ts`（新建） — `transcribeAudio(localUri): Promise<Result<string, AIError>>`，调用代理服务器 `/api/transcribe`

**验收：** 可录音 → 本地保存 M4A → 上传代理 → 返回文字

---

### Phase 2：输入 UI 集成

**文件改动：**

- `src/components/FragmentInput.tsx` — 新增 🎙 按钮，管理 `audioUri` 状态，录音中禁用其他按钮，添加音频 chip 预览
- `src/hooks/useFragments.ts` — `useCreateFragment` 传递 `audioUri`
- `proxy-server.js` — 新增 `/api/transcribe` 路由 + TC3 签名逻辑（使用 `tencentcloud-sdk-nodejs` 或手写签名）
- `src/db/repository.ts` — `insertFragment` 接受 `audioUri` 参数；migration v4；`deleteFragment` 清理 audio 文件
- `src/db/schema.ts` — `FragmentSchema` 新增 `audio_uri` 字段

**验收：** 端到端流程 — 录音 → 识别 → 可编辑文本 → 保存含 audio_uri 的碎片

---

### Phase 3：播放 + 设置 + 周报集成

**文件改动：**

- `src/contexts/AudioPlayerContext.tsx`（新建） — 全局单一播放实例管理
- `src/components/FragmentItem.tsx`（或 `FragmentList.tsx`） — 播放按钮 + 进度条 UI
- `src/features/settings/SettingsScreen.tsx` — 新增 ASR SecretId/SecretKey 输入区块
- `src/services/ai/prompts.ts` — `buildUserPrompt` 空 content 语音碎片占位
- `src/services/ai/reportGenerator.ts` — `createFallbackReport` 扩展 `[语音]` 占位

**验收：** 可播放录音；Settings 可配置凭证；周报生成包含语音碎片标记；隐私告知弹窗一次性展示

---

## Documentation Plan

- `proxy-server.js` 添加注释说明 TC3 签名流程
- `README.md`（或项目文档）补充腾讯云账号配置步骤：开通语音识别 → 获取 SecretId + SecretKey → 填入 App 设置

---

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-26-meaning-weaver-brainstorm.md](docs/brainstorms/2026-03-26-meaning-weaver-brainstorm.md)
  - 关键决策继承：多模态输入（文字+语音+照片）是 MVP 核心；本地优先隐私策略；反效率设计哲学

### Internal References

- 现有输入实现：`src/components/FragmentInput.tsx`（文字+照片）
- 现有 AI 客户端模式：`src/services/ai/client.ts`（Hunyuan OpenAI-compat）
- 照片存储 + 清理模式：`src/db/repository.ts`（photo_uri 处理）
- Migration 模式：`src/db/repository.ts`（v3 photo_uri migration）
- 错误类型定义：`src/services/ai/client.ts:AIError`
- Result 模式：`src/lib/result.ts`
- 代理服务器：`proxy-server.js`

### External References

- [expo-audio SDK 55 文档](https://docs.expo.dev/versions/v55.0.0/sdk/audio/)
- [腾讯云一句话识别 API](https://cloud.tencent.com/document/product/1093/35646)
- [TC3-HMAC-SHA256 签名算法](https://www.tencentcloud.com/document/product/1093/38347)
- [tencentcloud-sdk-nodejs（服务端签名）](https://github.com/TencentCloud/tencentcloud-sdk-nodejs)
- [腾讯云 ASR 计费说明](https://cloud.tencent.com/document/product/1093/35686)

### Related Plans

- [2026-03-27-001 Hunyuan API Key Settings](docs/plans/2026-03-27-001-feat-hunyuan-api-key-settings-plan.md)（Settings 页面架构参考）
- [2026-03-27-002 Photo Fragment Vision Report](docs/plans/2026-03-27-002-feat-photo-fragment-vision-report-plan.md)（照片 URI 存储/清理模式参考）
