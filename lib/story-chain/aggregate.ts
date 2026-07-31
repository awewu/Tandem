/**
 * 故事链 provenance 聚合 (Phase 4 · 点亮 · 2026-07-20)
 *
 * 把 Tandem 的核心叙事链 议→沉→拿→算 组装成一屏可视化 (只读):
 *
 *   Objective ← KR [anchor]
 *     ├─ CheckIns            (进度史)
 *     ├─ Initiatives         (keyResultId===kr.id)
 *     │    ├─ ← DecisionCard (initiative.decisionCardIds)
 *     │    └─ ← 1on1 ActionItem (actionItem.linkedInitiativeId)
 *     └─ DecisionCards       (primaryKrId/relatedKr 命中 或 被 Initiative 引用)
 *          ├─ Materials      (decisionCard.materialRefs)
 *          │    └─ Memory    (memory.sourceMaterialId === material.id)
 *          └─ citedMemory    (option.citedMemory)
 *
 * 纪律: 纯只读组装, 只走真实 FK 字段, 不臆造关系; 缺链的节点如实标注为空。
 * 全程租户隔离 (tenantId 缺省视为 'default')。
 */

import { getStore } from '@/lib/storage/repository';
import { buildEntityTimeline, type CausalLink } from '@/lib/memory/timeline';

function tn(x?: string): string {
  return x ?? 'default';
}

/** KR 进度归一化 0-1 (与 nine-box 口径一致) */
function krProgress(kr: { startValue: number; targetValue: number; currentValue: number }): number {
  if (kr.targetValue === kr.startValue) return kr.currentValue >= kr.targetValue ? 1 : 0;
  const r = (kr.currentValue - kr.startValue) / (kr.targetValue - kr.startValue);
  return Math.max(0, Math.min(1, r));
}

export interface StoryChainMemoryNode {
  id: string;
  title: string;
  type: string;
  status: string;
  ownershipLevel: string;
}
export interface StoryChainMaterialNode {
  id: string;
  title: string;
  type: string;
  memory: StoryChainMemoryNode | null;
}
export interface StoryChainDecisionNode {
  id: string;
  title: string;
  state: string;
  selected?: string;
  anchoredDirectly: boolean;
  materials: StoryChainMaterialNode[];
  citedMemory: Array<{ id: string; title: string }>;
}
export interface StoryChainInitiativeNode {
  id: string;
  title: string;
  status: string;
  fromDecisionCardIds: string[];
  fromActionItem: { id: string; meetingTitle?: string } | null;
}
export interface StoryChainCheckInNode {
  id: string;
  createdAt: string;
  progressAfter: number;
  confidenceAfter: string;
  achievements?: string | null;
  blockers?: string | null;
}
export interface StoryChainTimelineEvent {
  id: string;
  title: string;
  type: string;
  ownershipLevel: string;
  at: string;
  order: number;
}
export interface StoryChainTimeline {
  events: StoryChainTimelineEvent[];
  causalLinks: CausalLink[];
}
export interface StoryChain {
  anchor: {
    krId: string;
    krTitle: string;
    progress: number;
    confidence: string;
    objectiveId?: string;
    objectiveTitle?: string;
  };
  initiatives: StoryChainInitiativeNode[];
  decisions: StoryChainDecisionNode[];
  checkIns: StoryChainCheckInNode[];
  /** MAGMA-lite 时间/因果轴: 触及本 KR 的记忆按时间演进 + 版本取代/同会话因果边 */
  timeline: StoryChainTimeline;
  stats: {
    initiativeCount: number;
    decisionCount: number;
    materialCount: number;
    memoryCount: number;
    checkInCount: number;
    timelineEventCount: number;
  };
}

export interface AnchorKrLite {
  krId: string;
  krTitle: string;
  objectiveTitle?: string;
  progress: number;
}

/** 列出可作锚点的 KR (供 UI picker), 仅返回本租户。 */
export async function listAnchorKrs(tenantId: string): Promise<AnchorKrLite[]> {
  const store = getStore();
  const krs = (await store.keyResults.list()).filter((k) => tn(k.tenantId) === tn(tenantId));
  const objectives = await store.objectives.list();
  const objTitle = new Map(objectives.map((o) => [o.id, o.title]));
  return krs
    .map((k) => ({
      krId: k.id,
      krTitle: k.title,
      objectiveTitle: objTitle.get(k.objectiveId),
      progress: krProgress(k),
    }))
    .sort((a, b) => a.krTitle.localeCompare(b.krTitle));
}

/**
 * 组装指定 KR 的完整 provenance 链。找不到 / 跨租户 → null。
 */
export async function buildStoryChain(krId: string, tenantId: string): Promise<StoryChain | null> {
  const store = getStore();
  const kr = await store.keyResults.get(krId);
  if (!kr || tn(kr.tenantId) !== tn(tenantId)) return null;

  const objective = kr.objectiveId ? await store.objectives.get(kr.objectiveId) : null;

  // ── CheckIns (scope=kr) ──
  const allCheckIns = await store.checkIns.list();
  const checkIns: StoryChainCheckInNode[] = allCheckIns
    .filter((c) => c.scope === 'kr' && c.scopeId === krId && tn(c.tenantId) === tn(tenantId))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      progressAfter: c.progressAfter,
      confidenceAfter: c.confidenceAfter,
      achievements: c.achievements ?? null,
      blockers: c.blockers ?? null,
    }));

  // ── Initiatives (keyResultId===krId) + 其来源 (DecisionCard / 1on1 ActionItem) ──
  const allInitiatives = await store.initiatives.list();
  const krInitiatives = allInitiatives.filter(
    (i) => i.keyResultId === krId && tn(i.tenantId) === tn(tenantId),
  );
  const allActionItems = await store.oneOnOneActionItems.list().catch(() => []);
  const allMeetings = await store.oneOnOneMeetings.list().catch(() => []);
  const meetingTitle = new Map(allMeetings.map((m) => [m.id, (m as { title?: string }).title]));

  const initiatives: StoryChainInitiativeNode[] = krInitiatives.map((i) => {
    const ai = allActionItems.find(
      (a) => (a as { linkedInitiativeId?: string }).linkedInitiativeId === i.id,
    ) as { id?: string; meetingId?: string } | undefined;
    return {
      id: i.id,
      title: i.title,
      status: i.status,
      fromDecisionCardIds: Array.isArray(i.decisionCardIds) ? i.decisionCardIds : [],
      fromActionItem: ai?.id
        ? { id: ai.id, meetingTitle: ai.meetingId ? meetingTitle.get(ai.meetingId) : undefined }
        : null,
    };
  });

  // ── DecisionCards: 直接锚定本 KR 的 + 被上述 Initiative 引用的 ──
  const initiativeDecisionIds = new Set(initiatives.flatMap((i) => i.fromDecisionCardIds));
  const allDecisions = await store.decisionCards.list();
  const relevantDecisions = allDecisions.filter((d) => {
    if (tn(d.tenantId) !== tn(tenantId)) return false;
    const anchored = d.primaryKrId === krId || (d.relatedKr ?? []).includes(krId);
    return anchored || initiativeDecisionIds.has(d.id);
  });

  // Material + Memory 组装
  const allMaterials = await store.materials.list();
  const materialById = new Map(allMaterials.map((m) => [m.id, m]));
  const allMemories = await store.memories.list();
  const memoryByMaterial = new Map<string, (typeof allMemories)[number]>();
  for (const m of allMemories) {
    if (m.sourceMaterialId) memoryByMaterial.set(m.sourceMaterialId, m);
  }

  let materialCount = 0;
  let memoryCount = 0;
  const decisions: StoryChainDecisionNode[] = relevantDecisions.map((d) => {
    const matIds = Array.isArray(d.materialRefs) ? d.materialRefs : [];
    const materials: StoryChainMaterialNode[] = matIds
      .map((mid) => materialById.get(mid))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map((m) => {
        materialCount += 1;
        const mem = memoryByMaterial.get(m.id);
        if (mem) memoryCount += 1;
        return {
          id: m.id,
          title: m.title,
          type: m.type,
          memory: mem
            ? {
                id: mem.id,
                title: mem.title,
                type: mem.type,
                status: mem.status,
                ownershipLevel: mem.ownershipLevel,
              }
            : null,
        };
      });
    const citedMemoryIds = Array.from(
      new Set((d.options ?? []).flatMap((o) => (o.citedMemory ?? []) as string[])),
    );
    const citedMemory = citedMemoryIds
      .map((mid) => allMemories.find((m) => m.id === mid))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map((m) => ({ id: m.id, title: m.title }));
    return {
      id: d.id,
      title: d.title,
      state: d.convergenceState,
      selected: d.selected,
      anchoredDirectly: d.primaryKrId === krId || (d.relatedKr ?? []).includes(krId),
      materials,
      citedMemory,
    };
  });

  // ── MAGMA-lite 时间/因果轴: 触及本 KR 的记忆按时间演进 (租户 = orgId 缺省 default) ──
  const tl = buildEntityTimeline(krId, allMemories, { orgId: tn(tenantId), maxEvents: 30 });
  const timeline: StoryChainTimeline = {
    events: tl.events.map((e) => ({
      id: e.memory.id,
      title: e.memory.title,
      type: e.memory.type,
      ownershipLevel: e.memory.ownershipLevel,
      at: e.at,
      order: e.order,
    })),
    causalLinks: tl.causalLinks,
  };

  return {
    anchor: {
      krId: kr.id,
      krTitle: kr.title,
      progress: krProgress(kr),
      confidence: kr.confidence,
      objectiveId: objective?.id,
      objectiveTitle: objective?.title,
    },
    initiatives,
    decisions,
    checkIns,
    timeline,
    stats: {
      initiativeCount: initiatives.length,
      decisionCount: decisions.length,
      materialCount,
      memoryCount,
      checkInCount: checkIns.length,
      timelineEventCount: timeline.events.length,
    },
  };
}
