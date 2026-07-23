/**
 * 全局定时器注册表
 * 2026-04-22 P1 定时器泄漏治理
 *
 * 目标:
 *   1. 所有 setInterval/setTimeout 登记到统一注册表
 *   2. 进程 SIGTERM/SIGINT 优雅退出时批量清理
 *   3. 运行时可观测当前活跃定时器数量
 *
 * 使用:
 *   const { registerInterval, registerTimeout, shutdownAllTimers } = require('./server/utils/timer-registry');
 *   const id = registerInterval(() => doWork(), 5000, 'heartbeat');
 *   // ...
 *   // 进程退出时自动清理（或手动 shutdownAllTimers()）
 */

const timers = new Map();  // id → { type, name, ref }
let nextId = 1;

function registerInterval(fn, ms, name = 'unnamed') {
  const ref = setInterval(fn, ms);
  const id = nextId++;
  timers.set(id, { type: 'interval', name, ref, createdAt: new Date() });
  return { id, ref };  // 调用方可选择 clearInterval(ref) 或 unregister(id)
}

function registerTimeout(fn, ms, name = 'unnamed') {
  const ref = setTimeout(() => {
    try { fn(); } finally { timers.delete(id); }
  }, ms);
  const id = nextId++;
  timers.set(id, { type: 'timeout', name, ref, createdAt: new Date() });
  return { id, ref };
}

function unregister(id) {
  const t = timers.get(id);
  if (!t) return false;
  if (t.type === 'interval') clearInterval(t.ref);
  else clearTimeout(t.ref);
  timers.delete(id);
  return true;
}

function stats() {
  const byName = {};
  for (const t of timers.values()) {
    byName[t.name] = (byName[t.name] || 0) + 1;
  }
  return { active: timers.size, byName };
}

function shutdownAllTimers() {
  const count = timers.size;
  for (const [, t] of timers) {
    if (t.type === 'interval') clearInterval(t.ref);
    else clearTimeout(t.ref);
  }
  timers.clear();
  return count;
}

// 进程退出自动清理
['SIGTERM', 'SIGINT', 'SIGQUIT'].forEach(sig => {
  process.once(sig, () => {
    const n = shutdownAllTimers();
    console.log(`🧹 [${sig}] 已清理 ${n} 个已登记定时器`);
    process.exit(0);
  });
});

module.exports = { registerInterval, registerTimeout, unregister, stats, shutdownAllTimers };
