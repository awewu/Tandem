/**
 * OKR 健康度告警 — 借鉴 WorkBoard / Quantive 的 "OKR Hygiene" 检查
 *
 * 检查项分两类：
 *   1. **目标级**（Objective Level）— 每个目标自己的健康度
 *   2. **周期级**（Cycle Level）— 整个周期的对齐与权重健康度
 *
 * 严重程度：
 *   - error  ：影响 OKR 体系正确性（必修）
 *   - warning：值得关注但不阻塞
 *   - info   ：仅提示
 */

import type { CheckIn, Cycle, KeyResult, Objective } from '../store';

export type HealthSeverity = 'error' | 'warning' | 'info';

export interface HealthIssue {
  severity: HealthSeverity;
  scope: 'cycle' | 'objective' | 'kr';
  scopeId: string;
  /** 用于 UI 跳转的目标 id（点击告警跳到对应实体） */
  jumpTo?: { kind: 'objective' | 'kr'; id: string };
  code: string;
  title: string;
  detail?: string;
}

const DAY = 24 * 60 * 60 * 1000;

/** 检查单个 Objective 的健康度 */
export function checkObjectiveHealth(
  obj: Objective,
  krs: KeyResult[],
  checkIns: CheckIn[],
): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const objKRs = krs.filter((k) => k.objectiveId === obj.id);

  // 1) 没有 KR
  if (objKRs.length === 0 && obj.status === 'active') {
    issues.push({
      severity: 'error', scope: 'objective', scopeId: obj.id,
      code: 'NO_KR',
      title: `「${obj.title}」没有 KR`,
      detail: 'Objective 必须至少有一个 KR 才能衡量进展，否则只是愿景描述。',
    });
  }

  // 2) KR 太多（>5 容易稀释）
  if (objKRs.length > 5) {
    issues.push({
      severity: 'warning', scope: 'objective', scopeId: obj.id,
      code: 'TOO_MANY_KR',
      title: `「${obj.title}」有 ${objKRs.length} 个 KR（建议 3-5 个）`,
      detail: 'KR 过多会稀释焦点。Google 推荐 2-5 个，Tita 也以 3-5 为推荐范围。',
    });
  }

  // 3) KR 权重之和 != 100
  if (objKRs.length > 0) {
    const totalWeight = objKRs.reduce((s, k) => s + (k.weight || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.5 && Math.abs(totalWeight - objKRs.length) > 0.5) {
      // 允许两种约定：和=100 或 全=1
      issues.push({
        severity: 'warning', scope: 'objective', scopeId: obj.id,
        code: 'WEIGHT_IMBALANCE',
        title: `「${obj.title}」KR 权重之和 = ${totalWeight}（建议 100 或全部 1）`,
      });
    }
  }

  // 4) 长时间无 Check-in
  const krIds = new Set(objKRs.map((k) => k.id));
  const objCheckIns = checkIns.filter(
    (c) => (c.scope === 'objective' && c.scopeId === obj.id) ||
           (c.scope === 'kr' && krIds.has(c.scopeId))
  );
  if (obj.status === 'active' && objCheckIns.length > 0) {
    const last = Math.max(...objCheckIns.map((c) => c.createdAt));
    const daysIdle = Math.floor((Date.now() - last) / DAY);
    if (daysIdle > 14) {
      issues.push({
        severity: 'warning', scope: 'objective', scopeId: obj.id,
        code: 'STALE',
        title: `「${obj.title}」已 ${daysIdle} 天没 Check-in`,
        detail: '建议每周（最长双周）做一次进度更新。',
      });
    }
  } else if (obj.status === 'active' && objCheckIns.length === 0) {
    const ageDays = Math.floor((Date.now() - obj.createdAt) / DAY);
    if (ageDays > 7) {
      issues.push({
        severity: 'warning', scope: 'objective', scopeId: obj.id,
        code: 'NO_CHECKIN',
        title: `「${obj.title}」创建 ${ageDays} 天仍未 Check-in`,
      });
    }
  }

  // 5) 信心度连续下降（最近 3 次 Check-in）
  const recent = objCheckIns.sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  if (recent.length === 3) {
    const order: Record<string, number> = { 'on-track': 2, 'at-risk': 1, 'off-track': 0 };
    if (
      order[recent[0].confidenceAfter] < order[recent[1].confidenceAfter] &&
      order[recent[1].confidenceAfter] < order[recent[2].confidenceAfter]
    ) {
      issues.push({
        severity: 'error', scope: 'objective', scopeId: obj.id,
        code: 'CONFIDENCE_DECLINE',
        title: `「${obj.title}」信心度连续 3 次下降`,
        detail: '需要立即评估障碍并调整方案。',
      });
    }
  }

  // 6) 进度倒退（最近 Check-in 的 progressAfter < 上一次的）
  const recentObj = objCheckIns
    .filter((c) => c.scope === 'objective' && c.scopeId === obj.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 2);
  if (recentObj.length === 2 && recentObj[0].progressAfter < recentObj[1].progressAfter - 5) {
    issues.push({
      severity: 'warning', scope: 'objective', scopeId: obj.id,
      code: 'PROGRESS_REGRESSION',
      title: `「${obj.title}」进度倒退（${recentObj[1].progressAfter}% → ${recentObj[0].progressAfter}%）`,
    });
  }

  // 7) 严重偏离 + 无 next steps
  const lastCheckin = objCheckIns.sort((a, b) => b.createdAt - a.createdAt)[0];
  if (
    lastCheckin &&
    lastCheckin.confidenceAfter === 'off-track' &&
    !lastCheckin.nextSteps
  ) {
    issues.push({
      severity: 'error', scope: 'objective', scopeId: obj.id,
      code: 'OFFTRACK_NO_PLAN',
      title: `「${obj.title}」已严重偏离但无下一步计划`,
    });
  }

  return issues;
}

/** 周期级别检查 */
export function checkCycleHealth(
  cycle: Cycle,
  cycleObjectives: Objective[],
  allKRs: KeyResult[],
  checkIns: CheckIn[],
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  if (cycleObjectives.length === 0) {
    issues.push({
      severity: 'info', scope: 'cycle', scopeId: cycle.id,
      code: 'EMPTY_CYCLE',
      title: `周期「${cycle.name}」尚无目标`,
    });
    return issues;
  }

  // 太多顶层目标（一般 3-5 个最佳）
  const topLevel = cycleObjectives.filter((o) => !o.parentId);
  if (topLevel.length > 7) {
    issues.push({
      severity: 'warning', scope: 'cycle', scopeId: cycle.id,
      code: 'TOO_MANY_OBJECTIVES',
      title: `周期顶层目标 ${topLevel.length} 个（建议 ≤5）`,
      detail: 'OKR 之父 Andy Grove：聚焦 3-5 个最重要的目标',
    });
  }

  // 孤儿目标（指定了 parentId 但 parent 找不到）
  for (const obj of cycleObjectives) {
    if (obj.parentId && !cycleObjectives.find((o) => o.id === obj.parentId)) {
      issues.push({
        severity: 'error', scope: 'objective', scopeId: obj.id,
        code: 'ORPHAN',
        title: `「${obj.title}」上级目标已不存在`,
      });
    }
  }

  // 汇总每个 Objective 的健康度
  for (const obj of cycleObjectives) {
    issues.push(...checkObjectiveHealth(obj, allKRs, checkIns));
  }

  // 周期临近结束（剩 < 14 天）但仍很多目标 < 50% 进度
  const remainDays = Math.floor((cycle.endDate - Date.now()) / DAY);
  if (remainDays > 0 && remainDays < 14) {
    const lagging = cycleObjectives.filter((o) => {
      const krs = allKRs.filter((k) => k.objectiveId === o.id);
      if (krs.length === 0) return false;
      const w = krs.reduce((s, k) => s + (k.weight || 1), 0);
      const p = krs.reduce((s, k) => {
        const span = k.targetValue - k.startValue;
        const pct = span === 0 ? 0 : ((k.currentValue - k.startValue) / span) * 100;
        return s + Math.max(0, Math.min(100, pct)) * (k.weight || 1);
      }, 0) / Math.max(1, w);
      return p < 50;
    });
    if (lagging.length > 0) {
      issues.push({
        severity: 'warning', scope: 'cycle', scopeId: cycle.id,
        code: 'CYCLE_ENDING_LAG',
        title: `周期还剩 ${remainDays} 天，但 ${lagging.length} 个目标进度 < 50%`,
      });
    }
  }

  return issues;
}

/** 按严重程度排序 */
export function sortIssues(issues: HealthIssue[]): HealthIssue[] {
  const order = { error: 0, warning: 1, info: 2 };
  return [...issues].sort((a, b) => order[a.severity] - order[b.severity]);
}
