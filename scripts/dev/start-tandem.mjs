#!/usr/bin/env node
/**
 * start-tandem — 本地启动 Tandem（员工侧中枢：身份 + AI 网关），供 Nexus 集成联调。
 *
 * 背景（仓库拓扑，务必理解）：
 *   本机同一份 git 仓库有两条产品分支、两个工作区——
 *     · E:\Hermes  → 分支 nexus-main → **Nexus**（services/api NestJS + apps/ 前端）
 *     · E:\Tandem  → 分支 main       → **Tandem**（Next.js App Router，含 app/api/llm-stream 与 lib/boot）
 *   所以 E:\Hermes 下的 app/api/** 只是旧 checkout 残留的空目录壳，Tandem 代码不在本分支。
 *   跑 Tandem 必须在 E:\Tandem 工作区里跑，切勿把 Tandem 文件恢复进 nexus-main（跨分支污染）。
 *
 * 密钥单一来源：Tandem 的真实 env（DATABASE_URL / DEEPSEEK_*）目前只存在于 E:\Hermes\.env.local
 * （该工作区曾检出 main 时留下）。本脚本**运行时读取并注入**给 Tandem 进程，
 * 不在磁盘上复制出第二份密钥文件。
 *
 * 用法：node scripts/dev/start-tandem.mjs   （默认端口 3000）
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TANDEM_DIR = process.env.TANDEM_DIR || 'E:\\Tandem';
const ENV_FILE = process.env.TANDEM_ENV_FILE || resolve(process.cwd(), '.env.local');
const PORT = process.env.TANDEM_PORT || '3000';

if (!existsSync(TANDEM_DIR)) {
  console.error(`Tandem 工作区不存在：${TANDEM_DIR}（可用 TANDEM_DIR 指定）`);
  process.exit(1);
}
if (!existsSync(ENV_FILE)) {
  console.error(`未找到 Tandem env：${ENV_FILE}（需含 DATABASE_URL / DEEPSEEK_*）`);
  process.exit(1);
}

/** 解析 .env（不打印任何值） */
function parseEnv(file) {
  const out = {};
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

const injected = parseEnv(ENV_FILE);
console.log(`注入 ${Object.keys(injected).length} 个环境变量（键名：${Object.keys(injected).join(', ')}）—— 值不回显`);
console.log(`启动 Tandem：${TANDEM_DIR} @ :${PORT}`);

const child = spawn('npm', ['run', 'dev', '--', '--port', PORT], {
  cwd: TANDEM_DIR,
  env: { ...process.env, ...injected, PORT },
  stdio: 'inherit',
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
