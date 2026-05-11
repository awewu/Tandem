/**
 * EVO-1 · 决议节奏护栏 (Decision Cadence Guard)
 *
 * 反向取自 Lattice Habits (2025-10): 不是让员工"每天打卡", 而是让员工**主动反观
 * 自己签下的决议是否复盘**, 把节奏从"老板盯人"翻转为"员工自盯".
 *
 * 设计原则:
 *   - 零外发推送 (合 MANIFESTO §11.2 反过度监控)
 *   - 仅在用户主动访问 dashboard 时静默渲染, 永不主动打扰
 *   - 节奏窗口按 decisionClass 分级, 越复杂的决议给越长的复盘期
 *   - 已有 retrospective 的决议立即剔除, 不轰炸
 *
 * 节奏窗口 (参考 Andy Grove / Lattice / Lean 复盘节奏):
 *   simple    : 建议 7 天复盘  · 14 天逾期
 *   complex   : 建议 14 天复盘 · 28 天逾期
 *   strategic : 建议 30 天复盘 · 60 天逾期
 */

import type { DecisionCard, DecisionClass } from '@/lib/types/decision-card';

const DAY = 24 * 60 * 60 * 1000;

interface Window {
  due: number; // 天 · 进入"可以复盘了"
  overdue: number; // 天 · 进入"明显该复盘了"
}

const WINDOWS: Record<DecisionClass, Window> = {
  simple: { due: 7, overdue: 14 },
  complex: { due: 14, overdue: 28 },
  strategic: { due: 30, overdue: 60 },
};

export type RetroUrgency = 'fresh' | 'due' | 'overdue';

export interface PendingRetro {
  decisionId: string;
  title: string;
  decisionClass: DecisionClass;
  committedAtMs: number;
  daysSinceCommit: number;
  urgency: RetroUrgency;
}

/**
 * 从 DecisionCard[] 派生"待复盘决议"列表。
 *
 * 过滤规则:
 *   - 仅 COMMIT 态 (DIVERGE/CONVERGE 还在进行; VETOED/ESCALATED 无需复盘)
 *   - 已有 retrospective 立刻剔除
 *   - 由 ownerUserId 过滤为"我创建的"决议
 *
 * @param ownerUserId 当前用户 (传 null 则返回全部 COMMIT 决议)
 * @param now         覆盖 "现在" 时间戳, 便于测试
 */
export function derivePendingRetros(
  cards: DecisionCard[],
  ownerUserId: string | null,
  now: number = Date.now(),
): PendingRetro[] {
  const result: PendingRetro[] = [];
  for (const card of cards) {
    if (card.convergenceState !== 'COMMIT') continue;
    if (card.retrospective) continue;
    if (ownerUserId && card.createdBy !== ownerUserId) continue;
    if (!card.createdAt) continue;
    const committedAtMs = new Date(card.createdAt).getTime();
    if (!Number.isFinite(committedAtMs)) continue;
    const days = Math.floor((now - committedAtMs) / DAY);
    const cls: DecisionClass = card.decisionClass ?? 'simple';
    const w = WINDOWS[cls];
    let urgency: RetroUrgency = 'fresh';
    if (days >= w.overdue) urgency = 'overdue';
    else if (days >= w.due) urgency = 'due';
    // fresh: 不返回, 还不到提示窗口
    if (urgency === 'fresh') continue;
    result.push({
      decisionId: card.id,
      title: card.title,
      decisionClass: cls,
      committedAtMs,
      daysSinceCommit: days,
      urgency,
    });
  }
  // 按 urgency (overdue 优先) + 天数倒序
  return result.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === 'overdue' ? -1 : 1;
    return b.daysSinceCommit - a.daysSinceCommit;
  });
}

/**
 * 强约束: 一次展示最多 N 条, 避免轰炸 (默认 3, 与 EVO-2 同节奏).
 */
export function topPendingRetros(
  retros: PendingRetro[],
  max = 3,
): { items: PendingRetro[]; hiddenCount: number } {
  const items = retros.slice(0, max);
  return { items, hiddenCount: Math.max(0, retros.length - items.length) };
}
