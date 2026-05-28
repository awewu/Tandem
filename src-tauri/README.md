# Tandem Desktop · 瘦客户端 + 系统集成

## 设计哲学
桌面 app = Tauri webview 加载公司局域网 Tandem server (Next.js)。
Rust 后端不重复实现业务，只提供 native 系统能力。

数据存储继续在远端 Postgres，30 人企业自用同源协同。

## Prerequisites
- [Rust](https://rustup.rs/) 已装
- Node.js deps: `npm install`
- 公司 LAN 内有运行中的 Tandem server (`npm run dev` 或生产部署)

## Development
```bash
# 先启 Tandem server (另一终端)
npm run dev   # 监听 :3001

# 再启桌面 dev (内嵌 webview 加载 localhost:3001)
npm run tauri:dev
```

首次启动后, 桌面 app 默认连 `http://localhost:3001`。
切换到公司服务器: 桌面 app → 设置 → 服务地址 → `http://192.1.1.x:3001`

## Build (Windows NSIS installer)
```bash
npm run tauri:build
```
输出: `src-tauri/target/release/bundle/nsis/Tandem_1.0.0_x64-setup.exe`

## Architecture
- `src/main.rs` — Rust 后端 (~270 行), 提供 6 个 Tauri command + 托盘 + 全局快捷键
- `lib/tauri.ts` — 前端适配层 (浏览器无 Tauri 时静默 no-op)

## Native 能力清单
| 命令 | 用途 |
|---|---|
| `tandem_get_config` / `tandem_set_config` | 持久化 server URL / 通知开关 / 自启 (tauri-plugin-store) |
| `tandem_notify(title, body)` | 弹 native 通知 (议事室开始 / ProxyAction 待审 / @我) |
| `tandem_show_main` / `tandem_hide_main` | 唤起/隐藏主窗口到托盘 |
| `tandem_navigate(path)` | webview 导航到指定 Tandem 路径 |

### 全局快捷键
- `Ctrl+Shift+T` → 唤起主窗口
- `Ctrl+Shift+R` → 跳到 5min 日报

### 系统托盘菜单
- 打开 Tandem · 记录 5min 日报 · 查看 OKR 进展 · 退出

### 关窗行为
点击 X → 隐藏到托盘 (不退出), 只有从托盘菜单 "退出" 才真正退出。
