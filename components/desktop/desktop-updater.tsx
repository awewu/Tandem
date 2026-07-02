'use client';

/**
 * DesktopUpdater — 桌面端 (Tauri) 自动更新 UI (§desktop 自动更新).
 *
 * 行为:
 *   - 仅在 Tauri webview 内运行 (web 端 isTauri()=false → 空转, 不影响 web).
 *   - 启动后延迟自动静默检查更新; 有新版本 → 右下角弹更新卡片.
 *   - 监听托盘「检查更新」事件 (tandem://check-update) → 手动检查 (无更新时也给反馈).
 *   - 用户点「立即更新」→ 下载 (带进度) → 安装 → 重启应用.
 *
 * 更新源: 公司 Tandem 服务器 /api/desktop/update/...（端点+公钥在构建期由
 *   scripts/gen-updater-config.mjs 注入 tauri.conf）. 未配置签名公钥时, check() 抛错 →
 *   静默忽略 (自动更新优雅禁用).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { isTauri } from '@/lib/desktop/client';

type Phase = 'idle' | 'checking' | 'available' | 'downloading' | 'uptodate' | 'error';

interface UpdateInfo {
  version: string;
  notes?: string;
}

// 自动检查延迟 (让应用先加载完), 与每次启动检查一次.
const AUTO_CHECK_DELAY_MS = 8000;

export function DesktopUpdater() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const busyRef = useRef(false);

  /**
   * 执行检查. manual=true 时无更新也展示「已是最新」反馈.
   */
  const runCheck = useCallback(async (manual: boolean) => {
    if (!isTauri() || busyRef.current) return;
    busyRef.current = true;
    if (manual) setPhase('checking');
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        setInfo({ version: update.version, notes: update.body ?? '' });
        setPhase('available');
      } else if (manual) {
        setPhase('uptodate');
        setTimeout(() => setPhase('idle'), 4000);
      }
    } catch (e) {
      // 未配置 updater / 网络不可达: 自动检查时静默, 手动检查时提示.
      if (manual) {
        setErrorMsg((e as Error)?.message ?? '检查更新失败');
        setPhase('error');
        setTimeout(() => setPhase('idle'), 6000);
      }
    } finally {
      busyRef.current = false;
    }
  }, []);

  const runInstall = useCallback(async () => {
    if (!isTauri() || busyRef.current) return;
    busyRef.current = true;
    setPhase('downloading');
    setProgress(0);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      const update = await check();
      if (!update) {
        setPhase('idle');
        return;
      }
      let downloaded = 0;
      let contentLength = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.min(99, Math.round((downloaded / contentLength) * 100)));
            }
            break;
          case 'Finished':
            setProgress(100);
            break;
        }
      });
      // 安装完成 → 重启应用加载新版本.
      await relaunch();
    } catch (e) {
      setErrorMsg((e as Error)?.message ?? '更新安装失败');
      setPhase('error');
      setTimeout(() => setPhase('idle'), 8000);
    } finally {
      busyRef.current = false;
    }
  }, []);

  // 启动自动检查 + 托盘「检查更新」事件监听.
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    const timer = setTimeout(() => void runCheck(false), AUTO_CHECK_DELAY_MS);

    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        if (cancelled) return;
        unlisten = await listen('tandem://check-update', () => void runCheck(true));
      } catch {
        /* event api 不可用时忽略 */
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (unlisten) unlisten();
    };
  }, [runCheck]);

  if (phase === 'idle') return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-[rgb(var(--surface-1))] p-4 shadow-soft-lg">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--brand-500))] text-white text-callout font-extrabold">
          T
        </span>
        <div className="min-w-0 flex-1">
          {phase === 'checking' && (
            <p className="text-callout font-semibold text-ink-primary">正在检查更新…</p>
          )}

          {phase === 'uptodate' && (
            <p className="text-callout font-semibold text-ink-primary">已是最新版本</p>
          )}

          {phase === 'error' && (
            <>
              <p className="text-callout font-semibold text-ink-primary">检查更新失败</p>
              <p className="mt-1 text-caption text-ink-tertiary break-words">{errorMsg}</p>
            </>
          )}

          {phase === 'available' && info && (
            <>
              <p className="text-callout font-semibold text-ink-primary">
                发现新版本 v{info.version}
              </p>
              {info.notes && (
                <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-line text-caption text-ink-tertiary">
                  {info.notes}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void runInstall()}
                  className="rounded-full bg-[rgb(var(--brand-500))] px-4 py-1.5 text-caption font-semibold text-white hover:bg-[rgb(var(--brand-600))]"
                >
                  立即更新并重启
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('idle')}
                  className="rounded-full px-3 py-1.5 text-caption text-ink-tertiary hover:text-ink-secondary"
                >
                  稍后
                </button>
              </div>
            </>
          )}

          {phase === 'downloading' && (
            <>
              <p className="text-callout font-semibold text-ink-primary">正在下载更新…</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-2))]">
                <div
                  className="h-full rounded-full bg-[rgb(var(--brand-500))] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-footnote text-ink-tertiary">
                {progress}% · 完成后将自动重启
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
