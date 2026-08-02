/**
 * lib/memory/consolidation.ts · P2 #17 GAM 记忆整合触发器
 *
 * 前沿 (GAM, ACL 2026): 对话中实时写入引入噪声。记忆生命周期分两阶段:
 *   Episodic Buffering (局部事件缓冲, 隔离噪声) → Consolidation (语义变化触发时才整合到全局)。
 *
 * TandemAI 现状: memoryCaptureCandidates 仓 = episodic buffer (捕获候选进待沉淀队列)。
 * 本模块补 **consolidation trigger**: 不是每条候选都单独等人工采纳, 而是按主题聚类,
 * 把 buffer 里语义高度重叠的候选合并 (保留最高置信度, 其余标记 consolidated), 降噪后再交人工。
 *
 * 纪律: 纯确定性 (关键词重叠聚类, 无 LLM); 只改候选状态 (dismissed=consolidated), 绝不自动入库;
 *       fail-soft 永不抛。
 */

import type { MemoryCaptureCandidate } from './capture-types';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';
import { extractKeywords } from '@/lib/persona/srpo-patch';

/** 两候选主题相似度 (关键词 Jaccard)。 */
export function topicSimilarity(a: string, b: string): number {
  const ka = new Set(extractKeywords(a, 12));
  const kb = new Set(extractKeywords(b, 12));
  if (ka.size === 0 || kb.size === 0) return 0;
  let inter = 0;
  for (const k of Array.from(ka)) if (kb.has(k)) inter++;
  const union = ka.size + kb.size - inter;
  return union > 0 ? inter / union : 0;
}

export interface ConsolidationResult {
  scanned: number;
  groups: number;
  consolidated: number;
}

/**
 * 整合待沉淀队列: 把主题高度重叠 (相似度 ≥ threshold) 的 pending 候选聚成组,
 * 每组保留最高置信度的一条, 其余标记 dismissed (备注 consolidated), 降低人工审阅噪声。
 * @param opts.threshold 主题相似度阈值 (默认 0.5)
 */
export async function consolidatePendingCaptures(
  opts: { tenantId?: string; authorUserId?: string; threshold?: number } = {},
): Promise<ConsolidationResult> {
  const threshold = opts.threshold ?? 0.5;
  const result: ConsolidationResult = { scanned: 0, groups: 0, consolidated: 0 };
  try {
    const store = getStore();
    const all = (await store.memoryCaptureCandidates.list()) as MemoryCaptureCandidate[];
    const pending = all.filter(
      (c) =>
        c.status === 'pending' &&
        (!opts.tenantId || c.tenantId === opts.tenantId) &&
        (!opts.authorUserId || c.authorUserId === opts.authorUserId),
    );
    result.scanned = pending.length;
    if (pending.length < 2) return result;

    // 贪心聚类: 按相似度把候选归组
    const used = new Set<string>();
    for (let i = 0; i < pending.length; i++) {
      const seed = pending[i];
      if (used.has(seed.id)) continue;
      const group = [seed];
      used.add(seed.id);
      const seedText = `${seed.title} ${seed.body}`;
      for (let j = i + 1; j < pending.length; j++) {
        const cand = pending[j];
        if (used.has(cand.id)) continue;
        if (topicSimilarity(seedText, `${cand.title} ${cand.body}`) >= threshold) {
          group.push(cand);
          used.add(cand.id);
        }
      }
      if (group.length < 2) continue;
      result.groups += 1;
      // 保留最高置信度 (并列取最新), 其余标记 consolidated
      group.sort((a, b) => b.confidence - a.confidence || b.createdAt.localeCompare(a.createdAt));
      const keeper = group[0];
      for (const loser of group.slice(1)) {
        await store.memoryCaptureCandidates.update(loser.id, {
          status: 'dismissed',
          decidedAt: new Date().toISOString(),
          decidedBy: 'system:consolidation',
          rationale: `[consolidated] 主题与候选 ${keeper.id} 重叠, 已合并至该条 (GAM 整合)。原因: ${loser.rationale ?? ''}`.slice(0, 300),
        } as Partial<MemoryCaptureCandidate>);
        result.consolidated += 1;
      }
    }

    if (result.consolidated > 0) {
      logger.info(result, '[consolidation] GAM pending-capture consolidation done');
    }
    return result;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[consolidation] consolidatePendingCaptures failed (fail-soft)');
    return result;
  }
}
