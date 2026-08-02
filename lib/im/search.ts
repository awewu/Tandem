/**
 * IM 搜索 · 全文 + 语义混合检索 (§Sprint1 · Megaplan "超越企业微信")
 *
 * 设计:
 *   - 并行两路召回: 词面 (KvStore ILIKE 子串) + 向量 (pgvector ANN, entityType='im_message')。
 *   - Reciprocal Rank Fusion (RRF) 融合去重 (纯确定性, 可单测)。
 *   - 权限边界: 只在【当前用户是成员】的频道内检索; 候选拉回后再按可见频道二次过滤,
 *     确保向量一路 (仅按 tenantId 过滤) 不会泄露越权频道消息。
 *   - Fail-soft (承 vector-store C6 三段降级): embedding/pgvector 未启用 → 纯词面; 任一路抛错不影响另一路。
 */

import { getStore } from '../storage/repository';
import { listMyChannels } from './service';
import { extractPreview, type ImMessage } from '../types/im';
import { searchEmbeddings } from '../infra/vector-store';

/** RRF 融合系数 (标准取 60, 与 lib/memory/agentic-retrieval.ts 一致)。 */
const RRF_K = 60;

export interface ImSearchHit {
  messageId: string;
  channelId: string;
  channelName: string;
  senderId: string;
  senderKind: ImMessage['senderKind'];
  /** 去 markdown/mention 的预览片段 */
  preview: string;
  createdAt: string;
  /** RRF 融合分 (降序排序用) */
  score: number;
}

export interface SearchMessagesInput {
  userId: string;
  tenantId?: string;
  query: string;
  /** 限定单个频道内搜索 (需为当前用户可见, 否则空结果)。不传 = 跨所有可见频道。 */
  channelId?: string;
  limit?: number;
}

/**
 * 搜索当前用户可见频道内的历史消息 (关键词 + 语义)。
 * 结果按 RRF 分降序, 同分按时间倒序。
 */
export async function searchMessages(input: SearchMessagesInput): Promise<ImSearchHit[]> {
  const q = (input.query ?? '').trim();
  if (!q) return [];
  const limit = input.limit ?? 30;
  const tenantId = input.tenantId ?? 'default';
  const store = getStore();

  // 1) 权限边界: 计算可见频道集合。
  const myChannels = await listMyChannels(input.userId, input.tenantId);
  let allowed = myChannels;
  if (input.channelId) {
    allowed = myChannels.filter((c) => c.id === input.channelId);
    if (allowed.length === 0) return []; // 无权访问指定频道 → 空 (不泄露存在性)
  }
  const allowedIds = allowed.map((c) => c.id);
  if (allowedIds.length === 0) return [];
  const allowedSet = new Set(allowedIds);
  const nameById = new Map(allowed.map((c) => [c.id, c.name]));

  // 2) 并行召回: 词面 (已按 allowedIds 下推过滤) + 向量 (仅按 tenantId, 稍后再过滤频道)。
  const depth = Math.max(limit * 2, 40);
  const [lexical, vector] = await Promise.all([
    store.imMessages
      .searchByBody({ query: q, channelIds: allowedIds, limit: depth })
      .catch(() => [] as ImMessage[]),
    searchEmbeddings({ queryText: q, tenantId, entityType: 'im_message', topK: depth }).catch(
      () => null,
    ),
  ]);

  // 3) RRF 融合两路名次。
  const rrf = new Map<string, number>();
  const addRank = (ids: string[]) => {
    ids.forEach((id, idx) => {
      rrf.set(id, (rrf.get(id) ?? 0) + 1 / (RRF_K + idx + 1));
    });
  };
  addRank(lexical.map((m) => m.id));
  if (vector) addRank(vector.map((h) => h.entityId));

  // 4) 拉候选实体 → 权限/软删二次过滤 → 排序截断。
  const candidateIds = Array.from(rrf.keys());
  const messages = await Promise.all(candidateIds.map((id) => store.imMessages.get(id)));
  const hits: ImSearchHit[] = [];
  for (const m of messages) {
    if (!m || m.deletedAt) continue;
    // 权限边界二次校验: 向量一路可能召回越权频道消息, 必须剔除。
    if (!allowedSet.has(m.channelId)) continue;
    hits.push({
      messageId: m.id,
      channelId: m.channelId,
      channelName: nameById.get(m.channelId) ?? m.channelId,
      senderId: m.senderId,
      senderKind: m.senderKind,
      preview: extractPreview(m.body ?? ''),
      createdAt: m.createdAt,
      score: rrf.get(m.id) ?? 0,
    });
  }
  hits.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
  return hits.slice(0, limit);
}
