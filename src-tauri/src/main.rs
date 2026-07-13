// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/*!
 * Tandem Desktop · 瘦客户端 + 系统集成层
 *
 * 设计哲学:
 *   桌面 app = Tauri webview 加载公司局域网 Tandem server (Next.js).
 *   Rust 后端不重复实现业务, 只提供 native 系统能力:
 *     - System tray (托盘图标 + 右键菜单)
 *     - Native notification (议事室开始 / ProxyAction 待审 / @我)
 *     - Global shortcut (Ctrl+Shift+T 唤起, Ctrl+Shift+R 跳日报)
 *     - Autostart (开机自启)
 *     - Server URL 持久化 (首次启动让用户配置公司 LAN IP)
 *     - 系统浏览器外链
 *
 * 数据存储: 不动. 所有 OKR/IM/CompanyBrain 数据继续在远端 Tandem server (Postgres).
 * 这样 30 人企业自用阶段, 同一份数据同源协同, 桌面 app 跟 web 版本完全等价 + 系统集成增强.
 */

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Window,
};
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;

// =====================================================================
// Config (server URL, theme, prefs) — 落 disk via tauri-plugin-store
// =====================================================================

const CONFIG_FILE: &str = "tandem-config.json";

/// 默认服务器 URL。
///
/// 本机自用 (无环境变量): http://127.0.0.1:3005
/// 公司分发 (build 时设 TANDEM_DEFAULT_SERVER_URL=https://tandem.yourco.com):
///   该值被烒进可执行文件, 员工装包即连上, 无需手填.
/// bootstrap (dist/index.html) 连不上会弹配置表单托底.
const DEFAULT_SERVER_URL: &str = match option_env!("TANDEM_DEFAULT_SERVER_URL") {
    Some(u) => u,
    None => "http://127.0.0.1:3005",
};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TandemConfig {
    /// 公司局域网 Tandem server URL, 默认 http://127.0.0.1:3005 (本机生产).
    /// 注: 必须用 127.0.0.1 而非 localhost —— WebView2 渲染进程(AppContainer) 够不到 IPv6 ::1,
    /// localhost 会被解析成 ::1 导致 ERR_FAILED; 显式 IPv4 127.0.0.1 才能连上.
    /// 生产部署后改成 http://192.1.1.x:3005 (公司服务器 IP), 由 bootstrap 连接网关页或应用内设置写入
    server_url: String,
    /// 是否启用 native 通知 (默认 true)
    notify_enabled: bool,
    /// 是否开机自启 (默认 false)
    autostart_enabled: bool,
}

impl Default for TandemConfig {
    fn default() -> Self {
        Self {
            server_url: DEFAULT_SERVER_URL.into(),
            notify_enabled: true,
            autostart_enabled: false,
        }
    }
}

fn load_config(app: &AppHandle) -> TandemConfig {
    let store = match app.store(CONFIG_FILE) {
        Ok(s) => s,
        Err(_) => return TandemConfig::default(),
    };
    let server_url = store
        .get("server_url")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| DEFAULT_SERVER_URL.into());
    let notify_enabled = store
        .get("notify_enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let autostart_enabled = store
        .get("autostart_enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    TandemConfig {
        server_url,
        notify_enabled,
        autostart_enabled,
    }
}

fn save_config(app: &AppHandle, cfg: &TandemConfig) -> Result<(), String> {
    let store = app
        .store(CONFIG_FILE)
        .map_err(|e| format!("store open failed: {e}"))?;
    store.set("server_url", json!(cfg.server_url));
    store.set("notify_enabled", json!(cfg.notify_enabled));
    store.set("autostart_enabled", json!(cfg.autostart_enabled));
    store
        .save()
        .map_err(|e| format!("store save failed: {e}"))?;
    Ok(())
}

// =====================================================================
// Tauri commands (前端通过 invoke 调用)
// =====================================================================

#[tauri::command]
fn tandem_get_config(app: AppHandle) -> Result<Value, String> {
    let cfg = load_config(&app);
    Ok(json!({
        "serverUrl": cfg.server_url,
        "notifyEnabled": cfg.notify_enabled,
        "autostartEnabled": cfg.autostart_enabled,
    }))
}

#[tauri::command]
fn tandem_set_config(
    app: AppHandle,
    server_url: Option<String>,
    notify_enabled: Option<bool>,
    autostart_enabled: Option<bool>,
) -> Result<(), String> {
    let mut cfg = load_config(&app);
    if let Some(u) = server_url {
        cfg.server_url = u;
    }
    if let Some(n) = notify_enabled {
        cfg.notify_enabled = n;
    }
    if let Some(a) = autostart_enabled {
        cfg.autostart_enabled = a;
        // 同步系统自启状态
        let manager = app.autolaunch();
        let _ = if a {
            manager.enable()
        } else {
            manager.disable()
        };
    }
    save_config(&app, &cfg)?;
    Ok(())
}

#[tauri::command]
fn tandem_notify(app: AppHandle, title: String, body: String) -> Result<(), String> {
    let cfg = load_config(&app);
    if !cfg.notify_enabled {
        return Ok(());
    }
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| format!("notification show failed: {e}"))?;
    Ok(())
}

/// 主窗口居中并唤起 (托盘菜单 + 全局快捷键调用)
#[tauri::command]
fn tandem_show_main(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn tandem_hide_main(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
    Ok(())
}

/// 导航 webview 到指定路径 (相对当前 server_url)
#[tauri::command]
fn tandem_navigate(app: AppHandle, path: String) -> Result<(), String> {
    let cfg = load_config(&app);
    let url = if path.starts_with("http") {
        path
    } else {
        format!(
            "{}{}",
            cfg.server_url.trim_end_matches('/'),
            if path.starts_with('/') {
                path
            } else {
                format!("/{}", path)
            }
        )
    };
    if let Some(win) = app.get_webview_window("main") {
        let _ = tandem_show_main(app.clone());
        win.eval(&format!("window.location.href = '{}'", url))
            .map_err(|e| format!("navigate failed: {e}"))?;
    }
    Ok(())
}

// =====================================================================
// System Tray
// =====================================================================

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItemBuilder::with_id("show", "打开 Tandem").build(app)?;
    let report_item = MenuItemBuilder::with_id("report", "记录 5min 日报").build(app)?;
    let okr_item = MenuItemBuilder::with_id("okr", "查看 OKR 进展").build(app)?;
    let update_item = MenuItemBuilder::with_id("check-update", "检查更新").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .separator()
        .item(&report_item)
        .item(&okr_item)
        .separator()
        .item(&update_item)
        .item(&quit_item)
        .build()?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Tandem · 牛马搭子")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                let _ = tandem_show_main(app.clone());
            }
            "report" => {
                let _ = tandem_navigate(app.clone(), "/report".into());
            }
            "okr" => {
                let _ = tandem_navigate(app.clone(), "/okr".into());
            }
            "check-update" => {
                // 唤起窗口并通知前端 DesktopUpdater 触发一次手动检查更新.
                let _ = tandem_show_main(app.clone());
                let _ = app.emit("tandem://check-update", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // 左键单击托盘 = 唤起主窗口
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = tandem_show_main(tray.app_handle().clone());
            }
        })
        .build(app)?;

    Ok(())
}

// =====================================================================
// Global Shortcuts
// =====================================================================

fn setup_global_shortcuts(app: &AppHandle) -> tauri::Result<()> {
    // Ctrl+Shift+T → 唤起主窗口
    let show_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyT);
    // Ctrl+Shift+R → 跳到 5min 日报
    let report_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyR);

    let app_handle = app.clone();
    if let Err(e) = app.global_shortcut().on_shortcut(show_shortcut, move |_app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            let _ = tandem_show_main(app_handle.clone());
        }
    }) {
        eprintln!("[warn] global shortcut Ctrl+Shift+T already taken by another app: {e}");
    }

    let app_handle2 = app.clone();
    if let Err(e) = app.global_shortcut().on_shortcut(report_shortcut, move |_app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            let _ = tandem_navigate(app_handle2.clone(), "/report".into());
        }
    }) {
        eprintln!("[warn] global shortcut Ctrl+Shift+R already taken by another app: {e}");
    }

    Ok(())
}

// =====================================================================
// 关窗 → 不退出, 缩到托盘
// =====================================================================

fn on_window_close(window: &Window, api: tauri::CloseRequestApi) {
    // 阻止默认关闭, 改为隐藏到托盘
    api.prevent_close();
    let _ = window.hide();
}

// =====================================================================
// 启动: 托盘 + 快捷键 (页面加载/跳转由 devUrl 或 bootstrap 网关页负责)
// =====================================================================

fn on_setup(app: &AppHandle) -> tauri::Result<()> {
    setup_tray(app)?;
    setup_global_shortcuts(app)?;

    // 生产模式: 窗口创建后直接导航到配置的 serverUrl (不依赖 bootstrap 的 JS 导航,
    // 避免 WebView2 安全策略或代理环境对 window.location.replace 的拦截)
    #[cfg(not(debug_assertions))]
    {
        let cfg = load_config(app);
        let url = cfg.server_url;
        if let Some(win) = app.get_webview_window("main") {
            let _ = win.navigate(&url);
        }
    }
    Ok(())
}

// =====================================================================
// main
// =====================================================================

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                on_window_close(window, api.clone());
            }
        })
        .setup(|app| {
            on_setup(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tandem_get_config,
            tandem_set_config,
            tandem_notify,
            tandem_show_main,
            tandem_hide_main,
            tandem_navigate,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tandem application");
}
