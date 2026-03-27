---
status: pending
priority: p1
issue_id: "014"
tags: [code-review, error-handling, photo-feature, react-native]
---

# `handlePickPhoto` async 函数无 try/catch，可能产生未处理的 Promise rejection

## Problem Statement

`FragmentInput.tsx` 中 `handlePickPhoto` 是一个 async 函数，直接作为 `onPress` 传给 `TouchableOpacity`。若 `requestMediaLibraryPermissionsAsync()` 或 `launchImageLibraryAsync()` 抛出异常（OS 拒绝 API 调用、Expo 内部错误等），rejection 无人捕获。

React Native 会打印 unhandled promise warning，在部分配置下可能导致应用崩溃（Hermes 引擎的 unhandledRejection 行为）。

## Findings

**File:** `src/components/FragmentInput.tsx`, lines 24–44

```ts
const handlePickPhoto = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync(); // ← 可能 reject
  if (status !== 'granted') {
    Alert.alert(...);
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ ... }); // ← 可能 reject
  if (!result.canceled && result.assets?.[0]?.uri) {
    setPhotoUri(result.assets[0].uri);
  }
};
```

## Proposed Solutions

### Option A: 整体 try/catch（推荐）

```ts
const handlePickPhoto = async () => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        '需要相册权限',
        '请在系统设置中允许「意义编织」访问你的相册。',
        [{ text: '好的' }]
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  } catch (e) {
    console.warn('Photo picker failed:', e);
    // 可选：Alert.alert('选择照片时出错', '请重试。');
  }
};
```

**Pros:** 防止 unhandled rejection，用户无感
**Cons:** 无
**Effort:** Trivial
**Risk:** None

## Recommended Action

Option A。

## Technical Details

- **Affected file:** `src/components/FragmentInput.tsx`

## Acceptance Criteria

- [ ] `handlePickPhoto` 内所有 await 包裹在 try/catch 中
- [ ] catch 块至少有 `console.warn` 日志
- [ ] 不会产生 unhandled promise rejection

## Work Log

- 2026-03-27: 由 kieran-typescript-reviewer review agent 发现
