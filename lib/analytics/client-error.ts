/**
 * §观测埋点 · 浏览器错误捕获 · 纯逻辑层 (可单测)
 *
 * 不直接 import React, 让 vitest node env 也能测.
 * UI 层 components/client-error-reporter.tsx 套这层做 React lifecycle.
 */

export const MAX_PER_SESSION = 10;
export const SS_COUNT_KEY = '__tandem_client_err_count__';
export const SS_SEEN_KEY = '__tandem_client_err_seen__';

export interface ClientErrorPayload {
  kind: 'window_error' | 'unhandled_rejection';
  msg: string;
  src?: string;
  line?: number;
  col?: number;
  stack?: string | null;
  path: string;
  ua: string;
}

/** 计算事件指纹用于 dedup */
export function fingerprint(msg: string, src: string, line: number, col: number): string {
  return `${msg}|${src}|${line}:${col}`.slice(0, 200);
}

/**
 * sessionStorage-like 接口 · 测试可注入 mock
 * 真实调用方传 typeof sessionStorage !== 'undefined' ? sessionStorage : null
 */
export interface SessionStorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function getCount(ss: SessionStorageLike | null): number {
  if (!ss) return 0;
  try { return Number(ss.getItem(SS_COUNT_KEY) ?? '0'); } catch { return 0; }
}

export function bumpCount(ss: SessionStorageLike | null): number {
  if (!ss) return 0;
  try {
    const n = getCount(ss) + 1;
    ss.setItem(SS_COUNT_KEY, String(n));
    return n;
  } catch { return 0; }
}

export function seen(ss: SessionStorageLike | null, fp: string): boolean {
  if (!ss) return false;
  try {
    const raw = ss.getItem(SS_SEEN_KEY);
    if (!raw) return false;
    return raw.split('|').includes(fp);
  } catch { return false; }
}

export function markSeen(ss: SessionStorageLike | null, fp: string): void {
  if (!ss) return;
  try {
    const raw = ss.getItem(SS_SEEN_KEY) ?? '';
    const items = raw ? raw.split('|') : [];
    if (!items.includes(fp)) items.push(fp);
    ss.setItem(SS_SEEN_KEY, items.join('|').slice(-1000));
  } catch { /* quota */ }
}

/**
 * 决定一条事件是否应上报: 未达 cap + 未重复 → true
 * 决策同时副作用 (bumpCount + markSeen)
 */
export function shouldReport(ss: SessionStorageLike | null, fp: string): boolean {
  // 无 sessionStorage 视为 SSR / 异常环境 → 静默丢, 防止无 dedup/cap 下打爆 backend
  if (!ss) return false;
  if (seen(ss, fp)) return false;
  if (bumpCount(ss) > MAX_PER_SESSION) return false;
  markSeen(ss, fp);
  return true;
}

/** 把 unknown reason 折成稳定 message string */
export function reasonToMsg(reason: unknown): string {
  if (reason instanceof Error) return String(reason.message);
  if (typeof reason === 'string') return reason;
  try { return JSON.stringify(reason).slice(0, 500); } catch { return 'unknown'; }
}
