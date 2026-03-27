---
status: pending
priority: p2
issue_id: "016"
tags: [code-review, security, proxy, photo-feature]
---

# 代理服务器绑定 `0.0.0.0` + 通配符 CORS，任何局域网设备可滥用

## Problem Statement

`proxy-server.js` 监听所有网络接口（`0.0.0.0`）且 CORS 允许任意来源（`*`）。这意味着：
1. 同一 Wi-Fi 下的任意设备可通过该代理向腾讯混元 API 发送请求，消耗 API 配额
2. 同机器上打开的任意网页都可通过 CORS 发起跨域请求到代理

这是一个开发代理，但放在 Wi-Fi 环境中风险实际存在。

## Findings

**File:** `proxy-server.js`

```js
app.listen(PORT, '0.0.0.0', () => { ... });  // 监听所有接口

res.header('Access-Control-Allow-Origin', '*');  // 允许任意来源

'Authorization': req.headers.authorization,  // 无存在性检查，undefined 被发送为字符串 "undefined"
```

## Proposed Solutions

### Option A: 绑定 localhost + 限制 CORS 来源（推荐）

```js
// 只监听本机
app.listen(PORT, '127.0.0.1', () => { ... });

// CORS 限制为开发来源
const ALLOWED_ORIGINS = ['http://localhost:8081', 'http://localhost:8082'];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  // ...
});

// Authorization 存在性检查
if (!req.headers.authorization) {
  return res.status(401).json({ error: 'Missing Authorization header' });
}
```

**Pros:** 防止局域网滥用，防止 undefined token 被转发
**Cons:** 需要在不同端口启动时手动更新 ALLOWED_ORIGINS（或用正则）
**Effort:** Small
**Risk:** None

## Recommended Action

Option A。这是开发代理，修复成本极低。

## Acceptance Criteria

- [ ] 代理只绑定 `127.0.0.1`
- [ ] CORS 限制为本地开发来源（非通配符 `*`）
- [ ] `Authorization` 头缺失时返回 401

## Work Log

- 2026-03-27: 由 security-sentinel review agent 发现（原 todo 005 是前一个 PR 的同类问题，本条针对 10mb 版本的补充）
