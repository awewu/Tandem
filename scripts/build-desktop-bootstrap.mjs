#!/usr/bin/env node
/**
 * build-desktop-bootstrap.mjs — 生成 Tauri 桌面端的 bootstrap 连接网关页.
 *
 * 桌面端 = 瘦客户端: webview 加载远端公司 Tandem server (完整 Next.js, 含 API + Postgres),
 * 因此功能与 web 端 100% 等价. 本脚本产出 `dist/index.html` —— tauri.conf.json 的
 * frontendDist 指向 `../dist`, 生产构建时被打进 .exe/.msi.
 *
 * index.html 职责 (纯原生, 无框架, 因为它在跳转到真正 app 之前运行):
 *   1. 读 tandem_get_config 拿到已保存的 serverUrl (默认 http://localhost:3000)
 *   2. 探活 serverUrl (no-cors fetch, 区分"服务器在/不在")
 *   3. 通 → window.location.replace(serverUrl) 加载完整 app
 *   4. 不通/首次 → 显示配置表单, 用户填公司服务器地址 → tandem_set_config → 重试
 *
 * dev 模式 (`tauri dev`) 不走本页 —— webview 直接加载 devUrl (运行中的 Next server).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'dist');

const HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Tandem · 连接公司服务器</title>
  <style>
    :root {
      --brand: #C8202C;
      --brand-600: #A81824;
      --ink: #0E0E0E;
      --ink-2: #3A3A3C;
      --ink-3: #8A8A8E;
      --hairline: rgba(0,0,0,0.10);
      --surface: #FFFFFF;
      --bg: #F5F5F7;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --ink: #F5F5F7; --ink-2: #C7C7CC; --ink-3: #8A8A8E;
        --hairline: rgba(255,255,255,0.12);
        --surface: #1C1C1E; --bg: #0E0E0E;
      }
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
        "Microsoft YaHei", Roboto, Helvetica, Arial, sans-serif;
      background:
        radial-gradient(1200px 500px at 50% -10%, rgba(200,32,44,0.10), transparent 60%),
        var(--bg);
      color: var(--ink);
      display: flex; align-items: center; justify-content: center;
      -webkit-user-select: none; user-select: none;
    }
    .card {
      width: min(440px, calc(100vw - 48px));
      background: var(--surface);
      border: 1px solid var(--hairline);
      border-radius: 20px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.04);
      padding: 32px 28px;
      text-align: center;
    }
    .logo {
      width: 44px; height: 44px; border-radius: 12px;
      background: var(--brand); color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 22px; letter-spacing: -0.5px;
      margin-bottom: 16px;
    }
    h1 { font-size: 19px; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.3px; }
    p.sub { font-size: 13px; color: var(--ink-3); margin: 0 0 22px; line-height: 1.5; }
    .spinner {
      width: 26px; height: 26px; margin: 8px auto 0;
      border: 3px solid var(--hairline); border-top-color: var(--brand);
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    form { display: none; text-align: left; margin-top: 8px; }
    label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 0 0 6px; }
    input {
      width: 100%; padding: 11px 13px; font-size: 14px;
      border: 1px solid var(--hairline); border-radius: 11px;
      background: var(--bg); color: var(--ink); outline: none;
      -webkit-user-select: text; user-select: text;
    }
    input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(200,32,44,0.15); }
    .hint { font-size: 11.5px; color: var(--ink-3); margin: 7px 2px 0; line-height: 1.5; }
    button {
      width: 100%; margin-top: 16px; padding: 12px;
      font-size: 14px; font-weight: 600; color: #fff;
      background: var(--brand); border: none; border-radius: 11px;
      cursor: pointer; transition: background 0.15s;
    }
    button:hover { background: var(--brand-600); }
    button:disabled { opacity: 0.6; cursor: default; }
    .err {
      display: none; margin-top: 14px; padding: 10px 12px;
      background: rgba(200,32,44,0.08); border: 1px solid rgba(200,32,44,0.25);
      border-radius: 10px; font-size: 12.5px; color: var(--brand-600); text-align: left;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">T</div>
    <h1 id="title">正在连接 Tandem</h1>
    <p class="sub" id="subtitle">连接公司服务器中…</p>

    <div id="loading"><div class="spinner"></div></div>

    <form id="config" onsubmit="return false;">
      <label for="url">公司服务器地址</label>
      <input id="url" type="text" inputmode="url" autocomplete="off"
             placeholder="http://192.168.1.100:3000" />
      <p class="hint">
        本机开发: <code>http://localhost:3000</code>　·　局域网: <code>http://&lt;服务器IP&gt;:3000</code>
      </p>
      <button id="connect" type="submit">连接</button>
      <div class="err" id="err"></div>
    </form>
  </div>

  <script>
    var DEFAULT_URL = 'http://localhost:3000';

    function tauriInvoke(cmd, args) {
      try {
        var t = window.__TAURI__;
        if (t && t.core && typeof t.core.invoke === 'function') {
          return t.core.invoke(cmd, args || {});
        }
      } catch (e) {}
      return Promise.reject(new Error('tauri-unavailable'));
    }

    function normalize(u) {
      if (!u) return '';
      u = u.trim().replace(/\\/+$/, '');
      if (!/^https?:\\/\\//i.test(u)) u = 'http://' + u;
      return u;
    }

    // 探活: no-cors fetch, 网络可达即 resolve (即使 opaque); 连接拒绝/超时则 reject.
    function ping(url) {
      var ctrl = new AbortController();
      var to = setTimeout(function () { ctrl.abort(); }, 4000);
      return fetch(url + '/api/health', { mode: 'no-cors', signal: ctrl.signal, cache: 'no-store' })
        .then(function () { clearTimeout(to); return true; })
        .catch(function () { clearTimeout(to); return false; });
    }

    var $ = function (id) { return document.getElementById(id); };

    function showConfig(prefill, message) {
      $('title').textContent = '连接公司服务器';
      $('subtitle').textContent = '填写公司 Tandem 服务器地址即可使用全部功能。';
      $('loading').style.display = 'none';
      $('config').style.display = 'block';
      $('url').value = prefill || DEFAULT_URL;
      if (message) { $('err').style.display = 'block'; $('err').textContent = message; }
      $('url').focus();
      $('url').select();
    }

    function attempt(url, opts) {
      opts = opts || {};
      $('loading').style.display = 'block';
      $('config').style.display = 'none';
      $('title').textContent = '正在连接 Tandem';
      $('subtitle').textContent = '连接 ' + url + ' …';
      return ping(url).then(function (ok) {
        if (ok) { window.location.replace(url); return; }
        showConfig(url, opts.silent ? '' : '无法连接到 ' + url + '，请检查地址或确认服务器已启动。');
      });
    }

    $('config').addEventListener('submit', function () {
      var url = normalize($('url').value);
      if (!url) { $('err').style.display = 'block'; $('err').textContent = '请输入服务器地址。'; return; }
      $('connect').disabled = true;
      $('err').style.display = 'none';
      tauriInvoke('tandem_set_config', { serverUrl: url })
        .catch(function () {})
        .then(function () { return attempt(url); })
        .then(function () { $('connect').disabled = false; });
    });

    // 启动: 读已保存配置 → 探活 → 跳转 / 显示配置表单
    tauriInvoke('tandem_get_config')
      .then(function (cfg) {
        var url = normalize((cfg && cfg.serverUrl) || DEFAULT_URL);
        return attempt(url, { silent: true });
      })
      .catch(function () {
        // 非 Tauri 环境 (例如浏览器直接打开 dist/index.html) 或 IPC 不可用
        attempt(DEFAULT_URL, { silent: true });
      });
  </script>
</body>
</html>
`;

mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, 'index.html'), HTML, 'utf8');
console.log('[build-desktop-bootstrap] wrote ' + join(distDir, 'index.html'));
