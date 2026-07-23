/**
 * 瑞诺瓦AI舒适家 桌面端主进程
 * 主窗口加载 business-console.html（功能完整的业务控制台）
 * 菜单覆盖所有主要功能入口
 */

const _electron = require('electron');
const { app, BrowserWindow, Menu, Tray, nativeImage } = _electron.default || _electron;

app.disableHardwareAcceleration();

const path = require('path');
const { bootAll, killAll } = require('./orchestrator');

// 功能完整的界面在 Express(3001)，不在 Next.js(4000)
const BASE = 'http://localhost:3001';

let win = null;
let tray = null;
let quitting = false;

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 680,
    show: true, backgroundColor: '#1a1f36', title: '瑞诺瓦AI舒适家',
    webPreferences: { nodeIntegration: false, contextIsolation: true, webSecurity: false, backgroundThrottling: false },
  });

  win.loadFile(path.join(__dirname, 'loading.html'));
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });

  bootAll((text) => {
    if (win && !win.isDestroyed()) win.webContents.send('boot-progress', text);
  }).then(({ ready }) => {
    if (win) win.loadURL(ready ? `${BASE}/business-console.html` : `${BASE}/login.html`);
  });

  buildMenu();
}

function go(page) {
  return () => { if (win) { win.show(); win.loadURL(`${BASE}/${page}`); } };
}

function buildMenu() {
  const tpl = [
    { label: '文件', submenu: [
      { label: '首页', accelerator: 'CmdOrCtrl+H', click: go('business-console.html') },
      { label: '刷新', accelerator: 'F5', click: () => win?.reload() },
      { type: 'separator' },
      { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => { quitting = true; app.quit(); } },
    ]},
    { label: '工作台', submenu: [
      { label: '🏢 业务控制台', click: go('business-console.html') },
      { label: '👤 员工入口', click: go('staff-portal.html') },
      { label: '🔑 登录', click: go('login.html') },
    ]},
    { label: '设计 & BIM', submenu: [
      { label: '🎨 设计师工作台', click: go('designer.html') },
      { label: '🏗️ Rysnova BIM', click: go('rysnova-bim-designer.html') },
      { label: '📐 2D 新工作台', click: go('dashboard/design') },
    ]},
    { label: '瑞诺瓦', submenu: [
      { label: '🩺 AI 痛点问诊', click: go('pain-diagnosis.html') },
      { label: '📊 Econet 监控', click: go('econet-dashboard.html') },
    ]},
    { label: '客户', submenu: [
      { label: '📋 客户项目门户', click: go('customer-view.html') },
      { label: '🔗 方案分享', click: go('customer-share.html') },
    ]},
    { label: '运维', submenu: [
      { label: '🔧 施工管理', click: go('construction-management.html') },
      { label: '📈 数据分析', click: go('analytics.html') },
    ]},
    { label: '视图', submenu: [
      { label: '后退', accelerator: 'Alt+Left', click: () => win?.webContents.goBack() },
      { label: '前进', accelerator: 'Alt+Right', click: () => win?.webContents.goForward() },
      { label: '开发者工具', accelerator: 'F12', click: () => win?.webContents.toggleDevTools() },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

function createTray() {
  const ico = path.join(__dirname, '..', 'public', 'favicon.ico');
  try { tray = new Tray(require('fs').existsSync(ico) ? ico : nativeImage.createEmpty()); }
  catch (_) { tray = new Tray(nativeImage.createEmpty()); }
  tray.setToolTip('瑞诺瓦AI舒适家');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '业务控制台', click: go('business-console.html') },
    { label: '设计师工作台', click: go('designer.html') },
    { label: 'Rysnova BIM', click: go('rysnova-bim-designer.html') },
    { label: 'AI 问诊', click: go('pain-diagnosis.html') },
    { type: 'separator' },
    { label: '完全退出', click: () => { quitting = true; killAll(); app.quit(); } },
  ]));
  tray.on('click', () => { if (win) win.isVisible() ? win.focus() : win.show(); else createWindow(); });
}

app.whenReady().then(() => { createTray(); createWindow(); });
app.on('window-all-closed', () => { /* 托盘常驻 */ });
app.on('before-quit', () => { quitting = true; killAll(); });
app.on('activate', () => { if (!win) createWindow(); else win.show(); });
