/**
 * lib/capacitor/client.ts — 移动端 (Capacitor) 浏览器侧辅助.
 *
 * 与 lib/desktop/client.ts 同构: 通过 isCapacitor() 守卫区分运行环境.
 *   - web 浏览器: isCapacitor() = false → 行为不变
 *   - Capacitor WebView: isCapacitor() = true → 请求带 X-Tandem-Client: mobile
 *
 * 移动端也走长会话 (与桌面端同策略), 由后端识别 X-Tandem-Client: mobile 触发.
 * 这些函数在远端 Next.js 页面内运行 (WebView 加载的是远端 origin), 因此
 * isCapacitor() 依赖 @capacitor/core 注入的 window.Capacitor 对象.
 */

const CLIENT_HEADER_NAME = 'X-Tandem-Client';
const CLIENT_HEADER_VALUE = 'mobile';

/**
 * 当前是否运行在 Capacitor WebView 内.
 * Capacitor 在 WebView 启动时注入 window.Capacitor (isNativePlatform === true).
 */
export function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  };
  const cap = w.Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
  return false;
}

/**
 * 移动端请求头 (web 端返回空对象).
 * 用于 login / refresh 等会话请求, 触发移动端长会话策略.
 */
export function capacitorHeaders(): Record<string, string> {
  return isCapacitor() ? { [CLIENT_HEADER_NAME]: CLIENT_HEADER_VALUE } : {};
}

/**
 * 触发一次滑动续期 (仅移动端有效, 镜像桌面端 refreshDesktopSession).
 * @returns true 续期成功; false 失败 (web 端 / 会话过期 / 已退出).
 */
export async function refreshMobileSession(): Promise<boolean> {
  if (!isCapacitor()) return false;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { [CLIENT_HEADER_NAME]: CLIENT_HEADER_VALUE },
      credentials: 'include',
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}
