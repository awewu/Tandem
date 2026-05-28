/**
 * §CA-9 / 路径 9 · DecisionCard 模式检测器 (V1 启发式)
 *
 * 器官 #14 · 习惯沉淀 — 上游
 *
 * 设计:
 *   扫公司所有 DecisionCard, 找重复模式.
 *   "重复" 的 V1 定义:
 *     - 同一 KR (primaryKrId) 关联 ≥ N 张 DC (默认 3)
 *     - 标题/描述含相同高频关键词 (≥ 2 张共享 ≥ 2 个非停用词)
 *     - 同一发起人 (createdBy) ≥ N 张 (例: 销售跟客户处理总会议)
 *
 * V1 输出 SkillProposalPattern[] (来给 generateSkillProposal()).
 *
 * V2 计划:
 *   - 引入 embedding 聚类 (k-means / DBSCAN)
 *   - 跨人 / 跨部门的隐式模式发现
 *   - "决策成功率" 加权 (仅高采纳率的模式才提议)
 */

import type { DecisionCard, ConvergenceState } from '@/lib/types/decision-card';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';
import type { SkillProposalPattern } from './skill-proposal';

export interface DetectPatternsInput {
  /** 至少多少张 DC 才算"模式", 默认 3 */
  minFrequency?: number;
  /** 仅扫最近 N 天的 DC, 默认 90 */
  windowDays?: number;
  /** 仅看 COMMIT 状态的 DC (排除还没收敛的), 默认 true */
  onlyCommitted?: boolean;
  /** 租户 */
  tenantId?: string;
  /** 上限返回多少个 pattern, 默认 10 */
  maxPatterns?: number;
}

const STOP_WORDS = new Set([
  '的', '是', '了', '在', '和', '与', '及', '或', '我', '们', '你', '他',
  '这', '那', '都', '不', '也', '就', '会', '能', '要', '给', '到', '从',
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'and', 'or',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'as', 'this', 'that',
]);

function tokenize(text: string): string[] {
  const out: string[] = [];
  const re = /([a-zA-Z]{3,})|([\u4e00-\u9fa5]{2,4})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text.toLowerCase())) !== null) {
    const t = m[1] ?? m[2];
    if (!STOP_WORDS.has(t)) out.push(t);
  }
  return out;
}

/**
 * 扫 DecisionCard, 输出候选 SkillProposalPattern[].
 * 永不抛错; 失败返回 [].
 */
export async function detectPatterns(
  input: DetectPatternsInput = {},
): Promise<SkillProposalPattern[]> {
  const minFreq = input.minFrequency ?? 3;
  const windowDays = input.windowDays ?? 90;
  const onlyCommitted = input.onlyCommitted ?? true;
  const maxPatterns = input.maxPatterns ?? 10;
  const tenantId = input.tenantId ?? 'default';

  try {
    const store = getStore();
    const all = await store.decisionCards.list();
    const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;

    let cards = all.filter(
      (c) =>
        (c.tenantId ?? 'default') === tenantId &&
        new Date(c.createdAt).getTime() >= since,
    );
    if (onlyCommitted) {
      cards = cards.filter((c) => (c.convergenceState as ConvergenceState) === 'COMMIT');
    }
    if (cards.length < minFreq) {
      return [];
    }

    const patterns: SkillProposalPattern[] = [];

    // 模式 1: 按 primaryKrId 分组 (同一 KR ≥ minFreq 张)
    const byKr = new Map<string, DecisionCard[]>();
    for (const c of cards) {
      if (!c.primaryKrId) continue;
      const arr = byKr.get(c.primaryKrId) ?? [];
      arr.push(c);
      byKr.set(c.primaryKrId, arr);
    }
    const byKrEntries = Array.from(byKr.entries());
    for (const [krId, group] of byKrEntries) {
      if (group.length < minFreq) continue;
      // 候选 id: snake_case from KR id + count suffix
      const cleanKr = krId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 30);
      patterns.push({
        proposedId: `kr_recurring__${cleanKr}`,
        description: `KR "${krId}" 反复出现的决策模式 (${group.length} 张 DC)`,
        triggerConditions: [
          `primaryKrId = ${krId}`,
          `决策类型集中在: ${Array.from(new Set(group.map((c) => c.decisionClass))).join(', ')}`,
        ],
        evidenceDecisionCardIds: group.map((c) => c.id),
        affectedContext: 'meeting_advice',
        frequency: group.length,
      });
    }

    // 模式 2: 按 title 关键词聚类 (≥ minFreq 张共享 ≥ 2 个高频词)
    const tokenIndex = new Map<string, Set<string>>(); // token → DC ids
    for (const c of cards) {
      const tokens = tokenize(`${c.title} ${(c as { description?: string }).description ?? ''}`);
      const unique = new Set(tokens);
      unique.forEach((t) => {
        if (!tokenIndex.has(t)) tokenIndex.set(t, new Set());
        tokenIndex.get(t)!.add(c.id);
      });
    }
    // 找高频 token (出现 ≥ minFreq 张 DC)
    const highFreqTokens: Array<{ token: string; cardIds: string[] }> = [];
    const tokenIndexEntries = Array.from(tokenIndex.entries());
    for (const [token, ids] of tokenIndexEntries) {
      if (ids.size >= minFreq) {
        highFreqTokens.push({ token, cardIds: Array.from(ids) });
      }
    }
    highFreqTokens.sort((a, b) => b.cardIds.length - a.cardIds.length);

    // 取 top N 个 token, 互相组合检查"共享 ≥ 2 个 token 的 DC 簇"
    // V1 简化: 单 token 即一个候选模式 (除非已被 KR 分组覆盖)
    const krCardIds = new Set<string>();
    for (const p of patterns) {
      p.evidenceDecisionCardIds.forEach((id) => krCardIds.add(id));
    }
    for (const { token, cardIds } of highFreqTokens.slice(0, 8)) {
      // 跳过已被 KR 模式覆盖的 (避免重复)
      const novel = cardIds.filter((id) => !krCardIds.has(id));
      if (novel.length < minFreq) continue;
      patterns.push({
        proposedId: `topic_recurring__${token}`,
        description: `"${token}" 主题反复出现的决策模式 (${novel.length} 张 DC)`,
        triggerConditions: [`决策标题/描述含关键词 "${token}"`],
        evidenceDecisionCardIds: novel,
        affectedContext: 'meeting_advice',
        frequency: novel.length,
      });
    }

    // 排序 + 截断
    patterns.sort((a, b) => b.frequency - a.frequency);
    return patterns.slice(0, maxPatterns);
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      '[pattern-detector] detectPatterns failed',
    );
    return [];
  }
}
