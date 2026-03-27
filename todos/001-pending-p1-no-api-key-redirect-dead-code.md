---
status: complete
priority: p1
issue_id: "001"
tags: [code-review, architecture, bug]
---

# no_api_key 重定向是死代码

## Problem Statement

`ReportList.tsx` 期望在 `generateWeeklyReport` 返回 `no_api_key` 错误时跳转到设置页，但 `reportGenerator.ts` 内部已将所有 AI 错误降级为 fallback 报告并返回 `Ok`——`ReportList.tsx` 中的判断分支永远不会执行。

**影响：** 用户未配置 API Key 时将静默收到一份本地模板报告，无法得到"请配置 API Key"的引导。

## Findings

`reportGenerator.ts:70-86`：

```ts
let reportContent: ReportContent;
if (result.ok) {
  reportContent = result.value;
} else {
  console.warn('AI generation failed, using fallback:', result.error); // ← no_api_key 走到这里
  reportContent = createFallbackReport(fragments);
}
await repo.insertReport(...);
return Ok(reportContent); // ← 永远返回 Ok
```

`ReportList.tsx:81-84`（死代码）：

```ts
if (!result.ok && result.error.kind === 'no_api_key') {
  router.push('/(tabs)/settings'); // ← 永远不会执行
}
```

## Proposed Solutions

### Option A（推荐）：`no_api_key` 时不降级，直接向上传播

在 `reportGenerator.ts` 中，仅对网络/鉴权/解析错误使用 fallback，`no_api_key` 直接返回 `Err`：

```ts
const result = await callClaude(apiKey, SYSTEM_PROMPT, userPrompt);

if (!result.ok) {
  if (result.error.kind === 'no_api_key') {
    return Err(result.error); // 不降级，让调用方处理
  }
  // 其余错误才降级
  console.warn('AI generation failed, using fallback:', result.error);
  const reportContent = createFallbackReport(fragments);
  await repo.insertReport(targetWeek, reportContent, ...);
  return Ok(reportContent);
}
```

### Option B：返回更丰富的结果，携带 `usedFallback` 和原因

修改返回类型携带元数据，但会增加调用方复杂度，不推荐。

## Acceptance Criteria

- [ ] 用户未配置 API Key 时，生成周报的操作跳转到设置页（而非静默显示模板报告）
- [ ] 网络/鉴权/解析错误时仍然降级到本地模板（行为不变）
- [ ] `reportGenerator.ts` 的返回类型与实际行为匹配

## Work Log

- 2026-03-27：代码审查发现，来自 security-sentinel + architecture-strategist + code-simplicity-reviewer
