/**
 * CompanyBrain Version · 活动版本读取层 (CA-13 闭环的"读侧")
 *
 * 背景 (2026-06-07 审计发现):
 *   CompanyBrainVersion 的配置 (topKMemoriesInjected / baselineThresholds / styleProfile)
 *   此前**无人消费** — 只有 decision 记录读了 version.version 这个号码。导致月度反思
 *   即使产出 proposedChanges 也永远落不了地 = 假进化闭环。
 *
 * 本模块是闭环的"读侧": 提供唯一的 getActiveBrainVersion(), 让 baseline-guard /
 * company-brain system prompt 在运行时读当前生效版本的配置。配合 approveReflection
 * (写侧: 签批 → 应用 diff → 创建新 Version) 才构成真闭环。
 *
 * 默认值必须与历史硬编码常量一致, 保证"无版本/未签批"时零行为回归:
 *   - baseline-guard 旧常量 HARD_BLOCK=0.45 / SOFT_WARN=0.2
 *   - company-brain 旧注入 procedural 5 + semantic 5 = 10
 */

import type { CompanyBrainVersion } from '@/lib/types/company-brain';
import {
  DEFAULT_BRAIN_VERSION_ID,
  DEFAULT_BRAIN_VERSION_NUMBER,
  DEFAULT_SYSTEM_PROMPT_TEMPLATE,
} from '@/lib/types/company-brain';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';

/** 默认 baseline 阈值 (与 baseline-guard 历史常量一致) */
export const DEFAULT_BASELINE_HARD_BLOCK = 0.45;
export const DEFAULT_BASELINE_SOFT_WARN = 0.2;
/** 默认注入 Memory 总数 (procedural 5 + semantic 5) */
export const DEFAULT_TOPK_MEMORIES = 10;

/** 构造默认版本 (v1 seed 的内存兜底, 当库里没有任何版本时用) */
export function buildDefaultBrainVersion(tenantId = 'default'): CompanyBrainVersion {
  return {
    id: DEFAULT_BRAIN_VERSION_ID,
    version: DEFAULT_BRAIN_VERSION_NUMBER,
    createdAt: new Date(0).toISOString(),
    tenantId,
    styleProfileSnapshot: {
      decisionSpeed: 'medium',
      riskAppetite: 0.4,
      communicationStyle: 'analytical',
    },
    systemPromptTemplate: DEFAULT_SYSTEM_PROMPT_TEMPLATE,
    baselineThresholds: {
      hardBlock: DEFAULT_BASELINE_HARD_BLOCK,
      softWarn: DEFAULT_BASELINE_SOFT_WARN,
    },
    topKMemoriesInjected: DEFAULT_TOPK_MEMORIES,
    metrics: {
      decisionsCount: 0,
      adoptionRate: 0,
      overruleRate: 0,
      avgCostMicroUsd: 0,
      avgLatencyMs: 0,
      sampleDecisionIds: [],
    },
    previousVersionId: null,
    createdReason: 'boot_seed',
  };
}

// ---------------------------------------------------------------------------
// 短 TTL 缓存: baseline-guard 是热路径 (每次治理调用都跑), 避免每次 list()。
// 新版本签批后调 invalidateBrainVersionCache() 立即生效。
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30_000;
let _cache: { version: CompanyBrainVersion; at: number; tenantId: string } | null = null;

/**
 * 读当前生效的 CompanyBrain 版本 (库里最高 version 号; 无则默认 v1)。
 * 永不抛错: 任何故障回退默认版本, 保证治理链路不被版本读取拖垮。
 */
export async function getActiveBrainVersion(tenantId = 'default'): Promise<CompanyBrainVersion> {
  const now = Date.now();
  if (_cache && _cache.tenantId === tenantId && now - _cache.at < CACHE_TTL_MS) {
    return _cache.version;
  }

  let active = buildDefaultBrainVersion(tenantId);
  try {
    const store = getStore();
    const all = await store.companyBrainVersions.list();
    const scoped = all.filter((v) => v.tenantId === tenantId);
    if (scoped.length > 0) {
      active = scoped.sort((a, b) => b.version - a.version)[0];
    }
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      '[brain-version] getActiveBrainVersion failed, using default',
    );
  }

  _cache = { version: active, at: now, tenantId };
  return active;
}

/** 失效缓存 (新版本创建后调用, 让下一次读取拿到最新配置) */
export function invalidateBrainVersionCache(): void {
  _cache = null;
}
