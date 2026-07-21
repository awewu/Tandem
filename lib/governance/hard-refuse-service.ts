/**
 * Hard-Refuse Service · 业务红线清单的 DB 读写 (Admin 热更新)
 *
 * 读取优先级 (高 → 低):
 *   1. DB KvStore (hard_refuse_config collection) — Admin 录入页 /admin/hard-refuse 写入
 *   2. DEFAULT_HARD_REFUSE_TOPICS (代码出厂兜底) — DB 无记录时回落
 *
 * 生产回答入口 (BossAI / IM / 搭子) 用 matchHardRefuseLive 做确定性快检 (无 LLM)。
 */

import { getStore } from '@/lib/storage/repository';
import {
  DEFAULT_HARD_REFUSE_TOPICS,
  matchHardRefuseWith,
  type HardRefuseTopic,
  type HardRefuseConfigRecord,
  type HardRefuseResult,
} from './hard-refuse-redlines';

const DEFAULT_TENANT = 'default';

function recordId(tenantId: string): string {
  return `hard_refuse_${tenantId}`;
}

/** 读取 DB 配置记录 (不存在返回 null; 任何异常 fail-soft 返回 null) */
async function fromDb(tenantId: string): Promise<HardRefuseConfigRecord | null> {
  try {
    const store = getStore();
    const rec = await store.hardRefuseConfig.get(recordId(tenantId));
    return rec ?? null;
  } catch {
    return null;
  }
}

/**
 * 获取生效的红线配置 (DB 覆盖出厂兜底)。
 * - DB 无记录 → { enabled:true, topics: DEFAULT }
 * - DB 有记录 → 用 DB 的 enabled + topics
 */
export async function getHardRefuseConfig(
  tenantId = DEFAULT_TENANT,
): Promise<{ enabled: boolean; topics: HardRefuseTopic[]; source: 'db' | 'default' }> {
  const db = await fromDb(tenantId);
  if (!db) {
    return { enabled: true, topics: DEFAULT_HARD_REFUSE_TOPICS, source: 'default' };
  }
  return {
    enabled: db.enabled !== false,
    topics: Array.isArray(db.topics) && db.topics.length > 0 ? db.topics : DEFAULT_HARD_REFUSE_TOPICS,
    source: 'db',
  };
}

/** 仅取生效主题清单 (便于展示/复用) */
export async function getHardRefuseTopics(tenantId = DEFAULT_TENANT): Promise<HardRefuseTopic[]> {
  const { topics } = await getHardRefuseConfig(tenantId);
  return topics;
}

/**
 * 生产入口用的红线快检 (读 DB → 兜底默认). enabled=false 时全部放行.
 * fail-soft: 任何异常都不阻断正常回答 (返回 hit:false)。
 */
export async function matchHardRefuseLive(
  text: string,
  tenantId = DEFAULT_TENANT,
): Promise<HardRefuseResult> {
  try {
    const { enabled, topics } = await getHardRefuseConfig(tenantId);
    if (!enabled) return { hit: false };
    return matchHardRefuseWith(text, topics);
  } catch {
    return { hit: false };
  }
}

/** 校验 + 规整一批主题 (去掉空 label / 空关键词; 生成缺失 id) */
function sanitizeTopics(raw: unknown): HardRefuseTopic[] {
  if (!Array.isArray(raw)) return [];
  const out: HardRefuseTopic[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Partial<HardRefuseTopic>;
    const label = typeof t.label === 'string' ? t.label.trim() : '';
    const keywords = Array.isArray(t.keywords)
      ? Array.from(new Set(t.keywords.map((k) => String(k).trim()).filter(Boolean)))
      : [];
    if (!label || keywords.length === 0) continue;
    let id = typeof t.id === 'string' && t.id.trim() ? t.id.trim() : '';
    if (!id || seen.has(id)) {
      id = `topic_${out.length + 1}_${Math.random().toString(36).slice(2, 6)}`;
    }
    seen.add(id);
    const redirect = typeof t.redirect === 'string' && t.redirect.trim()
      ? t.redirect.trim()
      : '这个问题涉及公司红线, 请转人工 / 走正式流程, 我不能替公司拍板。';
    out.push({ id, label, keywords, redirect });
  }
  return out;
}

/** Admin 保存 (upsert). 传入的 topics 会被规整; 空清单会被拒绝 (返回错误). */
export async function saveHardRefuseConfig(
  input: { enabled?: boolean; topics: unknown },
  updatedBy: string,
  tenantId = DEFAULT_TENANT,
): Promise<HardRefuseConfigRecord> {
  const topics = sanitizeTopics(input.topics);
  if (topics.length === 0) {
    throw new Error('至少需要 1 条有效红线主题 (含 label 与至少 1 个关键词)');
  }
  const store = getStore();
  const id = recordId(tenantId);
  const now = new Date().toISOString();
  const existing = await store.hardRefuseConfig.get(id);
  const enabled = input.enabled !== false;

  if (existing) {
    return store.hardRefuseConfig.update(id, {
      enabled,
      topics,
      updatedBy,
      updatedAt: now,
    } as never) as Promise<HardRefuseConfigRecord>;
  }

  return store.hardRefuseConfig.create({
    id,
    tenantId,
    enabled,
    topics,
    updatedBy,
    createdAt: now,
    updatedAt: now,
  });
}
