/**
 * App Bootstrap · 启动注入
 *
 * 在 Next.js server-side 第一次访问时初始化 store + 路由器.
 * 客户端通过 API 访问, 不直接 import 这里.
 */

import { setStore, getStore } from './storage/repository';
import { createInMemoryStore } from './storage/memory-store';
import { createDrizzleStore } from './storage/drizzle-store';
import { TandemRouter, createDefaultRouter, createLocalDevRouter } from './taf';
import { ConvergenceOrchestrator } from './convergence/orchestrator';
import { seedDevData, seedLaunchpadIfEmpty, seedExtraModulesIfEmpty } from './fixtures/seed';
import { registerBuiltinSkills } from './taf/skills';
import { registerBuiltinTriggers } from './workflows/builtin-triggers';
import { initObservability } from './infra/observability';
import { bootstrapOwnerIfMissing } from './auth/bootstrap';

// 单例 (挂 globalThis 防 Next.js dev HMR 重置)
type BootGlobals = {
  __tandem_booted__?: boolean;
  __tandem_seed_promise__?: Promise<void> | null;
  __tandem_router__?: TandemRouter | null;
  __tandem_orchestrator__?: ConvergenceOrchestrator | null;
  __tandem_tick_interval__?: ReturnType<typeof setInterval> | null;
  __tandem_retro_interval__?: ReturnType<typeof setInterval> | null;
};
const _g = globalThis as typeof globalThis & BootGlobals;

/**
 * 同步初始化 store / router / orchestrator (无 IO).
 * 多次调用幂等. 不触发 seed.
 */
function bootSync(): void {
  const useDb = !!process.env.DATABASE_URL;
  const existingStore = (_g as Record<string, unknown>)['__tandem_store__'];
  // §T6: DATABASE_URL → Drizzle+PG (持久化); 否则 InMemory (重启清空)
  const expectedKind = useDb ? 'prisma' : 'memory';
  const actualKind =
    existingStore && typeof existingStore === 'object'
      ? (existingStore as Record<string, string>)._storeKind
      : undefined;
  const storeNeedsReset =
    !existingStore ||
    (typeof existingStore === 'object' && !('documents' in existingStore)) ||
    actualKind !== expectedKind;

  if (_g.__tandem_booted__ && !storeNeedsReset) return;

  if (storeNeedsReset && existingStore) {
    // eslint-disable-next-line no-console
    console.info('[boot] store schema/mode changed, re-initializing...');
  }

  // §T6 Storage 路径:
  //   DATABASE_URL  → Drizzle+PG (Persona/Memory/OKR/IM/DecisionCard 全部持久化)
  //   否则           → InMemory (dev/e2e, seed 重启可复现)
  // 注: V1 GA 强类型表 (Document/Calendar/Drive/Notification) 由 app-context-factory 走专用 repo
  if (useDb) {
    try {
      setStore(createDrizzleStore());
      // eslint-disable-next-line no-console
      console.info('[boot] storage=drizzle+pg (DATABASE_URL detected)');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[boot] Drizzle store 初始化失败, fallback to InMemory:', err);
      setStore(createInMemoryStore());
    }
  } else {
    setStore(createInMemoryStore());
    // eslint-disable-next-line no-console
    console.info('[boot] storage=in-memory (no DATABASE_URL). 生产期请配 DATABASE_URL.');
  }

  // 优先尝试默认路由器, 失败 fall back 到本地 dev
  let router: TandemRouter;
  try {
    router = createDefaultRouter();
    if (router.listProviders().length === 0) {
      // 无 API key, 用本地 ollama 路由器 (即使 ollama 没起也不抛错)
      router = createLocalDevRouter();
    }
  } catch {
    router = createLocalDevRouter();
  }
  _g.__tandem_router__ = router;

  _g.__tandem_orchestrator__ = new ConvergenceOrchestrator(router);
  registerBuiltinSkills();
  registerBuiltinTriggers();
  void initObservability();
  // 自研身份系统: 首次启动建 owner (幂等)
  bootstrapOwnerIfMissing().catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[boot] bootstrap auth owner failed:', err);
  });
  _g.__tandem_booted__ = true;

  // Seed dev data — 仅在非 production 下跑.
  // Prisma 模式下也跑 seed, 让 e2e / demo 有数据.
  const baseSeed =
    process.env.NODE_ENV !== 'production'
      ? seedDevData().catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[boot] seed failed:', err);
        })
      : Promise.resolve();

  // Chain idempotent module seeds — run regardless of KvStore guard
  // so existing dev DBs pick up new tables added after first seed.
  // Important: included in __tandem_seed_promise__ so `await boot()` waits.
  _g.__tandem_seed_promise__ = baseSeed
    .then(() =>
      seedLaunchpadIfEmpty().catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[boot] launchpad seed failed:', err);
      })
    )
    .then(() =>
      seedExtraModulesIfEmpty().catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[boot] extra modules seed failed:', err);
      }),
  );

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
  if (_g.__tandem_seed_promise__) await _g.__tandem_seed_promise__;
}

function startConvergenceTickLoop(): void {
  if (_g.__tandem_tick_interval__) return;
  _g.__tandem_tick_interval__ = setInterval(() => {
    const orch = _g.__tandem_orchestrator__;
    if (!orch) return;
    orch.checkStalls().catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn('[boot] convergence stall check failed:', err);
    });
  }, 30 * 1000);
  unrefIfPossible(_g.__tandem_tick_interval__);

  // 慢速扫描 (10 分钟): 复盘 + Memory 三级签批 SLA + Memory 降级 + Persona 升阶
  // 整合到一个 tick 减少进程开销; 生产环境用 cron / job queue 拆开
  if (!_g.__tandem_retro_interval__) {
    _g.__tandem_retro_interval__ = setInterval(() => {
      void runSlowScans();
    }, 10 * 60 * 1000);
    unrefIfPossible(_g.__tandem_retro_interval__);
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
  if (!_g.__tandem_router__) {
    bootSync();
  }
  return _g.__tandem_router__!;
}

export function getOrchestrator(): ConvergenceOrchestrator {
  if (!_g.__tandem_orchestrator__) {
    bootSync();
  }
  return _g.__tandem_orchestrator__!;
}

// 重导出常用 helpers
export { getStore };
