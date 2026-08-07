#!/usr/bin/env node
/**
 * P0-2 门禁 · Redis Stream 事件投递（redis-stream-dispatch-check）
 *
 * 验收委员会「事件投递去临时化 + 多消费者不重复投递证明」裁决：
 *   1) 消费组语义单测存在且全绿（内存替身，确定性证明「一条消息只投一个消费者 + 幂等 + 失败留 PEL」）；
 *   2) 若本机/CI 配置了 Redis（REDIS_URL/HOST 或本地 6379 可达），跑真实 Stream 运行时烟雾，
 *      证明真实消费组 XADD/XREADGROUP/XACK 互斥不重复；无 Redis 时降级为 skip（不阻断）。
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const failures = [];
const notes = [];

// 1) 消费组语义单测（必测存在 + 全绿）
const SEMANTICS_TEST = 'services/api/src/modules/mdm/redis-stream.nodetest.ts';
if (!fs.existsSync(path.join(ROOT, SEMANTICS_TEST))) {
  failures.push(`缺少 Redis Stream 语义单测：${SEMANTICS_TEST}`);
} else {
  try {
    // 跨平台：环境变量走 execSync 的 env 选项，不能用 `VAR=value cmd` 前缀
    // （该前缀是 POSIX shell 语法，在 Windows cmd/PowerShell 下会导致命令解析失败 → 门禁恒红）。
    const out = execSync(
      `node -r ts-node/register/transpile-only --test ${SEMANTICS_TEST}`,
      {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, TS_NODE_PROJECT: 'services/api/tsconfig.json' },
      },
    );
    const fail = (out.match(/^# fail (\d+)/m) || [])[1];
    if (fail && Number(fail) > 0) failures.push(`Redis Stream 语义单测有 ${fail} 个失败`);
  } catch (e) {
    failures.push('Redis Stream 语义单测运行失败');
  }
}

// 2) 真实 Redis 运行时烟雾（有 Redis 才跑）
try {
  const out = execSync('node scripts/release/redis-stream-smoke.js', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (/跳过/.test(out)) notes.push('真实 Redis 不可达，运行时烟雾已 skip（不阻断）');
  else notes.push('真实 Redis 运行时烟雾通过');
} catch (e) {
  failures.push(`Redis Stream 运行时烟雾失败：${String((e.stdout || '') + (e.stderr || '')).slice(0, 300)}`);
}

const evidenceDir = path.join(ROOT, 'evidence', 'events');
try { fs.mkdirSync(evidenceDir, { recursive: true }); } catch { /* noop */ }
try {
  fs.writeFileSync(path.join(evidenceDir, 'redis-stream-dispatch-report.json'),
    JSON.stringify({ guard: 'redis-stream-dispatch-check', at: new Date().toISOString(), passed: failures.length === 0, failures, notes }, null, 2));
} catch { /* noop */ }

for (const n of notes) console.log(`ℹ️  ${n}`);
if (failures.length) {
  console.error('❌ redis-stream-dispatch-check 未通过：');
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log('✅ redis-stream-dispatch-check 通过：消费组语义单测全绿；真实 Redis 烟雾通过或按需 skip。');
