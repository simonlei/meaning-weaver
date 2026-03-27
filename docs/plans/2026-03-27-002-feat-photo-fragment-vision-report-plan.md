---
title: "feat: Photo Fragment Input & Hunyuan Vision Weekly Report"
type: feat
status: completed
date: 2026-03-27
origin: docs/brainstorms/2026-03-26-meaning-weaver-brainstorm.md
---

# feat: Photo Fragment Input & Hunyuan Vision Weekly Report

## Overview

用户有时无需文字——一张照片本身就能表达当下心情或瞬间。本特性允许用户在记录碎片时附上一张本地照片（从设备相册读取，不上传服务器），并在生成周报时自动使用腾讯混元视觉模型（`hunyuan-vision-1.5-instruct`）来理解照片内容，将视觉信息融入叙事洞察。

> (see brainstorm: docs/brainstorms/2026-03-26-meaning-weaver-brainstorm.md) — 多模态输入（文字、语音、照片）是 MVP 核心决策之一；照片支持当时明确列入 v2 范围。本计划将其实现。

---

## Problem Statement / Motivation

- 文字有时无法捕捉那一刻的感受；一张照片——午后窗边的光、一盘饭、路边的花——本身即是完整的情绪记录
- 仅支持文字输入限制了"极低摩擦"的输入理念（brainstorm 核心设计哲学）
- 周报 AI 目前只能分析文字碎片，无法感知视觉内容，洞察缺少"画面感"

---

## Proposed Solution

### 输入侧：本地照片附加

在 `FragmentInput.tsx` 的文字框旁增加一个相册图标按钮，调用 `expo-image-picker` 的 `launchImageLibraryAsync`（**只支持相册，不开放拍照**）从设备相册选取一张照片。

- 照片**不上传**任何服务器，以本地文件 URI 形式存储在 `fragments` 表的新字段 `photo_uri TEXT`（可为 null）
- 碎片记录条件：文字或照片至少有一项（二者均可同时存在）
- 选取后在输入区显示缩略图预览（含清除按钮）
- 照片支持仅在原生平台（iOS/Android），Web 平台隐藏图片按钮（`Platform.OS !== 'web'` 门控）

### 存储侧：Schema 扩展（Migration v3）

- `content` 字段保持 `NOT NULL`：照片专用碎片存储空字符串 `""` 作为约定
- `ALTER TABLE fragments ADD COLUMN photo_uri TEXT`（无需重建表）
- 删除含照片碎片时，同步使用 `expo-file-system.deleteAsync` 清理本地文件

### 报告侧：视觉模型按需切换

- 生成周报前，检查本周碎片是否有 `photo_uri != null` 的条目
- **有照片** → 使用 `hunyuan-vision-1.5-instruct`，以 OpenAI multimodal 格式传递 base64 图片
- **全为文字** → 继续使用 `hunyuan-turbos-latest`（更便宜）
- base64 读取发生在 `reportGenerator.ts`，`callHunyuan` 接受可选 `model` 参数和内容部件数组

---

## Technical Considerations

### 新增依赖

| 包 | 用途 |
|---|---|
| `expo-image-picker` | 从相册选取照片（需配置 iOS `NSPhotoLibraryUsageDescription`、Android `READ_MEDIA_IMAGES`） |
| `expo-image-manipulator` | 周报生成前将原图压缩为 ≤1280px / JPEG 0.8，压缩结果仅用于 API 请求，不影响本地存储 |
| `expo-file-system` | 删除碎片时清理本地文件；读取压缩后图片为 base64 |

### 腾讯混元视觉模型

- **推荐模型**：`hunyuan-vision-1.5-instruct`（24k/16k 上下文，通用图像理解）
- **接口**：与文字模型完全相同的 OpenAI 兼容端点，`content` 字段改为数组格式：
  ```json
  {
    "role": "user",
    "content": [
      { "type": "text", "text": "..." },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
    ]
  }
  ```
- **计费**：输入 ¥3/百万 token；一张 1280×720 图片约 924 token ≈ ¥0.003，成本极低
- **限制**：单张图片 base64 ≤ 6MB；分辨率 < 5000px/边；支持 JPEG/PNG/WebP/BMP/TIFF

### Proxy 服务器

`proxy-server.js` 的 `express.json({ limit: '1mb' })` 需提升至 `'10mb'`。虽然本次 Web 平台不支持照片功能，但开发模式下调试原生模拟器时部分请求仍经过 proxy，此调整也为未来 Web 照片支持预留空间。

### Migration 系统整合

当前 `src/db/database.ts`（已废弃）和 `src/db/repository.ts` 存在两套独立的 Migration Runner，共用同一 `PRAGMA user_version`。v3 Migration 必须且只能添加到 `repository.ts → runMigrations()`，并将 `database.ts` 标记为 `@deprecated` 或删除，以防未来冲突。

### 关键架构决策

| 问题 | 决策 | 理由 |
|---|---|---|
| `content` 是否可为 null？ | 否，保持 NOT NULL，照片专用碎片存 `""` | 避免对全代码库做 null-guard，ALTER TABLE 更简单 |
| 模型选择在哪一层？ | `reportGenerator.ts` 检查碎片 → 传 `model` 参数给 `callHunyuan` | `client.ts` 保持纯传输层，易于测试 |
| base64 读取在哪一层？ | `reportGenerator.ts` 在构建 prompt 前读取 | 异步 I/O 集中管理，错误处理清晰 |
| 视觉系统提示如何管理？ | `prompts.ts` 中新增独立常量 `VISION_SYSTEM_PROMPT`，有照片时替换 `SYSTEM_PROMPT` | 避免单一 prompt 过于冗长；保持文字报告质量不变 |
| 每次最多传几张图？ | 5 张（按时间倒序取前 5 张有图的碎片） | 防止 API 请求体过大；与 `notable_moments` 上限对齐 |
| 照片文件读取失败时？ | 降级：跳过该碎片的图片部分，仅传文字（内容为空则跳过整条）| 不因单张图片失败而中断整个周报 |
| Web 平台照片支持？ | 不支持，UI 层通过 `Platform.OS !== 'web'` 隐藏图标 | Web 无本地文件系统概念；当前用户群以移动端为主 |
| 删除碎片时清理文件？ | 是，`useDeleteFragment` hook 中先 FileSystem.deleteAsync，再 DB delete | 避免孤立文件堆积占用存储 |

---

## System-Wide Impact

- **Interaction graph**: 用户点击删除 → `useDeleteFragment` → `FileSystem.deleteAsync(photo_uri)` → `repo.deleteFragment(id)` → TanStack Query invalidate `['fragments']` → 列表刷新
- **Error propagation**: `FileSystem.deleteAsync` 失败（文件已不存在）应静默忽略（`idempotent: true`）；`readAsStringAsync` 失败时日志记录并跳过该图片
- **State lifecycle risks**: 若 DB delete 成功但文件 delete 失败，文件孤立（可接受，下次删除同一文件会报 not found，`idempotent` 处理）；反向（文件删了 DB 失败）通过 `Result<T,E>` 错误返回触发 TanStack Query error state
- **API surface parity**: `Repository` 接口的 `insertFragment` 签名变更影响 `SQLiteRepository`、`WebRepository`、所有调用侧（`useFragments.ts`、`seedData.ts`）
- **Integration test scenarios**: (1) 记录照片碎片 → 验证 `photo_uri` 非空且文件存在；(2) 删除照片碎片 → 验证文件已清理；(3) 混合碎片周报 → 验证使用 vision 模型且 `model_version` 正确存储；(4) 文字专用周报 → 验证仍使用 turbos 模型；(5) 照片文件丢失 → 周报降级为文字分析不崩溃

---

## Acceptance Criteria

### 输入功能

- [x] `FragmentInput.tsx` 在文字框旁显示相册图标按钮（仅原生平台，Web 不显示）
- [x] 点击图标调用 `launchImageLibraryAsync`（**仅相册，不支持拍照**），picker 参数：`mediaTypes: ['images'], allowsEditing: false, quality: 1`（不在选取时压缩，保留原始质量；iOS 自动将 HEIC 转为 JPEG）
- [x] 用户选取照片后，输入区显示缩略图预览（含 ✕ 清除按钮）
- [x] 发送按钮在以下情况可用：文字非空 **或** 已选择照片
- [x] 照片专用碎片（无文字）正常保存，`content = ""`，`photo_uri` 为本地文件 URI
- [x] 文字+照片碎片正常保存，两个字段均有值
- [x] 文字专用碎片行为不变，`photo_uri = null`
- [x] 相册权限被拒时，显示友好的 `Alert.alert` 提示（而非崩溃）
- [x] 发送成功后，文字框和照片预览均被清空
- [x] iOS 相册访问权限：`Info.plist` 配置 `NSPhotoLibraryUsageDescription`
- [x] Android：`READ_MEDIA_IMAGES` 权限声明

### 碎片展示

- [x] `FragmentList` 中含照片的碎片卡片显示照片缩略图
- [x] 照片专用碎片的卡片不显示空文字行（或显示占位符）
- [x] 点击缩略图全屏查看照片（可选，视工作量决定是否进入本次范围）

### 数据存储

- [x] `fragments` 表新增 `photo_uri TEXT`（可为 null），Migration 版本提升至 3
- [x] 旧数据（v1/v2 行）不受影响，`photo_uri = null`
- [x] 删除含照片碎片时，本地文件同步删除（文件不存在时静默忽略）
- [x] `database.ts` 中的废弃 Migration Runner 添加 `@deprecated` 注释，不再添加新 Migration

### 周报生成

- [x] 本周有照片碎片时，使用 `hunyuan-vision-1.5-instruct` 模型
- [x] 本周无照片碎片时，使用 `hunyuan-turbos-latest` 模型（行为不变）
- [x] 照片以 `data:image/jpeg;base64,...` 格式嵌入 multimodal 消息内容数组；**发送前使用 `expo-image-manipulator` 将图片压缩为最长边 ≤ 1280px、JPEG quality 0.8**（约 100–400 KB），压缩结果仅用于本次 API 调用，不覆盖本地存储的原图
- [x] 文字+照片碎片：文字和图片均包含在消息中
- [x] 照片专用碎片（content 为空）：不生成空文字 bullet，仅传图片部件
- [x] 照片文件读取失败时：跳过该图片，仅用文字部分（或整条跳过），周报正常生成
- [x] **每次 API 调用最多携带 5 张照片**（按时间倒序取前 5 张有 `photo_uri` 的碎片）；超出数量的照片碎片仅将 `content` 传入文字 bullet（若 content 为空则整条跳过）
- [x] `createFallbackReport` 中对 `f.content.slice()` 的调用增加空值保护：content 为 `""` 时使用占位文本（如 `"[照片]"`）而非空字符串，避免降级报告出现空白条目
- [x] `Report.model_version` 准确记录实际使用的模型名称
- [x] `SYSTEM_PROMPT` 增加对照片碎片的引导语（独立常量 `VISION_SYSTEM_PROMPT`，在有照片碎片时使用）：「有些碎片包含照片，请从图像中感知情绪、场景与氛围，与文字碎片一同编织叙事」
- [x] 碎片计数标题改为 `📒 共 N 条（含 M 张照片）`（M > 0 时显示）

### 测试

- [x] `insertFragment` 接受可选 `photoUri` 参数的单元测试
- [x] `deleteFragment` 包含文件清理逻辑的单元测试（mock `expo-file-system`）
- [x] `callHunyuan` 接受 `model` 参数和内容数组的单元测试
- [x] `reportGenerator` 的模型选择分支测试（有图片 vs 无图片）
- [x] 每次最多 5 张照片限制的边界测试（第 6 张降级为文字 bullet）
- [x] `createFallbackReport` 对空 content 碎片的空值保护测试（输出 `"[照片]"` 而非空字符串）
- [x] 照片文件读取失败时的降级行为测试

---

## Success Metrics

- 用户可在 30 秒内完成"选照片 → 记录碎片"完整流程（低摩擦原则）
- 含照片碎片的周报中，AI 洞察明确引用了照片中的视觉元素（质量验证）
- 照片碎片比例 > 20% 时，周报质量主观评分不低于纯文字周报

---

## Dependencies & Risks

| 风险 | 可能性 | 影响 | 缓解 |
|---|---|---|---|
| Hunyuan vision 模型对中文场景理解质量不稳定 | 中 | 中 | 先用 `hunyuan-lite` 测试，评估洞察质量再上 prod |
| base64 图片超过 6MB 限制 | 低 | 高 | 发送前用 `expo-image-manipulator` 压缩至 ≤1280px / JPEG 0.8，压缩后通常 < 400KB，远低于 6MB 上限 |
| iOS HEIC 格式处理 | 中 | 中 | `expo-image-manipulator` 输出时强制指定 `format: SaveFormat.JPEG`，天然解决 HEIC 问题 |
| Web 平台用户期望照片功能 | 低 | 低 | Web 版隐藏图标，当前主要用户群为移动端 |
| 周报含多张照片时 API 请求体过大 | 中 | 中 | 每周最多传 5 张照片（`notable_moments` 上限），其余仅传文字描述 |

---

## Implementation File Checklist

### 新增/修改文件

```
package.json                          # 添加 expo-image-picker, expo-image-manipulator, expo-file-system
app.json / app.config.ts              # iOS NSPhotoLibraryUsageDescription, Android permissions
src/db/schema.ts                      # FragmentSchema: 添加 photo_uri?: z.string().optional()
src/db/repository.ts                  # Migration v3 (ALTER TABLE); insertFragment 签名; deleteFragment 清理文件
src/hooks/useFragments.ts             # useCreateFragment: mutationFn 接受 { content, photoUri? }; useDeleteFragment: 调用文件清理
src/components/FragmentInput.tsx      # 添加图片按钮、缩略图预览、发送条件修改
src/components/FragmentList.tsx       # FragmentItem: 条件渲染 photo_uri 缩略图; Alert.alert 替换 window.confirm
src/services/ai/client.ts             # callHunyuan: 接受 model 参数; content 类型改为 string | ContentPart[]
src/services/ai/prompts.ts            # buildUserPrompt: 区分文字/照片碎片输出; 视觉模型系统提示变体
src/services/ai/reportGenerator.ts   # 模型选择逻辑; 压缩后读取 base64（expo-image-manipulator → expo-file-system）; 传递正确 model_version
proxy-server.js                       # express.json limit: '10mb'
src/db/database.ts                    # 添加 @deprecated 注释
```

### 测试文件

```
src/db/__tests__/repository.test.ts           # migration v3, insertFragment with photo, deleteFragment cleanup
src/services/ai/__tests__/client.test.ts      # model param, content array format
src/services/ai/__tests__/reportGenerator.test.ts  # model selection, base64 read failure fallback
src/components/__tests__/FragmentInput.test.tsx    # photo picker flow
```

---

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-26-meaning-weaver-brainstorm.md](../brainstorms/2026-03-26-meaning-weaver-brainstorm.md)
  Key decisions carried forward: (1) 多模态输入是核心 MVP 设计，照片列入 v2；(2) 本地优先隐私策略——照片不上传服务器；(3) 低摩擦输入原则——打开即可记录

### Internal References

- 现有 AI 客户端：`src/services/ai/client.ts`
- Fragment 数据模型：`src/db/schema.ts`
- Migration 系统（使用此系统添加 v3）：`src/db/repository.ts`
- 已有腾讯混元接入计划：[docs/plans/2026-03-26-002-refactor-migrate-to-tencent-hunyuan-plan.md](2026-03-26-002-refactor-migrate-to-tencent-hunyuan-plan.md)
- API Key 设置（v3 依赖此 key 存储）：[docs/plans/2026-03-27-001-feat-hunyuan-api-key-settings-plan.md](2026-03-27-001-feat-hunyuan-api-key-settings-plan.md)

### External References

- 腾讯混元视觉模型文档：https://cloud.tencent.com/document/product/1729/105701
- 混元模型列表与 API 名称：https://cloud.tencent.com/document/product/1729/104753
- 混元定价：https://cloud.tencent.com/document/product/1729/97731
- expo-image-picker 文档：https://docs.expo.dev/versions/latest/sdk/imagepicker/
- expo-file-system 文档：https://docs.expo.dev/versions/latest/sdk/filesystem/
- expo-image-manipulator 文档：https://docs.expo.dev/versions/latest/sdk/imagemanipulator/

### 腾讯混元视觉模型速查

```
模型推荐：  hunyuan-vision-1.5-instruct（通用）
端点：      https://api.hunyuan.cloud.tencent.com/v1/chat/completions
认证：      Authorization: Bearer <Hunyuan API Key>
图片格式：  JPEG/PNG/WebP/BMP/TIFF，≤6MB base64，<5000px/边
Token 计算：H/32 × (W/32 + 1) + 2
定价：      输入 ¥3/百万 token，输出 ¥9/百万 token
```
