/**
 * KpiCausalLink 业务层 (B-019 · BSC 战略地图因果链)
 *
 * 在 KpiCausalLink 强类型表之上提供:
 *   - 创建因果链 (含 BSC 方向校验 + 环检测 + 重复检测)
 *   - 列出/更新/删除
 *   - 验证因果假设 (年终复盘标记 validated)
 *   - 构建战略地图 (按 BSC 四维分层 + 连线), 给 UI 直接消费
 *
 * 方向规则 (isCausalDirectionValid):
 *   growth → process → customer → financial (严格上游驱动下游).
 *   同维度 / 反向 默认拒绝, 由调用方决定是否走议事室特批 (allowAnyDirection).
 *
 * 纯校验逻辑 (assertValidLink / detectCycle) 不碰 DB, 便于单测.
 */

import { getStore } from '../storage/repository';
import { audit } from '../audit/log';
import { isCausalDirectionValid, resolvePerspective, BSC_PERSPECTIVES } from './bsc-validation';
import { BSC_PERSPECTIVE, type BscPerspective } from '../design-tokens';
import type { Kpi, KpiSubject, KpiCausalLink } from '../types/kpi';

export class CausalLinkError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// 纯校验工具 (无 DB, 可单测)
// ---------------------------------------------------------------------------

/**
 * 在现有链集合上检测: 加入 from→to 后是否成环.
 * 用 DFS 从 to 出发, 看能否回到 from.
 */
export function detectCycle(
  links: Pick<KpiCausalLink, 'fromKpiId' | 'toKpiId'>[],
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  const adj = new Map<string, string[]>();
  for (const l of links) {
    if (!adj.has(l.fromKpiId)) adj.set(l.fromKpiId, []);
    adj.get(l.fromKpiId)!.push(l.toKpiId);
  }
  // 模拟加入新边
  if (!adj.has(from)) adj.set(from, []);
  adj.get(from)!.push(to);

  const seen = new Set<string>();
  const stack = [to];
  while (stack.length) {
    const node = stack.pop()!;
    if (node === from) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const next of adj.get(node) ?? []) stack.push(next);
  }
  return false;
}

export interface LinkValidationContext {
  fromKpi: Pick<Kpi, 'id' | 'bscPerspective' | 'subjectId' | 'cycleId'>;
  toKpi: Pick<Kpi, 'id' | 'bscPerspective' | 'subjectId' | 'cycleId'>;
  subjects: Pick<KpiSubject, 'id' | 'bscPerspective'>[];
  existingLinks: Pick<KpiCausalLink, 'fromKpiId' | 'toKpiId'>[];
  allowAnyDirection?: boolean;
}

/**
 * 综合校验一条拟建因果链. 抛 CausalLinkError 表示拒绝.
 * 返回解析出的 from/to BSC 维度 (供 UI 展示).
 */
export function assertValidLink(ctx: LinkValidationContext): {
  fromPerspective?: BscPerspective;
  toPerspective?: BscPerspective;
} {
  const { fromKpi, toKpi, subjects, existingLinks, allowAnyDirection } = ctx;

  if (fromKpi.id === toKpi.id) {
    throw new CausalLinkError('self_link', '不能把 KPI 连到自己');
  }
  if (fromKpi.cycleId !== toKpi.cycleId) {
    throw new CausalLinkError('cross_cycle', '因果链只能连接同一周期内的 KPI');
  }
  if (detectCycle(existingLinks, fromKpi.id, toKpi.id)) {
    throw new CausalLinkError('cycle_detected', '该连接会形成因果环 (A→B→...→A), 战略地图必须是有向无环图');
  }

  const fromPerspective = resolvePerspective(fromKpi, subjects);
  const toPerspective = resolvePerspective(toKpi, subjects);

  // 维度齐全时校验方向; 缺维度时放行 (但 UI 会提示补维度)
  if (fromPerspective && toPerspective && !allowAnyDirection) {
    if (!isCausalDirectionValid(fromPerspective, toPerspective)) {
      throw new CausalLinkError(
        'invalid_direction',
        `方向不符合 BSC 因果链 (${BSC_PERSPECTIVE[fromPerspective].label} → ${BSC_PERSPECTIVE[toPerspective].label}). ` +
          '应为 学习成长 → 内部流程 → 客户 → 财务. 如需特例请走议事室特批.',
      );
    }
  }

  return { fromPerspective, toPerspective };
}

// ---------------------------------------------------------------------------
// CRUD (DB)
// ---------------------------------------------------------------------------

export interface CreateLinkInput {
  cycleId: string;
  fromKpiId: string;
  toKpiId: string;
  strength?: number;
  hypothesis?: string;
  createdBy: string;
  tenantId?: string;
  /** 议事室特批: 允许反向/跨维度连接 (默认 false) */
  allowAnyDirection?: boolean;
}

export async function createCausalLink(input: CreateLinkInput): Promise<KpiCausalLink> {
  const store = getStore();
  const [fromKpi, toKpi] = await Promise.all([
    store.kpis.get(input.fromKpiId),
    store.kpis.get(input.toKpiId),
  ]);
  if (!fromKpi) throw new CausalLinkError('from_not_found', 'fromKpi 不存在', 404);
  if (!toKpi) throw new CausalLinkError('to_not_found', 'toKpi 不存在', 404);

  const [subjects, existingLinks] = await Promise.all([
    store.kpiSubjects.list(),
    store.kpiCausalLinks.list({ cycleId: input.cycleId }),
  ]);

  // 重复检测 (同周期同一对)
  const dup = existingLinks.find(
    (l) => l.fromKpiId === input.fromKpiId && l.toKpiId === input.toKpiId,
  );
  if (dup) throw new CausalLinkError('duplicate', '该因果链已存在', 409);

  assertValidLink({
    fromKpi,
    toKpi,
    subjects,
    existingLinks,
    allowAnyDirection: input.allowAnyDirection,
  });

  const strength = clampStrength(input.strength ?? 0.5);
  const now = new Date().toISOString();
  const created = await store.kpiCausalLinks.create({
    cycleId: input.cycleId,
    fromKpiId: input.fromKpiId,
    toKpiId: input.toKpiId,
    strength,
    hypothesis: input.hypothesis,
    validated: false,
    tenantId: input.tenantId ?? fromKpi.tenantId ?? 'default',
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });

  await audit('kpi.causal_link.create', input.createdBy, {
    metadata: {
      linkId: created.id,
      cycleId: input.cycleId,
      fromKpiId: input.fromKpiId,
      toKpiId: input.toKpiId,
      strength,
    },
  });
  return created;
}

export interface UpdateLinkInput {
  id: string;
  actorId: string;
  strength?: number;
  hypothesis?: string;
}

export async function updateCausalLink(input: UpdateLinkInput): Promise<KpiCausalLink> {
  const store = getStore();
  const existing = await store.kpiCausalLinks.get(input.id);
  if (!existing) throw new CausalLinkError('not_found', '因果链不存在', 404);

  const patch: Partial<KpiCausalLink> = {};
  if (input.strength !== undefined) patch.strength = clampStrength(input.strength);
  if (input.hypothesis !== undefined) patch.hypothesis = input.hypothesis;

  const updated = await store.kpiCausalLinks.update(input.id, patch);
  await audit('kpi.causal_link.update', input.actorId, {
    metadata: { linkId: input.id, ...patch },
  });
  return updated;
}

export interface ValidateLinkInput {
  id: string;
  actorId: string;
  validated: boolean;
  validationNote?: string;
}

/**
 * 年终复盘: 标记因果假设是否被数据验证成立.
 */
export async function validateCausalLink(input: ValidateLinkInput): Promise<KpiCausalLink> {
  const store = getStore();
  const existing = await store.kpiCausalLinks.get(input.id);
  if (!existing) throw new CausalLinkError('not_found', '因果链不存在', 404);

  const updated = await store.kpiCausalLinks.update(input.id, {
    validated: input.validated,
    validatedAt: input.validated ? new Date().toISOString() : undefined,
    validatedBy: input.validated ? input.actorId : undefined,
    validationNote: input.validationNote,
  });
  await audit('kpi.causal_link.validate', input.actorId, {
    metadata: { linkId: input.id, validated: input.validated },
  });
  return updated;
}

export async function deleteCausalLink(id: string, actorId: string): Promise<void> {
  const store = getStore();
  const existing = await store.kpiCausalLinks.get(id);
  if (!existing) throw new CausalLinkError('not_found', '因果链不存在', 404);
  await store.kpiCausalLinks.delete(id);
  await audit('kpi.causal_link.delete', actorId, { metadata: { linkId: id } });
}

export async function listCausalLinks(cycleId: string): Promise<KpiCausalLink[]> {
  const store = getStore();
  return store.kpiCausalLinks.list({ cycleId });
}

// ---------------------------------------------------------------------------
// 战略地图构建 (供 UI)
// ---------------------------------------------------------------------------

export interface StrategyMapNode {
  kpiId: string;
  title: string;
  perspective?: BscPerspective;
  scope: Kpi['scope'];
  weight: number;
}

export interface StrategyMapEdge {
  id: string;
  fromKpiId: string;
  toKpiId: string;
  strength: number;
  hypothesis?: string;
  validated: boolean;
  /** 方向是否符合 BSC 上游→下游 (供 UI 标记"反向特批"线) */
  directionValid: boolean;
}

export interface StrategyMap {
  cycleId: string;
  /** 按 BSC 四维分层的节点 (growth→process→customer→financial 顺序) */
  lanes: { perspective: BscPerspective; label: string; nodes: StrategyMapNode[] }[];
  /** 未分类节点 (无 BSC 维度) */
  unclassified: StrategyMapNode[];
  edges: StrategyMapEdge[];
}

/**
 * 组装战略地图: 节点按 BSC 四维泳道分层, 边带方向合法性标记.
 * 纯组装函数 (输入已查好的 kpis/subjects/links), 便于单测 + 复用.
 */
export function buildStrategyMap(
  cycleId: string,
  kpis: Kpi[],
  subjects: Pick<KpiSubject, 'id' | 'bscPerspective'>[],
  links: KpiCausalLink[],
): StrategyMap {
  const perspectiveOf = new Map<string, BscPerspective | undefined>();
  const nodes: StrategyMapNode[] = kpis.map((k) => {
    const p = resolvePerspective(k, subjects);
    perspectiveOf.set(k.id, p);
    return { kpiId: k.id, title: k.title, perspective: p, scope: k.scope, weight: k.weight };
  });

  const lanes = BSC_PERSPECTIVES.map((perspective) => ({
    perspective,
    label: BSC_PERSPECTIVE[perspective].label,
    nodes: nodes.filter((n) => n.perspective === perspective),
  }));
  const unclassified = nodes.filter((n) => !n.perspective);

  const edges: StrategyMapEdge[] = links.map((l) => {
    const fp = perspectiveOf.get(l.fromKpiId);
    const tp = perspectiveOf.get(l.toKpiId);
    return {
      id: l.id,
      fromKpiId: l.fromKpiId,
      toKpiId: l.toKpiId,
      strength: l.strength,
      hypothesis: l.hypothesis,
      validated: l.validated,
      directionValid: fp && tp ? isCausalDirectionValid(fp, tp) : true,
    };
  });

  return { cycleId, lanes, unclassified, edges };
}

export async function getStrategyMap(cycleId: string): Promise<StrategyMap> {
  const store = getStore();
  const [kpis, subjects, links] = await Promise.all([
    store.kpis.list({ cycleId }),
    store.kpiSubjects.list(),
    store.kpiCausalLinks.list({ cycleId }),
  ]);
  return buildStrategyMap(cycleId, kpis, subjects, links);
}

function clampStrength(v: number): number {
  if (!Number.isFinite(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}
