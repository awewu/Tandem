/**
 * EVO-2 · OKR 智能纠偏（强约束 3+1 版）
 *
 * 设计原则（来自 docs/EVOLUTION-2026-05.md & MANIFESTO §15）:
 *   - 零 LLM 调用：完全基于规则映射 health issue → 可执行建议
 *   - 永不自动改写 OKR：仅产出 Suggestion[]，用户点击「应用」才落库
 *   - 频次约束：每个目标最多 3 个建议 + 1 个主动询问，避免轰炸
 *   - 全审计：调用 applySuggestion 时由调用方记录 OKRActivity
 *
 * 与 lib/okr/health.ts 的关系：
 *   - health.ts 产出「问题」(诊断)
 *   - diagnosis.ts 产出「行动建议」(处方)
 *   - 二者分层，避免规则膨胀
 */

import type { HealthIssue } from './health';

export type SuggestionActionKind =
  | 'jump-to-objective' // 跳转到目标详情
  | 'jump-to-kr' // 跳转到 KR 详情
  | 'open-checkin' // 打开 Check-in 对话框
  | 'open-kr-editor' // 打开新增 KR 编辑器
  | 'open-objective-editor' // 打开目标编辑（用于调权重/上级）
  | 'open-discussion'; // 打开评论/讨论

export interface SuggestionAction {
  kind: SuggestionActionKind;
  /** 目标/KR id */
  targetId: string;
  /** 操作标签（按钮文案） */
  label: string;
}

export interface OKRSuggestion {
  id: string;
  severity: 'error' | 'warning' | 'info';
  /** 建议标题（≤ 30 字，祈使句） */
  title: string;
  /** 建议依据（引用 health issue 原文，让员工知道为什么） */
  rationale: string;
  /** 单条建议只配一个动作，避免决策疲劳 */
  action: SuggestionAction;
  /** 源问题 code（用于审计） */
  sourceCode: string;
}

/** 优先级权重（越小越靠前） */
const SEVERITY_ORDER: Record<HealthIssue['severity'], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

/**
 * 将单个 health issue 映射为一条建议。返回 null 表示该 issue 无可执行建议
 * （例如周期级别的 EMPTY_CYCLE 通常由 UI 入口引导，无需在此重复）。
 */
function issueToSuggestion(issue: HealthIssue): OKRSuggestion | null {
  const targetId = issue.jumpTo?.id ?? issue.scopeId;
  const baseId = `sug-${issue.code}-${targetId}`;

  switch (issue.code) {
    case 'NO_KR':
      return {
        id: baseId,
        severity: issue.severity,
        title: '为该目标起草第一个 KR',
        rationale: issue.title,
        action: { kind: 'open-kr-editor', targetId, label: '起草 KR' },
        sourceCode: issue.code,
      };
    case 'TOO_MANY_KR':
      return {
        id: baseId,
        severity: issue.severity,
        title: '检视 KR 数量，考虑归并最低优先项',
        rationale: issue.title,
        action: { kind: 'jump-to-objective', targetId, label: '查看目标' },
        sourceCode: issue.code,
      };
    case 'WEIGHT_IMBALANCE':
      return {
        id: baseId,
        severity: issue.severity,
        title: '调整 KR 权重使总和 = 100',
        rationale: issue.title,
        action: { kind: 'open-objective-editor', targetId, label: '调权重' },
        sourceCode: issue.code,
      };
    case 'STALE':
    case 'NO_CHECKIN':
      return {
        id: baseId,
        severity: issue.severity,
        title: '本周做一次 Check-in',
        rationale: issue.title,
        action: { kind: 'open-checkin', targetId, label: '去 Check-in' },
        sourceCode: issue.code,
      };
    case 'CONFIDENCE_DECLINE':
      return {
        id: baseId,
        severity: issue.severity,
        title: '与协作者评估障碍并发起讨论',
        rationale: issue.title,
        action: { kind: 'open-discussion', targetId, label: '发起讨论' },
        sourceCode: issue.code,
      };
    case 'PROGRESS_REGRESSION':
      return {
        id: baseId,
        severity: issue.severity,
        title: '在下一次 Check-in 说明进度倒退原因',
        rationale: issue.title,
        action: { kind: 'open-checkin', targetId, label: '去 Check-in' },
        sourceCode: issue.code,
      };
    case 'OFFTRACK_NO_PLAN':
      return {
        id: baseId,
        severity: issue.severity,
        title: '为严重偏离的目标补「下一步计划」',
        rationale: issue.title,
        action: { kind: 'open-checkin', targetId, label: '补充计划' },
        sourceCode: issue.code,
      };
    case 'ORPHAN':
      return {
        id: baseId,
        severity: issue.severity,
        title: '为目标选择新上级或转为顶层目标',
        rationale: issue.title,
        action: { kind: 'open-objective-editor', targetId, label: '修正上级' },
        sourceCode: issue.code,
      };
    case 'TOO_MANY_OBJECTIVES':
    case 'CYCLE_ENDING_LAG':
    case 'EMPTY_CYCLE':
      // 周期级建议：交给用户在 UI 自然处理，不在此处弹动作按钮
      return null;
    default:
      return null;
  }
}

/**
 * 从 health issues 派生「行动建议」列表。
 *
 * 强约束:
 *   - 默认 maxCount = 3 (一次最多 3 条建议)
 *   - 同一 targetId 只保留最严重的一条 (避免同目标轰炸)
 *   - 按 severity 排序
 *
 * 输入: lib/okr/health.ts 的 issues（已排序）
 * 输出: OKRSuggestion[] (长度 ≤ maxCount)
 */
export function deriveSuggestions(
  issues: HealthIssue[],
  options: { maxCount?: number } = {},
): OKRSuggestion[] {
  const maxCount = options.maxCount ?? 3;
  const result: OKRSuggestion[] = [];
  const seenTargets = new Set<string>();

  const sorted = [...issues].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  for (const issue of sorted) {
    if (result.length >= maxCount) break;
    const suggestion = issueToSuggestion(issue);
    if (!suggestion) continue;
    if (seenTargets.has(suggestion.action.targetId)) continue;
    seenTargets.add(suggestion.action.targetId);
    result.push(suggestion);
  }
  return result;
}

/**
 * 主动询问候选：当 issues 为空时，从「最近活跃但本周未 Check-in 的目标」
 * 中选一个作为温和提醒。**调用方** 负责传入相关数据。
 *
 * 这里只暴露纯函数签名，UI 侧根据自身上下文决定是否使用。
 */
export interface ProactivePromptCandidate {
  objectiveId: string;
  objectiveTitle: string;
  daysSinceLastCheckin: number;
}

export function pickProactivePrompt(
  candidates: ProactivePromptCandidate[],
): ProactivePromptCandidate | null {
  if (candidates.length === 0) return null;
  // 选离上次 check-in 天数中位（不要选最久的，避免负罪感）
  const sorted = [...candidates].sort(
    (a, b) => a.daysSinceLastCheckin - b.daysSinceLastCheckin,
  );
  return sorted[Math.floor(sorted.length / 2)];
}
