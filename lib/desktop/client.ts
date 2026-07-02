/**
 * lib/desktop/client.ts — 桌面端 (Tauri 瘦客户端) 浏览器侧辅助.
 *
 * 这些函数在 web 与桌面共享的 Next 前端里运行, 通过 isTauri() 守卫:
 *   - web 浏览器: isTauri() = false → 行为不变 (短会话, 不自动续期).
 *   - Tauri webview: isTauri() = true → 请求带 X-Tandem-Client: desktop, 触发 7 天滑动长会话.
 */

const DESKTOP_HEADER_NAME = 'X-Tandem-Client';
const DESKTOP_HEADER_VALUE = 'desktop';

/** 当前是否运行在 Tauri 桌面 webview 内 (与 lib/hermes-api.ts 同口径). */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  };
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__);
}

/** 桌面端请求头 (web 端返回空对象). 用于 login / refresh 等会话请求. */
export function desktopHeaders(): Record<string, string> {
  return isTauri() ? { [DESKTOP_HEADER_NAME]: DESKTOP_HEADER_VALUE } : {};
}

/**
 * 触发一次滑动续期 (仅桌面端有效).
 * @returns true 续期成功 (会话仍有效); false 失败 (web 端 / 会话过期 / 已退出).
 */
export async function refreshDesktopSession(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { [DESKTOP_HEADER_NAME]: DESKTOP_HEADER_VALUE },
      credentials: 'include',
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}
