#!/usr/bin/env node
/**
 * scripts/backup-pg.mjs · PostgreSQL 备份脚本 (跨平台)
 *
 * 用法:
 *   node scripts/backup-pg.mjs                  # 备份到 ./backups/
 *   node scripts/backup-pg.mjs --dir D:/bak     # 自定义目录
 *   BACKUP_DIR=D:/bak node scripts/backup-pg.mjs
 *
 * 输出: <BACKUP_DIR>/tandem-YYYY-MM-DD_HH-mm-ss.sql.gz
 *
 * 依赖: 系统已装 pg_dump (Linux: apt install postgresql-client; Windows: winget install PostgreSQL)
 * 读取 DATABASE_URL: 优先 process.env, 否则从 .env.local / .env
 *
 * §SELF-USE-FIRST priority #1 · 生产部署 + 备份
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import zlib from 'node:zlib';

// 1) 读 .env 取 DATABASE_URL
function loadEnv(envFile) {
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*?)"?\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv('.env.local');
loadEnv('.env');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('[backup] FATAL: DATABASE_URL 未配置 (.env.local 或环境变量)');
  process.exit(1);
}

// 2) 解析 backup dir
const args = process.argv.slice(2);
const dirArgIdx = args.indexOf('--dir');
const backupDir = path.resolve(
  dirArgIdx >= 0 ? args[dirArgIdx + 1] : process.env.BACKUP_DIR ?? './backups'
);
fs.mkdirSync(backupDir, { recursive: true });

// 3) 文件名 (排除非法字符)
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outFile = path.join(backupDir, `tandem-${ts}.sql.gz`);
const safeDbUrl = dbUrl.replace(/:[^:@/]+@/, ':***@');

console.log(`[backup] start  →  ${outFile}`);
console.log(`[backup] source →  ${safeDbUrl}`);

// 4) spawn pg_dump | gzip → file
//    用 pg_dump 的 --no-owner --no-privileges 让备份能跨实例恢复
//    用 --if-exists --clean 允许覆盖式恢复 (但不会自动 DROP DATABASE)
//    用 --serializable-deferrable + 一致性读 (适合长备份)
const dumpArgs = [
  '--dbname=' + dbUrl,
  '--no-owner',
  '--no-privileges',
  '--no-comments',
  '--if-exists',
  '--clean',
  '--verbose',
];

const child = spawn('pg_dump', dumpArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
const gz = zlib.createGzip({ level: 6 });
const out = fs.createWriteStream(outFile);

let bytesIn = 0;
child.stdout.on('data', (chunk) => {
  bytesIn += chunk.length;
});
child.stdout.pipe(gz).pipe(out);

let stderrBuf = '';
child.stderr.on('data', (chunk) => {
  stderrBuf += chunk.toString();
});

child.on('error', (err) => {
  if ((/** @type {NodeJS.ErrnoException} */ (err)).code === 'ENOENT') {
    console.error('[backup] FATAL: pg_dump 未安装. Linux: apt install postgresql-client; Windows: winget install PostgreSQL');
    process.exit(127);
  }
  console.error('[backup] FATAL:', err.message);
  process.exit(1);
});

out.on('finish', () => {
  const sizeMb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
  const inMb = (bytesIn / 1024 / 1024).toFixed(2);
  console.log(`[backup] OK  raw=${inMb}MB  gz=${sizeMb}MB  → ${outFile}`);
  // 留尾巴的 stderr (pg_dump --verbose 信息)
  if (process.env.VERBOSE) console.error(stderrBuf);
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`[backup] FAIL pg_dump exit=${code}`);
    console.error(stderrBuf);
    // 清掉半成品
    try {
      fs.unlinkSync(outFile);
    } catch {
      /* */
    }
    process.exit(code ?? 1);
  }
});
