import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Result, Ok, Err } from '../../lib/result';

// --- 类型定义 ---

export type UpdateInfo = {
  version: string;
  downloadUrl: string;
  releaseNotes: string;
};

export type UpdateError =
  | { kind: 'network'; message: string }
  | { kind: 'http'; status: number; message: string }
  | { kind: 'parse'; message: string }
  | { kind: 'no_update' }
  | { kind: 'skip'; reason: string };

const GITHUB_API_URL =
  'https://api.github.com/repos/simonlei/meaning-weaver/releases/latest';
const FETCH_TIMEOUT_MS = 10_000;
const GITHUB_REPO_URL_PREFIX = 'https://github.com/simonlei/meaning-weaver/';

// --- 版本比较 ---

/**
 * 简单 semver 比较：将 "0.0.7" 拆分为数字数组逐段比较。
 * 返回 1 (a > b), -1 (a < b), 0 (a == b)。
 * 不支持 pre-release 标签（如 -beta），遇到非数字段返回 0。
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (isNaN(na) || isNaN(nb)) return 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// --- 主函数 ---

export async function checkForUpdate(): Promise<Result<UpdateInfo, UpdateError>> {
  // Guard: 仅 Android 生产环境
  if (Platform.OS !== 'android') {
    return Err({ kind: 'skip', reason: 'not android' });
  }
  if (__DEV__) {
    return Err({ kind: 'skip', reason: 'dev mode' });
  }

  // 获取当前版本
  const currentVersion = Constants.expoConfig?.version;
  if (!currentVersion) {
    return Err({ kind: 'skip', reason: 'cannot read app version' });
  }

  // 请求 GitHub API
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(GITHUB_API_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!response.ok) {
      return Err({
        kind: 'http',
        status: response.status,
        message: `GitHub API returned ${response.status}`,
      });
    }

    const data = await response.json();
    const tagName: string = data.tag_name ?? '';
    const remoteVersion = tagName.replace(/^v/, '');

    if (!remoteVersion || compareSemver(remoteVersion, currentVersion) <= 0) {
      return Err({ kind: 'no_update' });
    }

    // 验证 URL 安全性：必须是 GitHub 本仓库的 URL
    const htmlUrl: string = data.html_url ?? '';
    if (!htmlUrl.startsWith(GITHUB_REPO_URL_PREFIX)) {
      return Err({ kind: 'parse', message: 'unexpected release URL' });
    }

    return Ok({
      version: remoteVersion,
      downloadUrl: htmlUrl,
      releaseNotes: data.body ?? '',
    });
  } catch (e) {
    return Err({
      kind: 'network',
      message: e instanceof Error ? e.message : 'unknown error',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
