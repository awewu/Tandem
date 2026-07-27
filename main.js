/**
 * 桌面应用启动器
 * 双击此文件即可启动瑞美舒适家居系统桌面版
 * 
 * 使用方式：
 * 方式1：双击此文件（需要安装Node.js）
 * 方式2：运行 build-desktop.bat 构建exe安装包
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

// 检查是否打包运行
const isPackaged = app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: '瑞美舒适家居系统设计平台 v2.0',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    backgroundColor: '#C41230'
  });

  // 加载本地服务器
  mainWindow.loadURL('http://localhost:5000');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
    console.log('瑞美舒适家居系统已启动');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  const serverPath = isPackaged 
    ? path.join(process.resourcesPath, 'server-production.js')
    : path.join(__dirname, 'server-production.js');
    
  serverProcess = spawn('node', [serverPath], {
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (data) => {
    if (data.toString().includes('Server running')) {
      console.log('✓ 服务器已就绪');
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error('服务器错误:', data.toString());
  });
}

app.whenReady().then(() => {
  console.log('正在启动瑞美舒适家居系统...');
  console.log('正在启动本地服务器...');
  
  startServer();
  
  // 等待服务器就绪
  setTimeout(() => {
    console.log('正在打开应用窗口...');
    createWindow();
  }, 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    console.log('服务器已关闭');
  }
  app.quit();
});

app.on('quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
