#!/usr/bin/env node
/**
 * build-mobile-bootstrap.mjs — 生成 Capacitor 移动端的 bootstrap 连接页.
 *
 * 移动端 = 瘦客户端 (与 Tauri 桌面端同构): WebView 加载远端 Tandem server
 * (完整 Next.js, 含 API + Postgres), 功能与 web 端 100% 等价.
 *
 * 本脚本产出 `dist/mobile/index.html` — capacitor.config.ts 的 webDir 指向 `dist/mobile`.
 * 在 Capacitor WebView 首次启动 / server.url 不可达时显示:
 *   - 连接中 (spinner)
 *   - 服务器不可达 → 错误页 + 重试按钮
 *
 * server.url 由 capacitor.config.ts 的 TANDEM_MOBILE_SERVER_URL 环境变量注入,
 * Capacitor 在 native 端直接加载该 URL, 此页面仅作为 fallback / 错误页.
 *
 * 注意: Capacitor 的 server.url 模式下, WebView 直接加载远端 origin,
 * 此 bootstrap 页仅在 WebView 加载失败时可见 (Capacitor 会显示 errorUrl).
 * 我们将错误页配置为 capacitor.config.ts 的 server.errorPath.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'dist', 'mobile');

const HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0E0E0E" />
  <title>Tandem · 连接服务器</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body { margin: 0; height: 100%; }
    body {
      display: flex; align-items: center; justify-content: center;
      min-height: 100dvh;
      padding: max(env(safe-area-inset-top), 24px) 24px max(env(safe-area-inset-bottom), 24px);
      background: #0E0E0E;
      color: #f5f5f5;
      font-family: 'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      text-align: center;
    }
    .wrap { max-width: 360px; }
    .badge {
      width: 64px; height: 64px; margin: 0 auto 20px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 18px;
      background: rgba(200, 32, 44, 0.14);
      color: #ff5a64;
    }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px; letter-spacing: -0.01em; }
    p { font-size: 14px; line-height: 1.6; color: #b5b5b5; margin: 0 0 24px; }
    button {
      appearance: none; border: 0; cursor: pointer;
      touch-action: manipulation;
      background: #C8202C; color: #fff;
      font-size: 15px; font-weight: 600;
      padding: 12px 28px; border-radius: 12px;
      transition: transform .12s ease, background .12s ease;
    }
    button:active { transform: scale(0.97); background: #a81a24; }
    .spinner {
      width: 28px; height: 28px; margin: 0 auto 16px;
      border: 3px solid rgba(255,255,255,0.15); border-top-color: #C8202C;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #loading { display: flex; flex-direction: column; align-items: center; }
    #error { display: none; }
    .hint { margin-top: 16px; font-size: 12px; color: #6f6f6f; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="badge" aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </div>
    <div id="loading">
      <div class="spinner"></div>
      <h1>正在连接 Tandem</h1>
      <p>连接公司服务器中…</p>
    </div>
    <div id="error">
      <h1>暂时连不上服务器</h1>
      <p>请检查网络连接后重试。如果问题持续，请联系管理员确认服务器是否正常运行。</p>
      <button type="button" id="retry">重新连接</button>
      <div class="hint">Tandem · 牛马搭子</div>
    </div>
  </div>
  <script>
    // Capacitor server.url 模式: WebView 直接加载远端 origin.
    // 如果远端不可达, Capacitor 会在此页面显示错误.
    // 此页面提供自动重试 + 手动重试按钮.
    var loading = document.getElementById('loading');
    var errorBox = document.getElementById('error');
    var retryBtn = document.getElementById('retry');

    function showError() {
      loading.style.display = 'none';
      errorBox.style.display = 'block';
    }

    function retry() {
      errorBox.style.display = 'none';
      loading.style.display = 'flex';
      // 重新加载远端 URL (Capacitor server.url)
      window.location.reload();
    }

    retryBtn.addEventListener('click', retry);

    // 如果 5 秒后仍在 bootstrap 页 (说明远端未加载), 显示错误页
    setTimeout(function () {
      if (loading.style.display !== 'none') {
        showError();
      }
    }, 5000);

    // 网络恢复自动重连
    window.addEventListener('online', function () {
      if (errorBox.style.display === 'block') {
        retry();
      }
    });
  </script>
</body>
</html>
`;

// 离线/错误页 (Capacitor server.errorPath 加载此页)
const OFFLINE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0E0E0E" />
  <title>服务器不可用 · Tandem</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body { margin: 0; height: 100%; }
    body {
      display: flex; align-items: center; justify-content: center;
      min-height: 100dvh;
      padding: max(env(safe-area-inset-top), 24px) 24px max(env(safe-area-inset-bottom), 24px);
      background: #0E0E0E; color: #f5f5f5;
      font-family: 'PingFang SC', 'Microsoft YaHei', -apple-system, system-ui, sans-serif;
      -webkit-font-smoothing: antialiased; text-align: center;
    }
    .wrap { max-width: 360px; }
    .badge { width: 64px; height: 64px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; border-radius: 18px; background: rgba(200, 32, 44, 0.14); color: #ff5a64; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px; letter-spacing: -0.01em; }
    p { font-size: 14px; line-height: 1.6; color: #b5b5b5; margin: 0 0 24px; }
    button { appearance: none; border: 0; cursor: pointer; touch-action: manipulation; background: #C8202C; color: #fff; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 12px; transition: transform .12s ease, background .12s ease; }
    button:active { transform: scale(0.97); background: #a81a24; }
    .hint { margin-top: 16px; font-size: 12px; color: #6f6f6f; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="badge" aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </div>
    <h1>服务器暂时不可用</h1>
    <p>Tandem 服务器未响应。请检查网络连接后重试。</p>
    <button type="button" onclick="location.reload()">重新连接</button>
    <div class="hint">Tandem · 牛马搭子</div>
  </div>
  <script>window.addEventListener('online', function () { location.reload(); });</script>
</body>
</html>
`;

mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, 'index.html'), HTML, 'utf8');
writeFileSync(join(distDir, 'offline.html'), OFFLINE_HTML, 'utf8');
console.log('[build-mobile-bootstrap] wrote ' + join(distDir, 'index.html'));
console.log('[build-mobile-bootstrap] wrote ' + join(distDir, 'offline.html'));
