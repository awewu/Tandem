/**
 * lib/ontology/object-types.ts · 核心对象类型注册 (ON-0 第一片 · 2026-06-09)
 *
 * ─────────────────────────────────────────────────────────
 * 本片注册 OKR 域三元组 (Objective / KeyResult / Initiative) —— 它们:
 *   - 类型完全确定 (lib/types/okr-tti.ts), 真值函数已存在 (computeKRProgress / effectiveObjectiveProgress);
 *   - 正好是 ON-1 首动作 `kr.checkin` 要操作的对象, 先行验证本体范式。
 *
 * resolve/search 委托 getStore() (与 okr.read / okr.health_digest 技能同一读路径),
 * derived 复用 okr-tti 真值函数 (保证"真值唯一来源"), 不复制存储、不重写分仓。
 *
 * 后续相位补注册 (TODO ON-0 剩余): Person / Channel / DecisionCard / KpiMetric /
 *   MemoryEntry / CalendarEvent —— 同范式逐个加, 不影响本片。
 */

import { getStore } from '@/lib/storage/repository';
import {
  computeKRProgress,
  effectiveObjectiveProgress,
  type Objective,
  type KeyResult,
  type Initiative,
} from '@/lib/types/okr-tti';
import type { DecisionCard } from '@/lib/types/decision-card';
import type { Persona } from '@/lib/types/persona';
import type { Kpi } from '@/lib/types/kpi';
import type { MemoryEntry } from '@/lib/types/memory';
import { ontology } from './registry';
import type { ObjectType } from './types';

const lc = (s: string) => (s ?? '').toLowerCase();

// ── Objective ───────────────────────────────────────────────────────
export const ObjectiveType: ObjectType<Objective> = {
  id: 'Objective',
  label: '目标 (Objective)',
  resolve: (id) => getStore().objectives.get(id),
  search: async (query, opts) => {
    const q = lc(query);
    const all = await getStore().objectives.list();
    const hit = q ? all.filter((o) => lc(o.title).includes(q)) : all;
    return hit.slice(0, opts?.limit ?? 20);
  },
  links: [
    {
      name: 'keyResults',
      targetType: 'KeyResult',
      cardinality: 'many',
      resolve: async (o) => (await getStore().keyResults.list()).filter((k) => k.objectiveId === o.id),
    },
    {
      name: 'parent',
      targetType: 'Objective',
      cardinality: 'one',
      resolve: async (o) => (o.parentObjectiveId ? getStore().objectives.get(o.parentObjectiveId) : null),
    },
    {
      name: 'children',
      targetType: 'Objective',
      cardinality: 'many',
      resolve: async (o) => (await getStore().objectives.list()).filter((c) => c.parentObjectiveId === o.id),
    },
  ],
  // Functions-on-Objects 雏形: 真值进度 (override ?? rollup ?? 0)
  derived: (o) => ({ effectiveProgress: effectiveObjectiveProgress(o) }),
};

// ── KeyResult ───────────────────────────────────────────────────────
export const KeyResultType: ObjectType<KeyResult> = {
  id: 'KeyResult',
  label: '关键结果 (KR)',
  resolve: (id) => getStore().keyResults.get(id),
  search: async (query, opts) => {
    const q = lc(query);
    const all = await getStore().keyResults.list();
    const hit = q ? all.filter((k) => lc(k.title).includes(q)) : all;
    return hit.slice(0, opts?.limit ?? 20);
  },
  links: [
    {
      name: 'objective',
      targetType: 'Objective',
      cardinality: 'one',
      resolve: (k) => getStore().objectives.get(k.objectiveId),
    },
    {
      name: 'initiatives',
      targetType: 'Initiative',
      cardinality: 'many',
      resolve: async (k) => (await getStore().initiatives.list()).filter((i) => i.keyResultId === k.id),
    },
  ],
  // Functions-on-Objects 雏形: KR 真值进度 0-1
  derived: (k) => ({ progress: computeKRProgress(k) }),
};

// ── Initiative ──────────────────────────────────────────────────────
export const InitiativeType: ObjectType<Initiative> = {
  id: 'Initiative',
  label: '行动项 (Initiative)',
  resolve: (id) => getStore().initiatives.get(id),
  search: async (query, opts) => {
    const q = lc(query);
    const all = await getStore().initiatives.list();
    const hit = q ? all.filter((i) => lc(i.title).includes(q)) : all;
    return hit.slice(0, opts?.limit ?? 20);
  },
  links: [
    {
      name: 'keyResult',
      targetType: 'KeyResult',
      cardinality: 'one',
      resolve: (i) => getStore().keyResults.get(i.keyResultId),
    },
  ],
};

// ── DecisionCard ────────────────────────────────────────────────────
export const DecisionCardType: ObjectType<DecisionCard> = {
  id: 'DecisionCard',
  label: '决策卡 (DecisionCard)',
  resolve: (id) => getStore().decisionCards.get(id),
  search: async (query, opts) => {
    const q = lc(query);
    const all = await getStore().decisionCards.list();
    const hit = q ? all.filter((d) => lc(d.title).includes(q)) : all;
    return hit.slice(0, opts?.limit ?? 20);
  },
  links: [
    {
      name: 'anchorKr',
      targetType: 'KeyResult',
      cardinality: 'one',
      resolve: (d) => (d.primaryKrId ? getStore().keyResults.get(d.primaryKrId) : Promise.resolve(null)),
    },
  ],
  derived: (d) => ({ convergenceState: d.convergenceState, decisionClass: d.decisionClass }),
};

// ── Persona ─────────────────────────────────────────────────────────
export const PersonaType: ObjectType<Persona> = {
  id: 'Persona',
  label: '搭子 AI 分身 (Persona)',
  resolve: (id) => getStore().personas.get(id),
  search: async (query, opts) => {
    const q = lc(query);
    const all = await getStore().personas.list();
    const hit = q ? all.filter((p) => lc(p.userId).includes(q)) : all;
    return hit.slice(0, opts?.limit ?? 20);
  },
  links: [],
  derived: (p) => ({ stage: p.stage, delegationLevel: p.delegationLevel, bossCaptureScore: p.bossCaptureScore }),
};

// ── Kpi ─────────────────────────────────────────────────────────────
export const KpiType: ObjectType<Kpi> = {
  id: 'Kpi',
  label: 'KPI 指标 (Kpi)',
  resolve: (id) => getStore().kpis.get(id),
  search: async (query, opts) => {
    const q = lc(query);
    const all = await getStore().kpis.list();
    const hit = q ? all.filter((k) => lc(k.title).includes(q) || lc(k.description ?? '').includes(q)) : all;
    return hit.slice(0, opts?.limit ?? 20);
  },
  links: [
    {
      name: 'parent',
      targetType: 'Kpi',
      cardinality: 'one',
      resolve: (k) => (k.parentKpiId ? getStore().kpis.get(k.parentKpiId) : Promise.resolve(null)),
    },
  ],
  derived: (k) => ({
    achievementRate: k.targetValue !== 0 ? Math.round((k.currentValue / k.targetValue) * 1000) / 1000 : 0,
    bscPerspective: k.bscPerspective,
  }),
};

// ── MemoryEntry ──────────────────────────────────────────────────────
export const MemoryEntryType: ObjectType<MemoryEntry> = {
  id: 'MemoryEntry',
  label: '组织记忆 (MemoryEntry)',
  resolve: (id) => getStore().memories.get(id),
  search: async (query, opts) => {
    const q = lc(query);
    const all = await getStore().memories.list();
    const hit = q
      ? all.filter((m) => lc(m.title).includes(q) || lc(m.body).includes(q))
      : all;
    return hit.slice(0, opts?.limit ?? 20);
  },
  links: [],
  derived: (m) => ({ ownershipLevel: m.ownershipLevel, status: m.status, referenceCount: m.referenceCount }),
};

export const CORE_OBJECT_TYPES: ObjectType<{ id: string }>[] = [
  ObjectiveType as unknown as ObjectType<{ id: string }>,
  KeyResultType as unknown as ObjectType<{ id: string }>,
  InitiativeType as unknown as ObjectType<{ id: string }>,
  DecisionCardType as unknown as ObjectType<{ id: string }>,
  PersonaType as unknown as ObjectType<{ id: string }>,
  KpiType as unknown as ObjectType<{ id: string }>,
  MemoryEntryType as unknown as ObjectType<{ id: string }>,
];

/**
 * 幂等注册核心对象类型到全局 ontology 单例。
 * 用 has() 判定而非模块 flag, 使 test 在 ontology.clear() 后能重新注册。
 */
export function ensureCoreObjectTypes(): void {
  for (const ot of CORE_OBJECT_TYPES) {
    if (!ontology.has(ot.id)) ontology.register(ot);
  }
}
