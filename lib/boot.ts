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
import { seedDevData, seedLaunchpadIfEmpty, seedExtraModulesIfEmpty, seedKpiDemoIfEmpty } from './fixtures/seed';
import { seedShowcaseIfEmpty } from './fixtures/seed-showcase';
import { registerBuiltinSkills } from './taf/skills';
import { registerBuiltinTriggers } from './workflows/builtin-triggers';
import { initObservability } from './infra/observability';
import { bootstrapOwnerIfMissing } from './auth/bootstrap';
import { enforceProductionGuard } from './infra/production-guard';
import { withCronLock } from './infra/leader';

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

  // P4-13: 生产启动硬化 — 检查关键 env, 弱配置直接抛错阻止启动
  enforceProductionGuard();

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
      // In production a DATABASE_URL was explicitly configured, so a silent
      // fallback to in-memory would drop every write while appearing healthy.
      // Fail loud instead. Dev/test keep the convenient fallback.
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `[boot] DATABASE_URL is set but Drizzle store init failed; refusing to start with in-memory storage in production: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      // eslint-disable-next-line no-console
      console.warn('[boot] Drizzle store 初始化失败, fallback to InMemory (non-production):', err);
      setStore(createInMemoryStore());
    }
  } else {
    setStore(createInMemoryStore());
    // eslint-disable-next-line no-console
    console.info('[boot] storage=in-memory (no DATABASE_URL). 生产期请配 DATABASE_URL.');
  }

  // 优先尝试默认路由器 (从环境变量自动注册有 API key 的 provider)
  let router: TandemRouter;
  try {
    router = createDefaultRouter();
    if (router.listProviders().length === 0) {
      // 无任何 API key, 仅尝试本地 Hermes/Ollama
      router = createLocalDevRouter();
    }
  } catch {
    router = createLocalDevRouter();
  }
  // eslint-disable-next-line no-console
  console.info('[boot] LLM providers registered:', router.listProviders().join(', ') || '(none)');
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
  // DISABLE_DEMO_SEED=1: 关闭一切 demo 内容种子 (恒热/晨光/KPI BSC 等),
  //   用于导入正式数据集 (如瑞合瑞德) 后, 防 boot 重新注入演示数据污染。
  const demoSeedEnabled =
    process.env.NODE_ENV !== 'production' && process.env.DISABLE_DEMO_SEED !== '1';
  const baseSeed = demoSeedEnabled
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
      })
    )
    .then(() =>
      demoSeedEnabled
        ? seedKpiDemoIfEmpty().catch((err) => {
            // eslint-disable-next-line no-console
            console.warn('[boot] KPI bsc seed failed:', err);
          })
        : undefined
    )
    .then(() =>
      demoSeedEnabled
        ? seedShowcaseIfEmpty().catch((err) => {
            // eslint-disable-next-line no-console
            console.warn('[boot] showcase seed failed:', err);
          })
        : undefined
    )
    // §CA-1 (CENTRAL-AI-ARCHITECTURE) CompanyBrain Persona 单例 seed (幂等)
    .then(async () => {
      try {
        const { seedCompanyBrainIfMissing } = await import('./persona/company-brain');
        const r = await seedCompanyBrainIfMissing();
        if (r.created) {
          // eslint-disable-next-line no-console
          console.info('[boot] CompanyBrain seeded (中央 AI 实体)');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[boot] CompanyBrain seed failed:', err);
      }
    })
    // AI 配置热重载: 从 DB AiSettings 覆盖路由器 provider (优先于 env)
    .then(async () => {
      try {
        const { getAiSettings } = await import('./settings/ai-settings');
        const { OpenAICompatibleProvider } = await import('./taf');
        const { PROVIDER_CONFIGS, GATEWAY_PROVIDER_NAME, buildGatewayConfig } = await import('./taf');
        const s = await getAiSettings();
        const router = _g.__tandem_router__;
        if (!router) return;

        // 中继站网关热重载 (优先于分家 provider): DB 配了 baseUrl+model 即覆盖 env, 并提为首选。
        // DB 关闭 (gatewayEnabled=false) 时, 回退到 env 网关 (若有), 否则注销网关。
        {
          const envGateway = buildGatewayConfig();
          const dbBaseUrl = (s.gatewayBaseUrl ?? '').trim();
          const dbModel = (s.gatewayModel ?? '').trim();
          const dbEnabled = s.gatewayEnabled !== false && Boolean(dbBaseUrl && dbModel);
          if (dbEnabled) {
            router.unregisterProvider(GATEWAY_PROVIDER_NAME);
            router.registerProvider(
              new OpenAICompatibleProvider({
                name: GATEWAY_PROVIDER_NAME,
                baseUrl: dbBaseUrl,
                model: dbModel,
                apiKey: (s.gatewayApiKey ?? '').trim() || 'PROXY_MANAGED',
                capabilities: {
                  chat: true,
                  functionCalling: s.gatewayTools !== false,
                  streaming: true,
                  jsonMode: true,
                  vision: true,
                  maxContextTokens: 200_000,
                  inputPriceRmbPerM: 0,
                  outputPriceRmbPerM: 0,
                },
              }),
            );
            router.promoteToPrimary(GATEWAY_PROVIDER_NAME);
          } else if (s.gatewayEnabled === false && !envGateway) {
            router.unregisterProvider(GATEWAY_PROVIDER_NAME);
          }
        }

        const overrides: Array<{ name: string; key: keyof typeof s; baseUrlKey: keyof typeof s; modelKey: keyof typeof s; defaultBaseUrl: string; defaultModel: string }> = [
          { name: 'deepseek-v3',      key: 'deepseekApiKey',   baseUrlKey: 'deepseekBaseUrl',   modelKey: 'deepseekModel',   defaultBaseUrl: 'https://api.deepseek.com/v1',  defaultModel: 'deepseek-chat'     },
          { name: 'deepseek-r1',      key: 'deepseekApiKey',   baseUrlKey: 'deepseekBaseUrl',   modelKey: 'deepseekR1Model', defaultBaseUrl: 'https://api.deepseek.com/v1',  defaultModel: 'deepseek-reasoner' },
          { name: 'claude-opus-4-5',  key: 'anthropicApiKey',  baseUrlKey: 'anthropicBaseUrl',  modelKey: 'anthropicModel',  defaultBaseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-opus-4-5'   },
          { name: 'qwen-max',         key: 'qwenApiKey',       baseUrlKey: 'qwenBaseUrl',       modelKey: 'qwenModel',       defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-max' },
          { name: 'doubao-pro',       key: 'doubaoApiKey',     baseUrlKey: 'doubaoBaseUrl',     modelKey: 'doubaoModel',     defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-1-5-pro-256k' },
          { name: 'kimi-k2',          key: 'kimiApiKey',       baseUrlKey: 'kimiBaseUrl',       modelKey: 'kimiModel',       defaultBaseUrl: 'https://api.moonshot.cn/v1',   defaultModel: 'moonshot-v1-128k'  },
        ];

        for (const ov of overrides) {
          const apiKey = (s[ov.key] as string | undefined) ?? '';
          if (!apiKey) continue;
          const baseUrl = (s[ov.baseUrlKey] as string | undefined) ?? ov.defaultBaseUrl;
          const model = (s[ov.modelKey] as string | undefined) ?? ov.defaultModel;
          const base = PROVIDER_CONFIGS[ov.name];
          if (!base) continue;
          router.unregisterProvider(ov.name);
          router.registerProvider(new OpenAICompatibleProvider({ ...base, apiKey, baseUrl, model }));
        }

        const after = router.listProviders();
        if (after.length > 0) {
          const primary = router.getPrimaryOverride();
          // eslint-disable-next-line no-console
          console.info(
            '[boot] LLM providers (after DB reload):',
            after.join(', '),
            primary ? `· 网关首选=${primary}` : '',
          );
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[boot] AI settings DB reload failed (using env):', err);
      }
    });

  // 议事室 17min 硬上限闭环: 每 30 秒 sweep 活跃议事室, 超时自动 ESCALATE
  // (生产环境用 cron / job queue, V1 用 setInterval 简化)
  startConvergenceTickLoop();

  // 注册跨域事件订阅者 (lib/events/subscribers.ts · 幂等)
  // 任何 service A 影响 service B 必须经此, 不允许 service A 直接 await service B
  void import('./events/subscribers').then(({ registerCrossDomainSubscribers }) => {
    registerCrossDomainSubscribers();
  });
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
    // B3: 多副本下单飞行 — 只有抢到锁的副本执行本轮 sweep (ttl 25s < 30s 间隔)
    void withCronLock('convergence-tick', 25_000, () => orch.checkStalls()).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn('[boot] convergence stall check failed:', err);
    });
  }, 30 * 1000);
  unrefIfPossible(_g.__tandem_tick_interval__);

  // 慢速扫描 (10 分钟): 复盘 + Memory 三级签批 SLA + Memory 降级 + Persona 升阶
  // 整合到一个 tick 减少进程开销; 生产环境用 cron / job queue 拆开
  if (!_g.__tandem_retro_interval__) {
    _g.__tandem_retro_interval__ = setInterval(() => {
      // B3: 单飞行 — ttl 9min < 10min 间隔, 给足慢扫描执行时长
      void withCronLock('slow-scans', 9 * 60_000, runSlowScans).catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.warn('[boot] slow scans failed:', err);
      });
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
    const { finalizeApprovedPromotions, escalateOverduePromotions } = await import(
      './memory/promotion-flow'
    );
    // 先物化"已全签 + 公示期满"的提议 (避免按时签完却被下面的升级扫描误判逾期).
    const fin = await finalizeApprovedPromotions();
    if (fin.materialized > 0) {
      // eslint-disable-next-line no-console
      console.info(`[boot] memory promotion finalize: ${fin.materialized} 条公示期满全签 → 已物化生效`);
    }
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

  try {
    const { scanKpiSnapshots } = await import('./kpi/snapshot-cron');
    const r = await scanKpiSnapshots();
    if (r.created > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[boot] kpi snapshot: ${r.created} 条已写入 (date=${r.date}, scanned=${r.scanned})`
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[boot] kpi snapshot scan failed:', err);
  }

  // ON-2: 代行动作否决窗到期处理
  //   - reconcilePendingActions: 普通代行 (已发生动作) 窗口过 → executed / drafted 超时 → expired
  //   - reconcileOntologyActionVetoWindows: ontology_action (延迟执行) 窗口过 → 真跑 executeAction 兑现
  try {
    const { reconcilePendingActions } = await import('./persona/proxy-actions');
    const r = await reconcilePendingActions();
    if (r.executed > 0 || r.expired > 0) {
      // eslint-disable-next-line no-console
      console.info(`[boot] proxy action reconcile: ${r.executed} 执行 / ${r.expired} 过期`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[boot] proxy action reconcile failed:', err);
  }

  try {
    const { reconcileOntologyActionVetoWindows } = await import('./ontology');
    const r = await reconcileOntologyActionVetoWindows();
    if (r.materialized > 0 || r.failed > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[boot] ontology action reconcile: ${r.materialized} 兑现 / ${r.failed} 失败重试`
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[boot] ontology action reconcile failed:', err);
  }

  // CA-13 (2026-06-09 · 补漏): pending → ignored 慢扫
  //   7 天没拿到反馈的决策标记 ignored, 否则月度反思的 adoptionRate 分母被 pending 永久污染.
  //   boot 时机够用 (服务器经常重启); 真正生产部署可挂独立 cron 但 boot 是兜底.
  try {
    const { markStaleDecisionsIgnored } = await import('./persona/company-brain-decision');
    const r = await markStaleDecisionsIgnored(7);
    if (r.ignored > 0) {
      // eslint-disable-next-line no-console
      console.info(`[boot] company-brain decision sweep: ${r.ignored} 条 7天+ pending 决策标记 ignored`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[boot] company-brain stale decision sweep failed:', err);
  }

  // ON-3: 月度反思自动生成 (§CA-13)
  //   月级长回路: 距上一份报告 ≥ 28 天才生成新报告 (产出 pending, 仍须 Owner/治理签批)。
  //   useLlm=false 保证离线/无 API key 环境也能跑; 无窗口决策时 generateReflection 返回 null。
  try {
    const { listReflections, generateReflection } = await import('./persona/company-brain-reflection');
    const reports = await listReflections({ limit: 1 });
    const latestMs = reports[0]?.createdAt ? new Date(reports[0].createdAt).getTime() : 0;
    const MONTHLY_MS = 28 * 24 * 60 * 60 * 1000;
    if (Date.now() - latestMs >= MONTHLY_MS) {
      const report = await generateReflection({ useLlm: false, actorUserId: 'cron' });
      if (report) {
        // eslint-disable-next-line no-console
        console.info(
          `[boot] company-brain reflection: 月度反思已生成 (${report.id}, ${report.optimizationProposals?.length ?? 0} 条 OKR 优化提议, 待签批)`
        );
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[boot] company-brain monthly reflection failed:', err);
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
