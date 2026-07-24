import { defineConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';

/**
 * 独立的 PMS DB 集成测试配置 (opt-in).
 *
 * 与默认 vitest.config.ts 的区别:
 *   - 默认配置强制 DATABASE_URL='' (保证纯函数单测确定性, 见其注释).
 *   - 本配置从 .env.local 读取真实 DATABASE_URL, 连本地真库 (localhost:5432)
 *     跑 PMS service 的真 drizzle 查询 (真 schema + 真 orgId 隔离).
 *   - 只匹配 tests/integration-db/**\/*.itest.ts (不与默认 *.test.ts 冲突,
 *     不进 `npm test` / pre-commit)。
 *
 * 安全: 所有测试数据挂唯一租户 (见 pms.itest.ts TEST_TENANT), afterAll 全清理。
 * 运行: npm run test:pms-integration
 */

/** 手动解析 .env.local (无 dotenv 依赖, 与 scripts/*.mjs 同款) */
function loadDatabaseUrl(): string {
  const envPath = path.resolve(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return '';
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== 'DATABASE_URL') continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return '';
}

export default defineConfig({
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    include: ['tests/integration-db/**/*.itest.ts'],
    environment: 'node',
    globals: true,
    reporters: ['default'],
    // 集成测试串行, 避免多文件并发写同一真库造成互扰。
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: { DATABASE_URL: loadDatabaseUrl(), TZ: 'UTC' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
