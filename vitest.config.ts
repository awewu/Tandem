import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
    reporters: ['default'],
    // 单测一律走内存 store (createInMemoryStore). 清空 DATABASE_URL 让各模块的
    // PERSIST_ENABLED 在 import 时取到 false, 否则 vitest 会加载 .env.local 的
    // DATABASE_URL → audit/analytics 等非确定性地读真 PG, 造成 flaky.
    // (e2e 由独立的 Playwright runner 跑, 不受影响)
    env: { DATABASE_URL: '' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
