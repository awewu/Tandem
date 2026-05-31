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

## Notes

- 桌面端 = 瘦客户端, 所以 **业务功能不需要在 Rust 里重写**. 加新业务 API 只改 `app/api/<name>/route.ts`,
  桌面端 webview 加载远端 server 后自动拥有.
- 只有 **原生系统能力** (通知 / 托盘 / 快捷键 / 配置) 才需要动 Rust:
  - `src-tauri/src/main.rs` (`tandem_<name>` + 注册进 `invoke_handler!`)
  - `src-tauri/capabilities/default.json` (按需加 permission)
  - `lib/tauri.ts` (导出一个 `isTauri()` 守卫的封装函数)
- 默认 server URL = `http://localhost:3000`; 局域网/生产由 bootstrap 配置页或 `tandem_set_config` 写入.
- `tauri.conf.json` 开了 `withGlobalTauri`, 让 bootstrap 纯 HTML 能用 `window.__TAURI__.core.invoke`.
