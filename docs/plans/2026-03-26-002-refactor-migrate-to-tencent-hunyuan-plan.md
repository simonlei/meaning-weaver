---
title: "refactor: 迁移 AI 服务到腾讯云混元大模型"
type: refactor
status: active
date: 2026-03-26
---

# ♻️ 迁移 AI 服务到腾讯云混元大模型

## Overview

将 Meaning Weaver 的 AI 周报生成服务从 Claude API 迁移到腾讯云混元（Hunyuan）大模型。混元提供 OpenAI 兼容接口，只需修改 `src/services/ai/client.ts` 一个文件。

## 需要购买/开通的腾讯云产品

### 必须操作

| 步骤 | 操作 | 费用 |
|------|------|------|
| 1 | [注册腾讯云账号](https://cloud.tencent.com) + 实名认证 | 免费 |
| 2 | [开通混元大模型服务](https://console.cloud.tencent.com/hunyuan) | 免费 |
| 3 | 控制台左侧 → "API 密钥管理" → 创建 API Key | 免费 |
| 4 | 按 token 用量付费 | 约 **0.01 元/次** 周报生成 |

> ⚠️ 创建 API Key 时选择 **OpenAI 兼容方式**的密钥。密钥只显示一次，立即复制保存。

### 不需要购买

- ❌ 不需要买云服务器
- ❌ 不需要买 GPU 实例
- ❌ 不需要买 API 网关
- ❌ 不需要额外开通其他服务

## 推荐模型

| 模型 | 用途 | 输入价格 | 输出价格 |
|------|------|---------|---------|
| **`hunyuan-turbos-latest`** | ⭐ 生产用（性价比最优） | 0.8 元/百万 tokens | 2 元/百万 tokens |
| `hunyuan-lite` | 开发调试用 | **免费** | **免费** |

### 成本估算

| 用户类型 | 每周碎片 | 每次成本 | 年成本 |
|---------|---------|---------|-------|
| 轻度 (~10条) | ~7K tokens | ~0.01 元 | ~0.5 元 |
| 重度 (~50条) | ~25K tokens | ~0.07 元 | ~3.6 元 |

**对比 Claude API：便宜约 3-5 倍。**

## 代码修改

### 只需改 1 个文件：`src/services/ai/client.ts`

**改动点：**

```typescript
// 改前（Claude）
const CLAUDE_API_KEY = 'YOUR_API_KEY_HERE';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

// 改后（混元）
const API_KEY = 'YOUR_HUNYUAN_API_KEY';
const API_URL = 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions';
const MODEL = 'hunyuan-turbos-latest';
```

**请求格式对比：**

| 维度 | Claude API | 混元 OpenAI 兼容 |
|------|-----------|-----------------|
| 认证 | `x-api-key` header | `Authorization: Bearer` header |
| system prompt | `system` 字段（顶层） | `messages` 数组中 `role: "system"` |
| 请求体 | 自有格式 | OpenAI 标准格式 |
| 响应体 | `data.content[0].text` | `data.choices[0].message.content` |

### 完整修改后的 client.ts

```typescript
// src/services/ai/client.ts
import { ReportContent, ReportContentSchema } from '../../db/schema';
import { Result, Ok, Err } from '../../lib/result';

const API_KEY = 'YOUR_HUNYUAN_API_KEY';
const API_URL = 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions';
const MODEL = 'hunyuan-turbos-latest';

export type AIError =
  | { kind: 'network'; message: string }
  | { kind: 'rate_limit'; retryAfterMs: number }
  | { kind: 'auth'; message: string }
  | { kind: 'invalid_response'; raw: string }
  | { kind: 'no_api_key' };

export async function callClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<Result<ReportContent, AIError>> {
  if (API_KEY === 'YOUR_HUNYUAN_API_KEY') {
    return Err({ kind: 'no_api_key' });
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (response.status === 429) {
      return Err({ kind: 'rate_limit', retryAfterMs: 60000 });
    }

    if (response.status === 401 || response.status === 403) {
      return Err({ kind: 'auth', message: 'Invalid API key' });
    }

    if (!response.ok) {
      return Err({ kind: 'network', message: `HTTP ${response.status}` });
    }

    const data = await response.json();
    // OpenAI 兼容格式：data.choices[0].message.content
    const text = data.choices?.[0]?.message?.content ?? '';

    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const validated = ReportContentSchema.parse(parsed);
      return Ok(validated);
    } catch {
      return Err({ kind: 'invalid_response', raw: text.slice(0, 500) });
    }
  } catch (err) {
    return Err({
      kind: 'network',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
```

### Prompt 无需修改

`src/services/ai/prompts.ts` 不需要任何改动。混元完整支持 system/user role，且中文能力原生优秀。

## Acceptance Criteria

- [ ] `client.ts` 改为调用混元 OpenAI 兼容接口
- [ ] 使用 `hunyuan-turbos-latest` 模型
- [ ] 认证方式改为 `Authorization: Bearer`
- [ ] 响应解析改为 `choices[0].message.content`
- [ ] 用 `hunyuan-lite`（免费）跑通后再切到 `hunyuan-turbos-latest`
- [ ] 周报生成质量验证：中文表达流畅、5 段式结构正确输出 JSON

## 风险

| 风险 | 缓解 |
|------|------|
| 混元输出的 JSON 格式不够稳定 | prompt 中已强制要求纯 JSON 输出 + Zod 校验 + fallback 降级 |
| 混元中文洞察力不如 Claude | 先用真实碎片测试，对比质量再决定 |
| API Key 泄露 | MVP 阶段仅自用；公开发布前必须改为代理服务器 |

## Sources

- [腾讯云混元 OpenAI 兼容接口文档](https://cloud.tencent.com/document/product/1729/111007)
- [混元大模型控制台](https://console.cloud.tencent.com/hunyuan)
- [混元计费说明](https://cloud.tencent.com/document/product/1729/97731)
