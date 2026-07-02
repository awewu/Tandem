# Tandem Desktop App (Tauri)

## Architecture — 瘦客户端 (thin client)

桌面端 **不重复实现业务**. 它是一个 Tauri webview, 加载运行在公司服务器/局域网上的
**完整 Next.js Tandem server** (含 `app/api/*` + Postgres). 因此桌面端功能与 web 端 **100% 等价** ——
同一份代码, 同一份数据, 只是多了原生系统集成 (托盘 / 通知 / 全局快捷键 / 开机自启).

| Runtime | 加载什么 | Backend |
|---|---|---|
| **Web (browser)** | Next.js dev / `next start` | `app/api/*` + Postgres |
| **Desktop dev** (`tauri dev`) | `tauri.conf.json` → `devUrl` = 运行中的 Next server | 同 web (远端) |
| **Desktop prod** (`tauri build`) | `frontendDist` = `dist/index.html` (bootstrap 连接网关) → 跳转配置的 server URL | 同 web (远端) |

### 启动 / 连接流程

- **dev**: `tauri dev` 直接加载 `devUrl` (默认 `http://localhost:3000`) = 完整 app.
- **prod**: webview 先加载打进包的 `dist/index.html` (由 `scripts/build-desktop-bootstrap.mjs` 生成).
  该页 JS 调 `tandem_get_config` 读已保存的 `serverUrl` → 探活 → `window.location.replace(serverUrl)`;
  首次启动 / 连不上 → 展示配置表单, 用户填公司服务器地址 → `tandem_set_config` → 重试.

### Rust 原生集成命令 (`src-tauri/src/main.rs`, 前端走 `lib/tauri.ts` 调用)

- `tandem_get_config` / `tandem_set_config` — server URL / 通知开关 / 自启, 落 disk (tauri-plugin-store)
- `tandem_notify` — native 通知 (议事室开始 / ProxyAction 待审 / @我)
- `tandem_show_main` / `tandem_hide_main` — 从托盘唤起 / 缩回托盘
- `tandem_navigate` — 让 webview 跳到指定路径 (托盘菜单 / 快捷键)

> 注: `lib/hermes-api.ts` 是早期 “Hermes CLI 胖客户端” 残留 (`invoke('hermes_*')`), 与当前 main.rs 不匹配.
> 桌面瘦客户端模型下不依赖它 —— 远端页面走 web 自己的 `fetch('/api/...')`.

## Quick start

```powershell
# Dev (live reload, full debugger):
npm run tauri:dev

# Production .exe:
#   First, stop any running `npm run dev` (it locks app/api/ files)
npm run tauri:build
```

The output `.msi` / `.exe` lands under `src-tauri/target/release/bundle/`.

## Build pipeline

`npm run tauri:build` triggers (per `tauri.conf.json` → `beforeBuildCommand`):

1. **`scripts/build-desktop-bootstrap.mjs`** — 生成 `dist/index.html` (连接网关页).
   瘦客户端不需要静态导出整个 app, 只需这个轻量 bootstrap.
2. **Tauri** picks up `dist/` (declared as `frontendDist`), bundles it
   along with the Rust binary into `target/release/bundle/`.

> `scripts/build-static.mjs` (老的全量静态导出) 已不再用于桌面打包, 仅作历史保留.

## Prerequisites

`npx tauri info` reports your toolchain. Required:

- ✅ Rust 1.95+ — `cargo check` already passes locally
- ✅ Node.js 18+ — installed
- ✅ WebView2 runtime — installed (comes with Win11 / Edge)
- ⚠️ **MSVC Build Tools (linker)** — install if missing:
  <https://aka.ms/vs/17/release/vs_BuildTools.exe> → *Desktop development with C++*

If `cargo build --release` complains about `link.exe` not found, that's the
only thing left to install.

## Development workflow

```powershell
# Web hot-reload only:
npm run dev                    # → http://localhost:3000

# Native window pointing at the dev server (Rust commands also active):
npm run tauri:dev

# Static export sanity check (no Tauri bundle):
npm run build:static           # produces dist/

# Pure Rust verification:
cargo check --manifest-path src-tauri/Cargo.toml
```

## 登录持久化 (§desktop 长会话)

桌面端登录后**默认保持登录**, 无需每次重开重输密码. 规则:

- **保持登录**: 活跃使用期间永不掉线 (`components/desktop/desktop-session.tsx` 的 keep-alive 每 6h +
  应用打开/窗口聚焦时调 `POST /api/auth/refresh` 滑动续期).
- **一周不活跃 → 重登**: 会话窗口 7 天滑动 (`DESKTOP_SESSION_TTL_SEC`). 连续 7 天不开应用 → refresh
  过期 → 下次打开回登录页.
- **重开应用自动恢复**: 登录页 (`app/login/page.tsx`) 在 Tauri 内挂载时先静默 `refresh`, 成功则免登录
  直接进入 (期间显示极简「正在恢复会话」加载页, 不闪登录表单).
- **手动退出立即失效**: `POST /api/auth/logout` 撤销服务端会话 → refresh 失败 → 回登录页.

实现要点 (web 端完全不受影响):

- 桌面请求带 header `X-Tandem-Client: desktop` (`lib/desktop/client.ts` `desktopHeaders()`).
- `app/api/auth/login` 见此 header → 签发 7 天 access JWT + 7 天滑动会话 (`longSession`); web 仍是 24h.
- `app/api/auth/refresh` **仅认 desktop header** (web 端 403) → 轮换 refresh + 顺延 7 天 (`refreshSession`).

## 自动更新 (§desktop 自托管 Tauri updater)

更新包托管在**公司自己的 Tandem 服务器**上, 无需 GitHub Releases / 外网.

### 一次性: 生成更新签名密钥

```powershell
# 生成密钥对 (私钥务必保密, 已被 .gitignore 排除)
npx tauri signer generate -w src-tauri/updater.key
# 把打印出的"公钥"内容存入 (公钥可公开, 给构建脚本读取):
#   src-tauri/updater-pubkey.txt
```

私钥用于 build 时签名安装包, 通过环境变量传入:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content src-tauri/updater.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<生成时设的密码>"
```

### 构建 (自动注入更新端点 + 公钥)

```powershell
# 指定公司服务器地址 (= 更新端点 host, 也是默认连接地址)
$env:TANDEM_DEFAULT_SERVER_URL = "https://tandem.yourco.com"   # 或 http://192.168.x.x:3005
npm run tauri:build
```

`npm run tauri:build` 会先跑 `scripts/gen-updater-config.mjs`, 从上述 env 生成
`src-tauri/gen/updater.conf.json` (含 `endpoints` + `pubkey`), 再 `tauri build --config` 合并.
未提供公钥时构建仍成功, 仅自动更新优雅禁用 (用 `npm run tauri:build:raw` 可跳过该步).

### 发布新版本到服务器

1. 提升 `src-tauri/tauri.conf.json` 的 `version` (及 `Cargo.toml`), 重新 `npm run tauri:build`.
2. 把安装包 (`.exe`/`.msi`/`.app.tar.gz`/`.AppImage`) 及其 `.sig` 文件, 连同一份
   `manifest.json`, 放到服务器的更新目录 (env `DESKTOP_RELEASE_DIR`, 默认 `<cwd>/desktop-releases`).

`manifest.json` 示例:

```json
{
  "version": "1.1.0",
  "notes": "本次更新内容…",
  "pubDate": "2026-06-30T00:00:00Z",
  "platforms": {
    "windows-x86_64": { "file": "Tandem_1.1.0_x64-setup.exe", "signature": "<.sig 文件内容>" }
  }
}
```

### 客户端更新体验

- 启动后延迟自动静默检查; 有新版 → 右下角弹更新卡片 (`components/desktop/desktop-updater.tsx`).
- 托盘菜单「检查更新」→ 手动检查 (无更新也给反馈).
- 点「立即更新并重启」→ 下载 (带进度) → 安装 → `relaunch()` 重启加载新版本.
- 服务端: `GET /api/desktop/update/{target}/{arch}/{version}` 比对 semver 返回 204 或更新 JSON;
  安装包经 `GET /api/desktop/download/<file>` 流式下发 (两端点在 middleware 白名单内, 由签名保护).

## Notes

- 桌面端 = 瘦客户端, 所以 **业务功能不需要在 Rust 里重写**. 加新业务 API 只改 `app/api/<name>/route.ts`,
  桌面端 webview 加载远端 server 后自动拥有.
- 只有 **原生系统能力** (通知 / 托盘 / 快捷键 / 配置) 才需要动 Rust:
  - `src-tauri/src/main.rs` (`tandem_<name>` + 注册进 `invoke_handler!`)
  - `src-tauri/capabilities/default.json` (按需加 permission)
  - `lib/tauri.ts` (导出一个 `isTauri()` 守卫的封装函数)
- 默认 server URL = `http://localhost:3000`; 局域网/生产由 bootstrap 配置页或 `tandem_set_config` 写入.
- `tauri.conf.json` 开了 `withGlobalTauri`, 让 bootstrap 纯 HTML 能用 `window.__TAURI__.core.invoke`.
