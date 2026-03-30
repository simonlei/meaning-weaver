---
status: complete
priority: p2
issue_id: "027"
tags: [code-review, security, proxy, cors, network]
dependencies: []
---

# Proxy binds to `0.0.0.0` with wildcard CORS — LAN exposure and localhost CSRF risk

## Problem Statement

`proxy-server.js` binds to all interfaces and allows any origin:

```javascript
res.header('Access-Control-Allow-Origin', '*');  // line 9
app.listen(PORT, '0.0.0.0', () => { ... });      // line 175
```

This creates two concrete security risks:

1. **LAN exposure**: The proxy is reachable by any device on the same network. A user on public Wi-Fi exposes their Hunyuan API key to other network participants who can call the proxy endpoint and run up API charges.

2. **Localhost CSRF via DNS rebinding**: Any webpage open in the developer's browser can make cross-origin POST requests to `http://localhost:3001/v1/chat/completions` (because `Access-Control-Allow-Origin: *` permits it), forwarding the developer's API key and triggering Hunyuan API calls at their expense. Standard CSRF protections don't apply to localhost.

## Findings

- **Security reviewer**: "The proxy binds to all interfaces (`0.0.0.0`) and allows any origin. Combined: Any webpage the developer has open in their browser while the proxy is running can make cross-origin POST requests to `http://localhost:3001/v1/chat/completions`, forwarding the user's `Authorization` header."
- This finding was also present in earlier code review (todo #016).

## Proposed Solutions

### Option A — Restrict binding and CORS (Recommended)
```javascript
// proxy-server.js
res.header('Access-Control-Allow-Origin', 'http://localhost:8081');  // Expo web dev server port

app.listen(PORT, '127.0.0.1', () => { ... });  // localhost only, not all interfaces
```
**Pros:** Eliminates both attack vectors. Simple 2-line fix.
**Cons:** Must match the actual Expo dev server port (8081 by default; could also be 19006 for Expo Go web).
**Effort:** Small | **Risk:** Low

### Option B — Dynamic CORS allowlist
Read allowed origins from an environment variable, defaulting to `http://localhost:8081`.
**Pros:** Flexible for different dev setups.
**Cons:** Slightly more complex.
**Effort:** Small | **Risk:** Low

## Recommended Action

Option A with a comment explaining the port rationale.

## Technical Details

- **Affected file:** `proxy-server.js` (dev-only proxy, not bundled into the mobile app)
- **Note:** This issue was flagged in a previous review (todo #016). Check if it was already resolved.

## Acceptance Criteria

- [ ] `proxy-server.js` binds to `127.0.0.1` (not `0.0.0.0`)
- [ ] `Access-Control-Allow-Origin` set to specific localhost origin (not `*`)
- [ ] Other network devices cannot reach the proxy
- [ ] Expo web dev workflow still functions

## Work Log

- 2026-03-30: Finding raised by Security reviewer (🟡 Medium). Note: also flagged as todo #016 in previous review — check if already addressed. Todo created during code review of `feat/photo-description-pipeline`.
