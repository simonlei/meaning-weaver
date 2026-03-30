---
status: complete
priority: p2
issue_id: "005"
tags: [code-review, security, networking]
---

# proxy-server.js 监听所有网络接口，局域网内任意设备可访问

## Problem Statement

`proxy-server.js` 使用 `'0.0.0.0'` 作为 bind 地址，这意味着同一 WiFi 下的任何设备都可以访问该代理，进而将请求转发至混元 API。

## Findings

```js
// proxy-server.js:34
app.listen(PORT, '0.0.0.0', () => {
//                ^^^^^^^^^ 监听所有接口
```

结合 `Access-Control-Allow-Origin: *` 设置，局域网内任意网页均可跨域调用此代理。

## Proposed Solutions

### Option A（推荐）：绑定到 `127.0.0.1`（仅本机）

```js
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Hunyuan proxy running on http://127.0.0.1:${PORT}`);
});
```

注意：如需 Android 模拟器访问 localhost，仍可通过 `adb reverse tcp:3001 tcp:3001` 完成，无需监听 `0.0.0.0`。

## Acceptance Criteria

- [ ] `proxy-server.js` 将 listen 地址从 `'0.0.0.0'` 改为 `'127.0.0.1'`
- [ ] Android 模拟器仍能通过 ADB reverse 访问代理（README 中已记录）

## Work Log

- 2026-03-27：代码审查发现，来自 security-sentinel
