#!/usr/bin/env node
/**
 * scripts/restore-pg.mjs · PostgreSQL 恢复脚本 (跨平台)
 *
 * 用法:
 *   node scripts/restore-pg.mjs backups/tandem-2026-05-27_19-00-00.sql.gz
 *
 * ⚠️ DANGER: 会先 DROP + 重建对象 (--clean 模式), 数据会被覆盖!
 *           请先做一次 backup 再恢复.
 *
 * 步骤:
 *   1. 读 .env 取 DATABASE_URL (生产 RDS 请用真实环境变量, 别写 .env)
 *   2. 防呆: 询问确认 (skip 时设 FORCE=1)
 *   3. gunzip stream → psql stdin
 *   4. 报告 success/fail
 *
 * §SELF-USE-FIRST priority #1 · 备份恢复 SOP 必须演练过一次
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import zlib from 'node:zlib';
import readline from 'node:readline';
import crypto from 'node:crypto';

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
  console.error('[restore] FATAL: DATABASE_URL 未配置');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('用法: node scripts/restore-pg.mjs <backup-file.sql.gz>');
  process.exit(2);
}
const absFile = path.resolve(file);
if (!fs.existsSync(absFile)) {
  console.error('[restore] FATAL: 备份文件不存在:', absFile);
  process.exit(2);
}

const safeDbUrl = dbUrl.replace(/:[^:@/]+@/, ':***@');

async function confirm() {
  if (process.env.FORCE === '1') {
    console.log('[restore] FORCE=1 跳过确认');
    return true;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    console.log('');
    console.log('========================================');
    console.log('⚠️  即将恢复数据库 (会覆盖现有数据)');
    console.log(`   备份文件: ${absFile}`);
    console.log(`   目标 DB:  ${safeDbUrl}`);
    console.log('========================================');
    rl.question('确认继续? 输入 "yes" 继续, 其它取消: ', (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase() === 'yes');
    });
  });
}

function verifyChecksum() {
  const sumFile = `${absFile}.sha256`;
  if (!fs.existsSync(sumFile)) {
    console.warn('[restore] WARN 未找到 .sha256 校验文件, 跳过完整性校验 (旧备份?)');
    return;
  }
  if (process.env.SKIP_CHECKSUM === '1') {
    console.warn('[restore] SKIP_CHECKSUM=1 跳过完整性校验');
    return;
  }
  const expected = fs.readFileSync(sumFile, 'utf8').trim().split(/\s+/)[0];
  const actual = crypto.createHash('sha256').update(fs.readFileSync(absFile)).digest('hex');
  if (expected !== actual) {
    console.error('[restore] FATAL: 校验和不匹配, 备份可能损坏!');
    console.error(`  expected: ${expected}`);
    console.error(`  actual:   ${actual}`);
    console.error('  如确认仍要恢复, 设 SKIP_CHECKSUM=1');
    process.exit(1);
  }
  console.log('[restore] sha256 校验通过 ✓');
}

async function main() {
  verifyChecksum();

  if (!(await confirm())) {
    console.log('[restore] 已取消');
    process.exit(0);
  }

  console.log(`[restore] start  ←  ${absFile}`);
  console.log(`[restore] target →  ${safeDbUrl}`);

  // psql -d <url> -v ON_ERROR_STOP=1 < gunzip(file)
  const psqlArgs = [
    '-d', dbUrl,
    '-v', 'ON_ERROR_STOP=1',
    '--single-transaction',
  ];

  const child = spawn('psql', psqlArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

  const gunzip = zlib.createGunzip();
  fs.createReadStream(absFile).pipe(gunzip).pipe(child.stdin);

  let stderrBuf = '';
  child.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString();
    if (process.env.VERBOSE) process.stderr.write(chunk);
  });

  child.stdout.on('data', () => {
    /* psql 输出忽略 */
  });

  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.error('[restore] FATAL: psql 未安装. Linux: apt install postgresql-client; Windows: winget install PostgreSQL');
      process.exit(127);
    }
    console.error('[restore] FATAL:', err.message);
    process.exit(1);
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`[restore] FAIL psql exit=${code}`);
      console.error(stderrBuf.slice(-2000));
      process.exit(code ?? 1);
    }
    console.log('[restore] OK');
  });
}

main();
