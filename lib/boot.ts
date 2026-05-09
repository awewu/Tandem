/**
 * App Bootstrap · 启动注入
 *
 * 在 Next.js server-side 第一次访问时初始化 store + 路由器.
 * 客户端通过 API 访问, 不直接 import 这里.
 */

import { setStore, getStore } from './storage/repository';
import { createInMemoryStore } from './storage/memory-store';
import { TandemRouter, createDefaultRouter, createLocalDevRouter } from './taf';
import { ConvergenceOrchestrator } from './convergence/orchestrator';
import { seedDevData } from './fixtures/seed';
import { registerBuiltinSkills } from './taf/skills';
import { bootstrapOwnerIfMissing } from './auth/bootstrap';

// 单例
let _booted = false;
let _seedPromise: Promise<void> | null = null;
let _router: TandemRouter | null = null;
let _orchestrator: ConvergenceOrchestrator | null = null;

/**
 * 同步初始化 store / router / orchestrator (无 IO).
 * 多次调用幂等. 不触发 seed.
 */
function bootSync(): void {
  if (_booted) return;
  setStore(createInMemoryStore());

  // 优先尝试默认路由器, 失败 fall back 到本地 dev
  try {
    _router = createDefaultRouter();
    if (_router.listProviders().length === 0) {
      // 无 API key, 用本地 ollama 路由器 (即使 ollama 没起也不抛错)
      _router = createLocalDevRouter();
    }
  } catch {
    _router = createLocalDevRouter();
  }

  _orchestrator = new ConvergenceOrchestrator(_router);
  registerBuiltinSkills();
  // 自研身份系统: 首次启动建 owner (幂等)
  bootstrapOwnerIfMissing().catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[boot] bootstrap auth owner failed:', err);
  });
  _booted = true;

  // Seed dev data (in-memory store only) — 启动 promise, 由 boot() 暴露给 await
  if (process.env.NODE_ENV !== 'production') {
    _seedPromise = seedDevData().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[boot] seed failed:', err);
    });
  } else {
    _seedPromise = Promise.resolve();
  }

  // 议事室 17min 硬上限闭环: 每 30 秒 sweep 活跃议事室, 超时自动 ESCALATE
  // (生产环境用 cron / job queue, V1 用 setInterval 简化)
  startConvergenceTickLoop();
}

/**
 * 异步启动: 同步建好 store/router, 然后 await 完整 seed.
 * API 路由应统一 `await boot()`, 避免首屏 race 读到空 store.
 */
export async function boot(): Promise<void> {
  bootSync();
  if (_seedPromise) await _seedPromise;
}

let _tickIntervalId: ReturnType<typeof setInterval> | null = null;
let _retroIntervalId: ReturnType<typeof setInterval> | null = null;

function startConvergenceTickLoop(): void {
  if (_tickIntervalId) return;
  _tickIntervalId = setInterval(() => {
    if (!_orchestrator) return;
    _orchestrator.checkStalls().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[boot] convergence stall check failed:', err);
    });
  }, 30 * 1000);
  unrefIfPossible(_tickIntervalId);

  // 慢速扫描 (10 分钟): 复盘 + Memory 三级签批 SLA + Memory 降级 + Persona 升阶
  // 整合到一个 tick 减少进程开销; 生产环境用 cron / job queue 拆开
  if (!_retroIntervalId) {
    _retroIntervalId = setInterval(() => {
      void runSlowScans();
    }, 10 * 60 * 1000);
    unrefIfPossible(_retroIntervalId);
  }
}

/**
 * 慢速扫描 (整合 4 个 cron 任务):
 *   1. 7 天后决议自动复盘 (PRD §8 验收第 9 步)
 *   2. Memory 升级签批 SLA 逾期自动 escalate (宪章 §8.1)
 *   3. Memory 引用率扫描 → AI 通知 Steward 评估降级 (宪章 §8.2)
 *   4. Persona 阶段自动升级 (低风险静默, 高风险等员工确认)
 */
async function runSlowScans(): Promise<void> {
  try {
    const { scanRetrospectives } = await import('./retrospective/auto');
    const r = await scanRetrospectives();
    if (r.processed > 0) {
      // eslint-disable-next-line no-console
      console.info(`[boot] retrospective: ${r.processed} 张决议自动复盘完成`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[boot] retrospective scan failed:', err);
  }

  try {
    const { escalateOverduePromotions } = await import('./memory/promotion-flow');
    const r = await escalateOverduePromotions();
    if (r.escalated > 0 || r.notifiedGovernance > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[boot] memory promotion SLA: ${r.escalated} 升级 / ${r.notifiedGovernance} 通知治理委员会`
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[boot] memory promotion SLA scan failed:', err);
  }

  try {
    const { scanLowReferenceMemories } = await import('./memory/downgrade-flow');
    const r = await scanLowReferenceMemories();
    if (r.proposed > 0) {
      // eslint-disable-next-line no-console
      console.info(`[boot] memory downgrade: ${r.proposed} 条建议 (引用率低于均值 30%)`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[boot] memory downgrade scan failed:', err);
  }

  try {
    const { scanPersonaUpgrades } = await import('./persona/evolution');
    const r = await scanPersonaUpgrades();
    if (r.autoUpgraded > 0 || r.awaitingConfirmation > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[boot] persona upgrade: ${r.autoUpgraded} 自动 / ${r.awaitingConfirmation} 待员工确认`
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[boot] persona upgrade scan failed:', err);
  }
}

function unrefIfPossible(id: ReturnType<typeof setInterval>): void {
  if (typeof id === 'object' && id && 'unref' in id) {
    (id as { unref: () => void }).unref();
  }
}

export function getRouter(): TandemRouter {
  if (!_router) {
    bootSync();
  }
  return _router!;
}

export function getOrchestrator(): ConvergenceOrchestrator {
  if (!_orchestrator) {
    bootSync();
  }
  return _orchestrator!;
}

// 重导出常用 helpers
export { getStore };
