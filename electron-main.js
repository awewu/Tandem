/**
 * 瑞美舒适家居系统 - 桌面应用
 */

const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;
let tray = null;
let isQuitting = false;
const SERVER_PORT = 3000;

// ===== 诊断日志：写入 desktop-debug.log，与控制台双通道 =====
const DEBUG_LOG = path.join(__dirname, 'desktop-debug.log');
function dlog(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}`;
  console.log(line);
  try { fs.appendFileSync(DEBUG_LOG, line + '\n'); } catch (_) {}
}
// 启动即清空日志
try { fs.writeFileSync(DEBUG_LOG, `=== Desktop session started ${new Date().toISOString()} ===\n`); } catch (_) {}

// 防御：禁用 GPU 加速可避免 Win 上一类渲染异常（按需启用，不影响功能）
// app.disableHardwareAcceleration();

// 命令行参数：允许跨域（与 webSecurity:false 协同）
app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy,CrossOriginEmbedderPolicy');

function createWindow() {
  console.log('[Electron] 创建窗口...');
  
  // 如果窗口已存在但隐藏，恢复它
  if (mainWindow) {
    if (!mainWindow.isVisible()) {
      console.log('[Electron] 恢复隐藏的窗口...');
      mainWindow.show();
      mainWindow.focus();
    }
    return;
  }
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: true,
    backgroundColor: '#ffffff',  // 白底，避免红屏假象
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      // ✅ 与浏览器端保持一致：开启所有标准 Web API
      sandbox: false,
      backgroundThrottling: false
    }
  });

  createMenu();

  // ===== 诊断：监听所有可能失败的事件 =====
  const wc = mainWindow.webContents;
  wc.on('did-fail-load', (_, code, desc, url) => dlog('❌ did-fail-load', { code, desc, url }));
  wc.on('did-finish-load', () => dlog('✅ did-finish-load', wc.getURL()));
  wc.on('render-process-gone', (_, details) => dlog('💥 render-process-gone', details));
  wc.on('preload-error', (_, preload, err) => dlog('⚠️ preload-error', preload, err && err.message));
  wc.on('console-message', (_, level, message, line, sourceId) => {
    const lv = ['log', 'warn', 'error', 'debug'][level] || level;
    if (lv === 'error' || lv === 'warn') dlog(`[page-${lv}]`, message, `${sourceId}:${line}`);
  });
  wc.on('did-navigate', (_, u) => dlog('➡️ did-navigate', u));
  wc.on('did-navigate-in-page', (_, u) => dlog('➡️ did-navigate-in-page', u));

  // 清空缓存，确保拿到最新前端代码
  wc.session.clearCache().then(() => dlog('🧹 cache cleared')).catch(e => dlog('cache clear failed', e.message));

  // 与浏览器端保持一致：加载根路径，由后端统一路由到 index-ready.html
  const url = `http://localhost:${SERVER_PORT}/`;
  dlog('[Electron] 加载:', url);

  mainWindow.loadURL(url).catch(err => {
    dlog('[Electron] 加载失败:', err.message);
  });

  // 启动即开 DevTools，方便用户/我快速定位
  mainWindow.once('ready-to-show', () => {
    if (process.env.DESKTOP_DEVTOOLS !== '0') {
      wc.openDevTools({ mode: 'detach' });
    }
  });

  // 窗口关闭时最小化到托盘
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (tray) {
        tray.displayBalloon({
          iconType: 'info',
          title: '瑞美舒适家居系统',
          content: '应用已最小化到系统托盘，后台持续运行中'
        });
      }
      console.log('[Electron] 窗口隐藏到托盘');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  // 桌面端菜单与浏览器端 index-ready.html 顶部导航保持一致
  const go = (p) => () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.loadURL(`http://localhost:${SERVER_PORT}${p}`);
    }
  };

  const template = [
    { label: '文件', submenu: [
      { label: '🏠 首页', accelerator: 'Ctrl+H', click: go('/') },
      { type: 'separator' },
      { label: '退出', accelerator: 'Ctrl+Q', click: () => { isQuitting = true; app.quit(); } }
    ]},
    { label: '视图', submenu: [
      { label: '后退', accelerator: 'Alt+Left', click: () => mainWindow && mainWindow.webContents.goBack() },
      { label: '重新加载', accelerator: 'F5', click: () => mainWindow && mainWindow.reload() },
      { label: '开发者工具', accelerator: 'F12', click: () => mainWindow && mainWindow.webContents.toggleDevTools() }
    ]},
    { label: '\u5de5\u4f5c\u53f0', submenu: [
      { label: '\ud83e\udd16 \u75db\u70b9\u95ee\u8bca', click: go('/pain-diagnosis.html') },
      { label: '\ud83c\udfa8 \u8bbe\u8ba1\u5e08\u5de5\u4f5c\u53f0', click: go('/designer.html') },
      { label: '\ud83d\udcca \u9500\u552e\u5de5\u4f5c\u53f0', click: go('/sales.html') },
      { label: '\ud83d\udcbc \u9500\u552e\u5feb\u901f\u9501\u5ba2', click: go('/quick-lock.html') },
      { label: '\ud83d\udcd0 \u65b9\u6848\u56fe\u7eb8', click: go('/solution-view.html') }
    ]},
    // Rysnova BIM \u5e73\u53f0
    { label: '\ud83c\udfd7\ufe0f Rysnova BIM', submenu: [
      { label: '\ud83c\udfaf \u4e13\u4e1a\u8bbe\u8ba1\uff08\u8bbe\u8ba1\u5e08\u5168\u6d41\u7a0b\uff09', click: go('/rysnova-bim-designer.html') },
      { label: '\ud83d\ude80 \u6237\u578b\u5feb\u901f BIM\uff08\u9500\u552e/\u4e1a\u4e3b\uff09', click: go('/floorplan-bim.html') },
      { label: '\ud83d\udc41\ufe0f 3D \u6d4f\u89c8\u5668\uff08\u53ea\u8bfb\u5ba1\u67e5\uff09', click: go('/bim-viewer.html') },
      { label: '\ud83d\udce4 IFC/Revit/DWG \u5bfc\u51fa', click: go('/bim-export.html') }
    ]},
    { label: '客户/方案', submenu: [
      { label: '👤 客户入口', click: go('/customer-view.html') },
      { label: '📋 方案汇总', click: go('/solution-summary.html') },
      { label: '💰 报价管理', click: go('/quotations.html') },
      { label: '📚 方案模板库', click: go('/template-library.html') }
    ]},
    { label: '运维', submenu: [
      { label: '🔧 技术支持中心', click: go('/technical-support.html') },
      { label: '📡 Econet 监控', click: go('/econet-dashboard.html') },
      { label: '🛠️ 维保计划', click: go('/maintenance-schedule.html') },
      { label: '🎫 服务工单', click: go('/service-tickets.html') }
    ]},
    { label: '管理', submenu: [
      { label: '🏢 管理员后台', click: go('/admin-dashboard.html') },
      { label: '📈 数据分析', click: go('/analytics.html') }
    ]}
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  console.log('[Electron] 创建系统托盘...');
  
  // 使用SVG图标或创建原生图标
  const iconPath = path.join(__dirname, 'public', 'favicon.svg');
  if (require('fs').existsSync(iconPath)) {
    tray = new Tray(iconPath);
  } else {
    // 如果没有图标文件，创建一个原生图像
    const { nativeImage } = require('electron');
    const icon = nativeImage.createFromNamedImage('imageres', 104); // Windows系统图标
    tray = new Tray(icon);
  }
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '🏠 打开主窗口', click: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    }},
    { type: 'separator' },
    { label: '💼 快速锁客', click: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.loadURL(`http://localhost:${SERVER_PORT}/quick-lock.html`);
      }
    }},
    { label: '🎨 设计师工作台', click: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.loadURL(`http://localhost:${SERVER_PORT}/designer.html`);
      }
    }},
    { label: '🔧 技术支持中心', click: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.loadURL(`http://localhost:${SERVER_PORT}/technical-support.html`);
      }
    }},
    { type: 'separator' },
    { label: '❌ 完全退出', click: () => {
      isQuitting = true;
      if (serverProcess) serverProcess.kill();
      app.quit();
    }}
  ]);
  
  tray.setToolTip('瑞美舒适家居系统 - 运行中');
  tray.setContextMenu(contextMenu);
  
  // 点击托盘图标显示窗口
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    } else {
      createWindow();
    }
  });
  
  console.log('[Electron] 托盘创建成功');
}

async function checkPortInUse(port) {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(`http://localhost:${port}/`, { timeout: 1500 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function startServer() {
  // 若已有服务器在 3000 上（典型场景：浏览器开发模式已经跑着），直接复用
  if (await checkPortInUse(SERVER_PORT)) {
    dlog('[服务器] 检测到 3000 端口已就绪，跳过 spawn，直接复用');
    setTimeout(createWindow, 200);
    return;
  }

  dlog('[服务器] 启动子进程 server-production.js ...');
  serverProcess = spawn('node', ['server-production.js'], { cwd: __dirname, stdio: 'pipe' });

  serverProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('Server running') && !mainWindow) {
      setTimeout(createWindow, 500);
    }
  });
  serverProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) dlog('[服务器err]', msg.split('\n')[0]);
  });
  serverProcess.on('exit', (code) => dlog('[服务器] exit', code));

  // 兜底：3 秒后无论如何起窗
  setTimeout(() => { if (!mainWindow) createWindow(); }, 3000);
}

app.whenReady().then(() => {
  dlog('[Electron] 就绪');
  createTray();
  startServer();
});

app.on('window-all-closed', () => {
  // 不退出，保持后台运行
  console.log('[Electron] 所有窗口已关闭，后台继续运行');
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});
