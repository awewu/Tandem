/**
 * 桌面端服务编排器
 * 启动时按依赖顺序拉起本地服务栈，轮询就绪后通知主窗口加载。
 *
 * 服务分两类：
 *   基础设施（数据库）— 不由桌面端启动，只检测，未就绪给明确提示
 *   应用服务（Node）— 桌面端 spawn 拉起，端口已占用则复用
 */

const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 应用服务定义（按启动顺序）
const SERVICES = [
  {
    name: 'NestJS API',
    port: 3300,
    cmd: 'node_modules/.bin/ts-node',
    args: ['--project', 'services/api/tsconfig.json', '--transpile-only', 'services/api/src/main.ts'],
    envFile: '.env.nestjs',
    health: '/api/v2/health',
  },
  {
    name: 'Express 网关',
    port: 3001,
    cmd: 'node',
    args: ['server-production.js'],
    health: '/api/v2/health',
  },
  {
    name: '经销商工作台',
    port: 4000,
    cmd: 'npm',
    args: ['start'],
    cwd: path.join(ROOT, 'apps', 'dealer-workbench'),
    health: '/',
  },
];

// 基础设施（仅检测 TCP 端口）
const INFRA = [
  { name: 'MongoDB', port: 27017 },
  { name: 'PostgreSQL', port: 5432 },
];

const procs = [];

function tcpOpen(port, timeout = 1200) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (ok) => { sock.destroy(); resolve(ok); };
    sock.setTimeout(timeout);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', () => done(false));
    sock.connect(port, '127.0.0.1');
  });
}

function httpOk(port, pathname, timeout = 1500) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname, timeout }, (res) => {
      res.resume();
      resolve(res.statusCode > 0 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function loadEnvFile(file) {
  const fs = require('fs');
  const full = path.join(ROOT, file);
  const env = {};
  if (fs.existsSync(full)) {
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2];
    }
  }
  return env;
}

async function waitReady(svc, log, maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await httpOk(svc.port, svc.health)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  log(`⚠️ ${svc.name} 在 ${maxMs / 1000}s 内未就绪 (port ${svc.port})`);
  return false;
}

async function startService(svc, log) {
  if (await tcpOpen(svc.port)) {
    log(`↺ ${svc.name} 端口 ${svc.port} 已就绪，复用`);
    return waitReady(svc, log, 10000);
  }
  log(`▶ 启动 ${svc.name} (port ${svc.port}) ...`);
  const env = { ...process.env, ...(svc.envFile ? loadEnvFile(svc.envFile) : {}) };
  const p = spawn(svc.cmd, svc.args, { cwd: svc.cwd || ROOT, env, stdio: 'pipe' });
  p.stderr.on('data', (d) => {
    const m = d.toString().trim().split('\n')[0];
    if (m) log(`  [${svc.name}] ${m.slice(0, 120)}`);
  });
  p.on('exit', (code) => log(`✖ ${svc.name} 退出 (code ${code})`));
  procs.push(p);
  return waitReady(svc, log);
}

/**
 * 启动全部服务，返回 { ready, infra }
 * onProgress(text) 用于把进度推给加载页
 */
async function bootAll(onProgress = () => {}) {
  const log = (t) => { console.log('[orchestrator]', t); onProgress(t); };

  // 1. 检测基础设施
  const infra = [];
  for (const i of INFRA) {
    const up = await tcpOpen(i.port);
    infra.push({ ...i, up });
    log(up ? `✓ ${i.name} 已连接` : `✗ ${i.name} 未运行 (port ${i.port})`);
  }

  // 2. 顺序启动应用服务
  for (const svc of SERVICES) {
    await startService(svc, log);
  }

  const ready = await httpOk(4000, '/');
  log(ready ? '✅ 全部就绪，正在打开工作台...' : '⚠️ 工作台未就绪');
  return { ready, infra };
}

function killAll() {
  for (const p of procs) {
    try { p.kill(); } catch (_) { /* noop */ }
  }
}

module.exports = { bootAll, killAll, SERVICES, INFRA, UI_PORT: 4000 };
