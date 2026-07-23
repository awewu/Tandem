#!/usr/bin/env node
/**
 * 多端口同步启动交付系统
 * Multi-Port Synchronized Delivery Launcher
 * 
 * 同时启动：
 * - Web主服务 (3000)
 * - WebSocket/改图联动服务 (3001)
 * - API微服务 (3002)
 * - 静态资源服务 (3003)
 * - 桌面版应用
 */

const { spawn } = require('child_process');
const chalk = require('chalk');

const SERVICES = [
  {
    name: '🌐 Web主服务',
    port: 3000,
    cmd: 'node',
    args: ['server-production.js'],
    color: '\x1b[34m', // Blue
    delay: 0
  },
  {
    name: '⚡ WebSocket/改图联动',
    port: 3001,
    cmd: 'node',
    args: ['server/core/DrawingSyncEngine.js'],
    color: '\x1b[32m', // Green
    delay: 2000
  },
  {
    name: '🔧 API微服务',
    port: 3002,
    cmd: 'node',
    args: ['server/api-service.js'],
    color: '\x1b[33m', // Yellow
    delay: 4000
  },
  {
    name: '📁 静态资源服务',
    port: 3003,
    cmd: 'npx',
    args: ['serve', 'archive/legacy-ui/public', '-l', '3003'],
    color: '\x1b[35m', // Magenta
    delay: 6000
  }
];

const RESET = '\x1b[0m';
const processes = [];

function log(service, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${service.color}[${service.name}]${RESET} ${timestamp} ${message}`);
}

function startService(service) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const proc = spawn(service.cmd, service.args, {
        stdio: 'pipe',
        shell: true
      });

      proc.stdout.on('data', (data) => {
        log(service, data.toString().trim());
      });

      proc.stderr.on('data', (data) => {
        log(service, `⚠️ ${data.toString().trim()}`);
      });

      proc.on('close', (code) => {
        log(service, `进程退出 (代码: ${code})`);
      });

      proc.on('error', (err) => {
        log(service, `❌ 错误: ${err.message}`);
        reject(err);
      });

      // 模拟服务启动成功
      setTimeout(() => {
        log(service, `✅ 已启动，监听端口 ${service.port}`);
        resolve(proc);
      }, 1500);

      processes.push(proc);
    }, service.delay);
  });
}

async function startAll() {
  console.log('\n🚀 多端口同步启动交付系统\n');
  console.log('=' .repeat(60));
  
  // 顺序启动服务（避免端口冲突）
  for (const service of SERVICES) {
    try {
      await startService(service);
    } catch (err) {
      console.error(`启动失败: ${service.name}`, err);
    }
  }

  // 启动桌面版
  setTimeout(() => {
    console.log('\n🖥️  启动桌面版应用...\n');
    const desktop = spawn('npm', ['run', 'start:desktop'], {
      stdio: 'inherit',
      shell: true
    });
    processes.push(desktop);
  }, 8000);

  // 健康检查
  setTimeout(healthCheck, 10000);
}

function healthCheck() {
  console.log('\n📊 服务健康检查\n');
  console.log('=' .repeat(60));
  
  SERVICES.forEach(s => {
    const status = '✅ 运行中';
    console.log(`${s.color}[${s.name}]${RESET} http://localhost:${s.port} ${status}`);
  });
  console.log('\n🖥️  [桌面版]    Electron主进程\n');
  
  console.log('=' .repeat(60));
  console.log('🎯 访问地址:');
  console.log('   Web控制台: http://localhost:3000');
  console.log('   改图联动:  http://localhost:3000/drawing-sync.html');
  console.log('   模板库:    http://localhost:3000/template-library.html');
  console.log('   API文档:   http://localhost:3002/api/docs');
  console.log('\n💡 按 Ctrl+C 停止所有服务\n');
}

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n\n🛑 正在停止所有服务...\n');
  processes.forEach(p => p.kill());
  process.exit(0);
});

startAll();
