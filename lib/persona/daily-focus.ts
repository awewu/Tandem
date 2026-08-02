/**
 * lib/persona/daily-focus.ts · 中央 AI 个人日级聚焦简报 (对标 WorkBoard "Daily Focus")
 *
 * ─────────────────────────────────────────────────────────
 * 定位 (与既有能力的分工, 不重复造轮子):
 *   - lib/work-risk/*        = 风险雷达 (self/team/org, 4 源, 谁的什么在风险上) — 被动扫描
 *   - lib/persona/business-review.ts = 组织级月度经营回顾 (老板 pre-read)
 *   - 本文件 daily-focus      = "我今天该做什么" 个人晨间行动简报: 把分散信号
 *                              合成为「排序后的今日聚焦 + 一句话摘要 + 建议下一步」,
 *                              可直接推送 (IM / 首页置顶), 每天而非每月。
 *
 * 复用 (不重算): OKR 风险维度直接消费 lib/work-risk/okr-signals 的 self 信号
 *   (它已按挣值法 EVM 算好目标滞后 + 逾期行动项, 且含证据可见性治理)。
 * 补齐 (work-risk 没有的个人行动维度): 否决窗将闭 / TTI 待推进 / 分身升阶待确认。
 *
 * 宪法 A 边界: 中央 AI 是参谋 — 本简报全是 advisory, 只汇总真值 + 建议, 不自动改任何数据。
 * fail-soft: 任一数据源失败退化为空段, 简报仍能出。
 */

import { getStore } from '../storage/repository';
import { logger } from '../infra/logger';
import { buildOkrWorkRiskSignals } from '../work-risk/okr-signals';
import { checkUpgradeEligibility } from './evolution';
import { deriveSigningAuthority } from '../governance/signing-authority';
import { PROMOTION_REQUIRED_ROLES, type MemoryPromotionRequest } from '../types/memory';
import type { WorkRiskSignal } from '../work-risk/types';

// ────────────────── 常量 ──────────────────

const VETO_WINDOW_MS = 24 * 60 * 60 * 1000;
/** 否决窗剩余不足此值 → 标记 actNow (今天必须决定要不要推翻) */
const VETO_ACT_NOW_MS = 12 * 60 * 60 * 1000;
/** 签批 SLA 剩余不足此值 → 标记 actNow (今天必须签) */
const SIGNATURE_ACT_NOW_MS = 24 * 60 * 60 * 1000;
/** 简报最多展示的聚焦项 (避免信息过载, 晨报只给最该做的几件) */
const MAX_ITEMS = 8;

// ────────────────── 类型 ──────────────────

export type DailyFocusKind =
  | 'okr_risk'
  | 'overdue_action'
  | 'veto_closing'
  | 'signature_pending'
  | 'tti_advance'
  | 'persona_upgrade';

export type DailyFocusSeverity = 'high' | 'medium' | 'low';

export interface DailyFocusItem {
  id: string;
  kind: DailyFocusKind;
  severity: DailyFocusSeverity;
  /** 今天有时限、需立即处理 */
  actNow: boolean;
  title: string;
  detail: string;
  href?: string;
  dueAt?: string | null;
}

export interface DailyFocus {
  userId: string;
  generatedAt: string;
  itemCount: number;
  actNowCount: number;
  highCount: number;
  /** 一句话晨间摘要 (可直接读) */
  headline: string;
  /** 单一最高优先级"下一步"建议; 无事项则 null */
  suggestedNextStep: string | null;
  /** 已排序、已截断的聚焦项 */
  items: DailyFocusItem[];
  /** 可直接 IM / 邮件推送的 Markdown */
  markdown: string;
}

// ────────────────── 纯函数核心 (可独立单测) ──────────────────

export interface DailyFocusInput {
  userId: string;
  now: number;
  /** work-risk self scope 的 OKR 信号 (已含挣值法风险 + 逾期行动项) */
  riskSignals: WorkRiskSignal[];
  /** 我 COMMIT 且仍在 24h 否决窗内的决议 */
  vetoClosing: Array<{ id: string; title: string; committedAtMs: number }>;
  /** 待我签字的 Memory 晋升 (已按签批角色派生过滤) */
  pendingSignatures: Array<{
    id: string;
    title: string;
    level: string;
    pendingRoles: string[];
    slaDeadlineMs: number | null;
  }>;
  /** 我 owner 且未完成的 TTI */
  ttiInProgress: Array<{ id: string; title: string; completionRate: number }>;
  /** 可确认的分身升阶 (无则 null) */
  personaUpgrade: { fromStage: string; toStage: string } | null;
}

const SEVERITY_RANK: Record<DailyFocusSeverity, number> = { high: 0, medium: 1, low: 2 };

/**
 * 把多源个人信号合成为排序后的今日聚焦。纯函数, 无副作用, 不读库。
 */
export function buildDailyFocus(input: DailyFocusInput): DailyFocus {
  const { userId, now } = input;
  const items: DailyFocusItem[] = [];

  // 1. OKR 风险 / 逾期行动项 (复用 work-risk, 只取本人为主体的信号)
  for (const sig of input.riskSignals) {
    if (sig.subjectUserId !== userId) continue;
    const isOverdue = sig.id.includes(':initiative:');
    items.push({
      id: `focus:${sig.id}`,
      kind: isOverdue ? 'overdue_action' : 'okr_risk',
      severity: sig.severity,
      actNow: sig.severity === 'high' || isOverdue,
      title: sig.title,
      detail: sig.detail,
      href: sig.href,
      dueAt: sig.dueAt ?? null,
    });
  }

  // 2. 待我签字的 Memory 晋升 (治理动作, SLA 驱动优先级)
  for (const s of input.pendingSignatures) {
    const overdue = s.slaDeadlineMs != null && s.slaDeadlineMs < now;
    const dueSoon = s.slaDeadlineMs != null && s.slaDeadlineMs - now < SIGNATURE_ACT_NOW_MS;
    items.push({
      id: `focus:signature:${s.id}`,
      kind: 'signature_pending',
      severity: overdue ? 'high' : 'medium',
      actNow: overdue || dueSoon,
      title: `待你签字: ${s.title}`,
      detail: overdue
        ? `${s.level} 级晋升已超签批 SLA, 待签角色 ${s.pendingRoles.join('/')}`
        : `${s.level} 级晋升待你以 ${s.pendingRoles.join('/')} 签字`,
      href: '/admin/steward',
      dueAt: s.slaDeadlineMs != null ? new Date(s.slaDeadlineMs).toISOString() : null,
    });
  }

  // 3. 否决窗将闭 (今天要决定要不要推翻自己刚 COMMIT 的决议)
  for (const d of input.vetoClosing) {
    const remainingMs = d.committedAtMs + VETO_WINDOW_MS - now;
    if (remainingMs <= 0) continue;
    const hours = Math.max(1, Math.round(remainingMs / (60 * 60 * 1000)));
    const closing = remainingMs < VETO_ACT_NOW_MS;
    items.push({
      id: `focus:veto:${d.id}`,
      kind: 'veto_closing',
      severity: closing ? 'medium' : 'low',
      actNow: closing,
      title: `否决窗将关闭: ${d.title}`,
      detail: `你的决议还剩约 ${hours} 小时可否决, 需保留请尽快确认`,
      href: `/convergence/${d.id}`,
      dueAt: new Date(d.committedAtMs + VETO_WINDOW_MS).toISOString(),
    });
  }

  // 4. TTI 待推进 (低优先级 nudge, 不挂钩薪酬)
  for (const t of input.ttiInProgress) {
    items.push({
      id: `focus:tti:${t.id}`,
      kind: 'tti_advance',
      severity: 'low',
      actNow: false,
      title: `推进成长目标: ${t.title}`,
      detail: `当前完成度 ${Math.round(t.completionRate * 100)}%`,
      href: '/okr',
      dueAt: null,
    });
  }

  // 5. 分身升阶待确认
  if (input.personaUpgrade) {
    items.push({
      id: 'focus:persona-upgrade',
      kind: 'persona_upgrade',
      severity: 'low',
      actNow: false,
      title: `分身可升阶: ${input.personaUpgrade.fromStage} → ${input.personaUpgrade.toStage}`,
      detail: '训练达标, 需你确认后升阶 (双 Consent)',
      href: '/persona',
      dueAt: null,
    });
  }

  // 排序: actNow 优先 → severity 高优先 → 有 dueAt 且更近的优先
  items.sort((a, b) => {
    if (a.actNow !== b.actNow) return a.actNow ? -1 : 1;
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    const ad = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bd = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    return ad - bd;
  });

  const capped = items.slice(0, MAX_ITEMS);
  const actNowCount = items.filter((i) => i.actNow).length;
  const highCount = items.filter((i) => i.severity === 'high').length;

  const headline = buildHeadline(items.length, actNowCount, highCount, capped[0]);
  const suggestedNextStep = capped[0] ? buildNextStep(capped[0]) : null;

  const focus: DailyFocus = {
    userId,
    generatedAt: new Date(now).toISOString(),
    itemCount: items.length,
    actNowCount,
    highCount,
    headline,
    suggestedNextStep,
    items: capped,
    markdown: '',
  };
  focus.markdown = renderMarkdown(focus);
  return focus;
}

function buildHeadline(
  total: number,
  actNowCount: number,
  highCount: number,
  top: DailyFocusItem | undefined,
): string {
  if (total === 0) {
    return '今天没有需要立即处理的事项, 专注推进目标即可。';
  }
  const parts: string[] = [`今天有 ${total} 项值得关注`];
  if (actNowCount > 0) parts.push(`${actNowCount} 项需立即处理`);
  if (highCount > 0) parts.push(`${highCount} 项高风险`);
  let head = parts.join(', ');
  if (top) head += `; 最优先: ${top.title}`;
  return head + '。';
}

function buildNextStep(top: DailyFocusItem): string {
  switch (top.kind) {
    case 'okr_risk':
      return `复盘落后目标「${top.title}」的根因, 调整本周行动或申请资源。`;
    case 'overdue_action':
      return `处理已逾期的行动项「${top.title}」: 更新状态或改期。`;
    case 'signature_pending':
      return `到治理台签署待你确认的 Memory 晋升: ${top.title}。`;
    case 'veto_closing':
      return `确认是否保留该决议 (否决窗即将关闭): ${top.title}。`;
    case 'tti_advance':
      return `花一点时间推进「${top.title}」。`;
    case 'persona_upgrade':
      return '到拿捏页确认分身升阶。';
    default:
      return `处理: ${top.title}。`;
  }
}

// ────────────────── Markdown 渲染 ──────────────────

const SEVERITY_TAG: Record<DailyFocusSeverity, string> = {
  high: '[高]',
  medium: '[中]',
  low: '[低]',
};

function renderMarkdown(f: DailyFocus): string {
  const lines: string[] = [];
  lines.push(`# 今日聚焦 · ${f.generatedAt.slice(0, 10)}`);
  lines.push('');
  lines.push(`_${f.headline}_`);
  lines.push('');
  if (f.items.length === 0) {
    lines.push('今天没有需要立即处理的事项。');
    return lines.join('\n');
  }
  if (f.suggestedNextStep) {
    lines.push(`**建议下一步**: ${f.suggestedNextStep}`);
    lines.push('');
  }
  const actNow = f.items.filter((i) => i.actNow);
  const later = f.items.filter((i) => !i.actNow);
  if (actNow.length > 0) {
    lines.push('## 需立即处理');
    lines.push('');
    for (const i of actNow) lines.push(renderItemLine(i));
    lines.push('');
  }
  if (later.length > 0) {
    lines.push('## 其余关注');
    lines.push('');
    for (const i of later) lines.push(renderItemLine(i));
  }
  lines.push('');
  lines.push('---');
  lines.push('_由中央 AI 作为参谋自动生成 (advisory), 基于真值汇总, 不替你决定。_');
  return lines.join('\n');
}

function renderItemLine(i: DailyFocusItem): string {
  return `- ${SEVERITY_TAG[i.severity]} **${i.title}** — ${i.detail}`;
}

// ────────────────── 读库生成器 (fail-soft) ──────────────────

export interface GenerateDailyFocusOptions {
  userId: string;
  now?: number;
}

/**
 * 从 store 组装个人日级聚焦。所有数据源 fail-soft, 单点失败不阻断整体。
 */
export async function generateDailyFocus(
  opts: GenerateDailyFocusOptions,
): Promise<DailyFocus> {
  const { userId } = opts;
  const now = opts.now ?? Date.now();

  const riskSignals = await buildOkrRiskSignals(userId, now).catch((err) => {
    logger.warn({ err: (err as Error).message }, '[daily-focus] okr signals failed');
    return [] as WorkRiskSignal[];
  });

  const vetoClosing = await buildVetoClosing(userId, now).catch((err) => {
    logger.warn({ err: (err as Error).message }, '[daily-focus] veto signals failed');
    return [] as DailyFocusInput['vetoClosing'];
  });

  const pendingSignatures = await buildPendingSignatures(userId).catch((err) => {
    logger.warn({ err: (err as Error).message }, '[daily-focus] signature signals failed');
    return [] as DailyFocusInput['pendingSignatures'];
  });

  const ttiInProgress = await buildTtiInProgress(userId).catch((err) => {
    logger.warn({ err: (err as Error).message }, '[daily-focus] tti signals failed');
    return [] as DailyFocusInput['ttiInProgress'];
  });

  const personaUpgrade = await buildPersonaUpgrade(userId).catch((err) => {
    logger.warn({ err: (err as Error).message }, '[daily-focus] persona signals failed');
    return null;
  });

  return buildDailyFocus({
    userId,
    now,
    riskSignals,
    vetoClosing,
    pendingSignatures,
    ttiInProgress,
    personaUpgrade,
  });
}

/** 只取本人 (self scope) 的 OKR 风险信号, 复用 work-risk 的挣值法算法。 */
async function buildOkrRiskSignals(userId: string, now: number): Promise<WorkRiskSignal[]> {
  const store = getStore();
  const [cycles, objectives, keyResults, initiatives] = await Promise.all([
    store.cycles.list(),
    store.objectives.list(),
    store.keyResults.list(),
    store.initiatives.list(),
  ]);
  return buildOkrWorkRiskSignals({
    viewerUserId: userId,
    people: [{ id: userId, name: userId }],
    cycles: cycles.map((c) => ({ id: c.id, startDate: c.startDate, endDate: c.endDate, isActive: c.isActive })),
    objectives: objectives.map((o) => ({
      id: o.id,
      title: o.title,
      cycleId: o.cycleId,
      ownerId: o.ownerId,
      status: o.status,
      visibility: o.visibility,
      progressOverride: o.progressOverride,
      currentProgress: o.currentProgress,
    })),
    keyResults: keyResults.map((k) => ({
      id: k.id,
      objectiveId: k.objectiveId,
      startValue: k.startValue,
      currentValue: k.currentValue,
      targetValue: k.targetValue,
      weight: k.weight,
      measureType: k.measureType,
    })),
    initiatives: initiatives.map((i) => ({
      id: i.id,
      title: i.title,
      ownerId: i.ownerId,
      status: i.status,
      dueDate: i.dueDate ?? null,
      keyResultId: i.keyResultId,
    })),
    now,
  });
}

async function buildVetoClosing(
  userId: string,
  now: number,
): Promise<DailyFocusInput['vetoClosing']> {
  const store = getStore();
  const cards = await store.decisionCards.list();
  return cards
    .filter((d) => d.createdBy === userId && d.convergenceState === 'COMMIT')
    .map((d) => ({ id: d.id, title: d.title, committedAtMs: d.createdAt ? new Date(d.createdAt).getTime() : 0 }))
    .filter((d) => d.committedAtMs > 0 && now - d.committedAtMs < VETO_WINDOW_MS);
}

/**
 * 待我签字的 Memory 晋升: 复用 me/dashboard 的签批角色派生逻辑。
 * 只保留"我持有 required 角色且该角色尚未签"的 pending 晋升。
 */
async function buildPendingSignatures(
  userId: string,
): Promise<DailyFocusInput['pendingSignatures']> {
  const store = getStore();
  const promotions = (await store.promotions.list()) as MemoryPromotionRequest[];
  const pending = promotions.filter((p) => p.status === 'pending');
  const results = await Promise.all(
    pending.map(async (p) => {
      const level = p.level ?? 'company';
      const required = PROMOTION_REQUIRED_ROLES[level] ?? [];
      const { roles: myRoles } = await deriveSigningAuthority({ userId, level });
      const myRequiredRoles = required.filter((r) => myRoles.includes(r));
      if (myRequiredRoles.length === 0) return null;
      const alreadySigned = new Set((p.signers?.history ?? []).map((s) => s.role));
      const pendingRoles = myRequiredRoles.filter((r) => !alreadySigned.has(r));
      if (pendingRoles.length === 0) return null;
      return {
        id: p.id,
        title: p.proposedTitle,
        level,
        pendingRoles,
        slaDeadlineMs: p.slaDeadline ? new Date(p.slaDeadline).getTime() : null,
      };
    }),
  );
  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

async function buildTtiInProgress(userId: string): Promise<DailyFocusInput['ttiInProgress']> {
  const store = getStore();
  const ttis = await store.ttis.list();
  return ttis
    .filter((t) => t.ownerId === userId && t.completionRate < 1)
    .map((t) => ({ id: t.id, title: t.title, completionRate: t.completionRate }));
}

async function buildPersonaUpgrade(
  userId: string,
): Promise<DailyFocusInput['personaUpgrade']> {
  const store = getStore();
  const personas = await store.personas.list();
  const mine = personas.find((p) => p.userId === userId) ?? null;
  if (!mine) return null;
  const check = checkUpgradeEligibility(mine);
  if (check.eligible && check.nextStage && check.requiresUserConfirmation) {
    return { fromStage: mine.stage, toStage: check.nextStage };
  }
  return null;
}
