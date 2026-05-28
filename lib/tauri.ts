/**
 * lib/tauri.ts — 桌面 (Tauri) 适配层
 *
 * 设计目的:
 *   让 Tandem 前端代码无需关心运行在浏览器还是桌面 app, 通过 `useTauri()` 检测
 *   桌面环境, 通过 `tauri.notify()` / `tauri.navigate()` 等 API 调用 native 能力.
 *
 * 桌面端 = Tauri webview 加载远端 Tandem server (Next.js).
 *   前端业务代码 100% 跟浏览器版本一致.
 *   仅在以下场景调用 Tauri:
 *     - 收到议事室开始/ProxyAction 待审等关键事件 → 弹 native 通知
 *     - 用户在桌面 app 里点 "记录今天 5min" → tauri.navigate('/report')
 *     - 首次启动 / 切换公司 server → tauri.setConfig({ serverUrl })
 *
 * 浏览器环境下 (无 Tauri), 所有 API 静默 no-op, 不报错.
 */

interface TandemDesktopConfig {
  serverUrl: string;
  notifyEnabled: boolean;
  autostartEnabled: boolean;
}

interface TauriGlobals {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
}

/** 是否运行在 Tauri 桌面环境 (而非浏览器) */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as TauriGlobals;
  return !!(w.__TAURI_INTERNALS__ || w.__TAURI__);
}

/**
 * 动态 import @tauri-apps/api 避免浏览器构建包含 native 代码.
 * 仅在 isTauri() === true 时调用.
 */
async function invokeTauri<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error('tauri.invoke called outside Tauri runtime');
  }
  // 动态 import 避免 web build 拉入
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

// ---------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------

export const tauri = {
  isAvailable: isTauri,

  /** 读当前桌面 app 的配置 (server URL / 通知开关 / 自启) */
  async getConfig(): Promise<TandemDesktopConfig | null> {
    if (!isTauri()) return null;
    try {
      const raw = await invokeTauri<{
        serverUrl: string;
        notifyEnabled: boolean;
        autostartEnabled: boolean;
      }>('tandem_get_config');
      return {
        serverUrl: raw.serverUrl,
        notifyEnabled: raw.notifyEnabled,
        autostartEnabled: raw.autostartEnabled,
      };
    } catch {
      return null;
    }
  },

  /** 更新配置, 任一字段缺省则保持原值. autostart 切换会同步系统注册. */
  async setConfig(patch: Partial<TandemDesktopConfig>): Promise<void> {
    if (!isTauri()) return;
    try {
      await invokeTauri('tandem_set_config', {
        serverUrl: patch.serverUrl,
        notifyEnabled: patch.notifyEnabled,
        autostartEnabled: patch.autostartEnabled,
      });
    } catch (e) {
      console.warn('[tauri] setConfig failed', e);
    }
  },

  /** 弹 native 通知 (用户在桌面 app 关闭/缩到托盘时也能弹) */
  async notify(title: string, body: string): Promise<void> {
    if (!isTauri()) return;
    try {
      await invokeTauri('tandem_notify', { title, body });
    } catch (e) {
      console.warn('[tauri] notify failed', e);
    }
  },

  /** 唤起主窗口 (从托盘或后台带回前台) */
  async showMain(): Promise<void> {
    if (!isTauri()) return;
    try {
      await invokeTauri('tandem_show_main');
    } catch {
      /* no-op */
    }
  },

  /** 隐藏主窗口到托盘 */
  async hideMain(): Promise<void> {
    if (!isTauri()) return;
    try {
      await invokeTauri('tandem_hide_main');
    } catch {
      /* no-op */
    }
  },

  /** 让 webview 导航到指定路径 (相对配置的 server URL) */
  async navigate(path: string): Promise<void> {
    if (!isTauri()) return;
    try {
      await invokeTauri('tandem_navigate', { path });
    } catch {
      /* no-op */
    }
  },
};

export type { TandemDesktopConfig };
