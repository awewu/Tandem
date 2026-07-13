/**
 * lib/desktop/releases.ts — 桌面端 (Tauri) 更新包仓库读取.
 *
 * 自托管更新: 更新包与版本清单放在服务器的一个目录里 (env DESKTOP_RELEASE_DIR,
 * 默认 <cwd>/desktop-releases). Tauri updater 周期/手动请求
 *   GET /api/desktop/update/{{target}}/{{arch}}/{{current_version}}
 * 本模块负责读 manifest、按平台与 semver 判断是否有新版本.
 *
 * manifest.json 形如:
 * {
 *   "version": "1.1.0",
 *   "notes": "本次更新内容…",
 *   "pubDate": "2026-06-30T00:00:00Z",
 *   "platforms": {
 *     "windows-x86_64": { "file": "Tandem_1.1.0_x64-setup.exe", "signature": "<.sig 文件内容>" },
 *     "darwin-aarch64": { "file": "Tandem_1.1.0_aarch64.app.tar.gz", "signature": "..." },
 *     "darwin-x86_64":  { "file": "Tandem_1.1.0_x64.app.tar.gz", "signature": "..." },
 *     "linux-x86_64":   { "file": "tandem_1.1.0_amd64.AppImage", "signature": "..." }
 *   }
 * }
 *
 * signature = 对应安装包的 .sig 文件内容 (tauri signer 在 build 时生成). 客户端用 pubkey 校验.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface ReleasePlatform {
  file: string;
  signature: string;
}

export interface ReleaseManifest {
  version: string;
  notes?: string;
  pubDate?: string;
  platforms: Record<string, ReleasePlatform>;
}

/** 更新包目录 (绝对路径). 可用 env DESKTOP_RELEASE_DIR 覆盖. */
export function getReleaseDir(): string {
  const fromEnv = process.env.DESKTOP_RELEASE_DIR;
  if (fromEnv && fromEnv.trim()) {
    return path.resolve(fromEnv.trim());
  }
  return path.join(process.cwd(), 'desktop-releases');
}

/** 读取并解析 manifest.json; 不存在/损坏返回 null (= 无可用更新). */
export async function readManifest(): Promise<ReleaseManifest | null> {
  try {
    const file = path.join(getReleaseDir(), 'manifest.json');
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as ReleaseManifest;
    if (!parsed?.version || !parsed?.platforms) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * semver 比较 (仅取 major.minor.patch 数值段, 忽略 prerelease/build).
 * @returns 正数 a>b, 负数 a<b, 0 相等.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** 解析更新包文件的绝对路径, 并防目录穿越. 返回 null 表示非法/不存在. */
export function resolveReleaseFile(fileName: string): string | null {
  if (!fileName || fileName.includes('..') || path.isAbsolute(fileName)) return null;
  const dir = getReleaseDir();
  const full = path.join(dir, fileName);
  if (!full.startsWith(dir + path.sep) && full !== dir) return null;
  return full;
}
