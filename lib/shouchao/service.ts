/**
 * 搭子手抄 · 服务层
 *
 * 笔记 CRUD (按 ownerId 隔离) + 简易全文搜索. 通过 TandemStore 访问 KvStore,
 * 不直接依赖 DB 实现. 独立模块, 不与其它业务耦合.
 */

import { getStore, generateId } from '../storage/repository';
import { audit } from '../audit/log';
import type { ShouchaoNote } from '../types/shouchao';

export interface CreateNoteInput {
  ownerId: string;
  tenantId: string;
  title?: string;
  content?: string;
  tags?: string[];
  sourceUrl?: string;
  summary?: string;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  tags?: string[];
  sourceUrl?: string;
  summary?: string;
  pinned?: boolean;
  archived?: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** 列出某用户的全部笔记 (按 pinned + updatedAt 倒序), 支持关键词过滤. */
export async function listNotes(
  ownerId: string,
  opts?: { q?: string; includeArchived?: boolean },
): Promise<ShouchaoNote[]> {
  const store = getStore();
  const all = await store.shouchaoNotes.list({ ownerId } as Partial<ShouchaoNote>);
  const q = (opts?.q ?? '').trim().toLowerCase();
  const filtered = all.filter((n) => {
    if (n.deletedAt) return false; // 软删墓碑不出现在 UI
    if (!opts?.includeArchived && n.archived) return false;
    if (!q) return true;
    const hay = `${n.title}\n${n.content}\n${(n.tags ?? []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
  return filtered.sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export async function getNote(ownerId: string, id: string): Promise<ShouchaoNote | null> {
  const store = getStore();
  const note = await store.shouchaoNotes.get(id);
  if (!note || note.ownerId !== ownerId || note.deletedAt) return null;
  return note;
}

export async function createNote(input: CreateNoteInput): Promise<ShouchaoNote> {
  const store = getStore();
  const ts = nowIso();
  return store.shouchaoNotes.create({
    id: generateId('sc'),
    ownerId: input.ownerId,
    tenantId: input.tenantId,
    title: (input.title ?? '').trim() || '未命名笔记',
    content: input.content ?? '',
    tags: input.tags ?? [],
    sourceUrl: input.sourceUrl,
    summary: input.summary,
    pinned: false,
    archived: false,
    createdAt: ts,
    updatedAt: ts,
  });
}

/** 更新笔记 — 仅 owner 可改. 返回 null 表示不存在或无权. */
export async function updateNote(
  ownerId: string,
  id: string,
  patch: UpdateNoteInput,
): Promise<ShouchaoNote | null> {
  const existing = await getNote(ownerId, id);
  if (!existing) return null;
  const store = getStore();
  const clean: Partial<ShouchaoNote> = { updatedAt: nowIso() };
  if (patch.title !== undefined) clean.title = patch.title.trim() || '未命名笔记';
  if (patch.content !== undefined) clean.content = patch.content;
  if (patch.tags !== undefined) clean.tags = patch.tags;
  if (patch.sourceUrl !== undefined) clean.sourceUrl = patch.sourceUrl;
  if (patch.summary !== undefined) clean.summary = patch.summary;
  if (patch.pinned !== undefined) clean.pinned = patch.pinned;
  if (patch.archived !== undefined) clean.archived = patch.archived;
  return store.shouchaoNotes.update(id, clean);
}

/**
 * 删除 = 软删 (打墓碑). 保留记录供多设备增量同步把"删除"也传播出去.
 * UI/列表通过 deletedAt 过滤掉, 用户无感知差异.
 */
export async function deleteNote(ownerId: string, id: string): Promise<boolean> {
  const existing = await getNote(ownerId, id);
  if (!existing) return false;
  const store = getStore();
  const ts = nowIso();
  await store.shouchaoNotes.update(id, { deletedAt: ts, updatedAt: ts });
  return true;
}

// ---------------------------------------------------------------------------
// 数据接口层 · 多设备/手机云端增量同步 (last-write-wins by updatedAt)
// ---------------------------------------------------------------------------

export interface SyncPullResult {
  notes: ShouchaoNote[];   // since 之后变更的活跃笔记
  deleted: string[];       // since 之后被软删的笔记 id (墓碑)
  serverTime: string;      // 本次响应的服务端时间, 客户端存为下次 since 游标
}

/** 拉取自 since 以来的全部变更 (含删除墓碑). since 缺省/非法 = 全量. */
export async function pullChanges(
  ownerId: string,
  since?: string,
): Promise<SyncPullResult> {
  const store = getStore();
  const all = await store.shouchaoNotes.list({ ownerId } as Partial<ShouchaoNote>);
  const sinceMs = since ? Date.parse(since) : NaN;
  const changed = Number.isNaN(sinceMs)
    ? all
    : all.filter((n) => Date.parse(n.updatedAt) > sinceMs);
  return {
    notes: changed.filter((n) => !n.deletedAt),
    deleted: changed.filter((n) => n.deletedAt).map((n) => n.id),
    serverTime: nowIso(),
  };
}

/**
 * 时钟偏移钳制: 客户端(尤其离线手机)时钟可能比服务端快. 若放任未来时间戳进 LWW,
 * 一台"快钟"设备的旧写会永远压过服务端新写. 这里把"超过服务端当前时间"的客户端
 * 时间戳钳到服务端时间 (允许 SKEW_TOLERANCE_MS 的正常网络/抖动余量),
 * 让 LWW 始终以服务端时钟为权威上界. 慢钟只会让自己的写更易被覆盖 (危害小, 用户重编即可).
 */
const SKEW_TOLERANCE_MS = 60_000; // 1 分钟容差

function clampToServerClock(clientIso: string | undefined, serverIso: string): string {
  if (!clientIso) return serverIso;
  const c = Date.parse(clientIso);
  const s = Date.parse(serverIso);
  if (Number.isNaN(c)) return serverIso;
  return c > s + SKEW_TOLERANCE_MS ? serverIso : clientIso;
}

/** 客户端推送本地变更, 服务端按 updatedAt LWW 合并 (钳制时钟偏移), 返回权威态. */
export async function pushChanges(
  ownerId: string,
  tenantId: string,
  incoming: ShouchaoNote[],
): Promise<ShouchaoNote[]> {
  const store = getStore();
  const result: ShouchaoNote[] = [];
  for (const inc of incoming) {
    if (!inc?.id) continue;
    const existing = await store.shouchaoNotes.get(inc.id);
    // 隔离: 只能写自己的笔记 (existing 属于别人则跳过)
    if (existing && existing.ownerId !== ownerId) continue;
    const serverNow = nowIso();
    // 钳制客户端时间戳到服务端时钟上界, 防快钟设备永久压制
    const incUpdatedAt = clampToServerClock(inc.updatedAt, serverNow);
    if (!existing) {
      const created = await store.shouchaoNotes.create({
        ...inc,
        ownerId,
        tenantId,
        createdAt: clampToServerClock(inc.createdAt, serverNow),
        updatedAt: incUpdatedAt,
      });
      result.push(created);
      continue;
    }
    // LWW: 仅当 incoming(钳制后) 更新时间更晚才覆盖
    if (Date.parse(incUpdatedAt) > Date.parse(existing.updatedAt)) {
      const merged = await store.shouchaoNotes.update(inc.id, {
        title: inc.title,
        content: inc.content,
        tags: inc.tags,
        sourceUrl: inc.sourceUrl,
        summary: inc.summary,
        pinned: inc.pinned,
        archived: inc.archived,
        deletedAt: inc.deletedAt,
        sharedToPersona: inc.sharedToPersona,
        updatedAt: incUpdatedAt,
      });
      if (merged) result.push(merged);
    } else {
      result.push(existing);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 员工本人闸门 · 逐条 opt-in 喂给工作分身 (默认关, 可撤回, 公司无入口)
// ---------------------------------------------------------------------------

/**
 * 开关某条笔记的"喂给我的工作分身"授权. 仅 owner 可改.
 * - enabled=true  : 标记 sharedToPersona, 授权工作分身(牛马搭子)读取该笔记内容
 * - enabled=false : 撤回授权
 * 全程 audit(actor=本人). 这里只管"授权位"+留痕; 分身侧如何消费这条语料是另一份 spec.
 */
export async function setSharedToPersona(
  ownerId: string,
  id: string,
  enabled: boolean,
): Promise<ShouchaoNote | null> {
  const existing = await getNote(ownerId, id);
  if (!existing) return null;
  const store = getStore();
  const updated = await store.shouchaoNotes.update(id, {
    sharedToPersona: enabled,
    updatedAt: nowIso(),
  });
  await audit(
    enabled ? 'shouchao.shared_to_persona' : 'shouchao.unshared_from_persona',
    ownerId,
    {
      targetId: id,
      targetType: 'shouchao_note',
      tenantId: existing.tenantId,
      metadata: { enabled },
    },
  );
  return updated;
}

// ---------------------------------------------------------------------------
// 自我成长 · 把员工本人授权的手抄笔记作为"个人语料"召回, 供其工作分身(牛马搭子)参考.
// 纯个人范围 (ownerId 隔离), 绝不读他人/公司 Memory. 这是"从笔记自我成长的搭子"的消费端.
// ---------------------------------------------------------------------------

const PERSONA_CORPUS_TOP_K = 5;

/** 中英混合分词: 英文按整词, 中文按字 (与 baseline-guard / retriever 一致). */
function tokenizeMixed(s: string): Set<string> {
  const tokens = new Set<string>();
  const re = /([a-zA-Z0-9]+)|([\u4e00-\u9fa5])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s.toLowerCase())) !== null) tokens.add(m[1] ?? m[2]);
  return tokens;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * 取员工本人已授权(sharedToPersona)的笔记中与 intent 最相关的若干条.
 * - 严格 ownerId 隔离, 只读本人笔记, 不读公司/他人 Memory
 * - 排除软删/归档
 * - 有 intent: 关键词相似度 (jaccard) 排序取 topK; 无命中回落最近授权笔记做轻量背景
 * - 无 intent: 直接回落最近授权笔记
 * 关键词匹配对个人小语料零成本、无 N+1 API; 规模上来再升级 embedding.
 */
export async function retrieveSharedNotesForPersona(
  ownerId: string,
  intent: string,
  opts?: { topK?: number },
): Promise<ShouchaoNote[]> {
  const store = getStore();
  const all = await store.shouchaoNotes.list({ ownerId } as Partial<ShouchaoNote>);
  const shared = all.filter((n) => n.sharedToPersona && !n.deletedAt && !n.archived);
  if (shared.length === 0) return [];

  const topK = opts?.topK ?? PERSONA_CORPUS_TOP_K;
  const byRecent = (a: ShouchaoNote, b: ShouchaoNote) => b.updatedAt.localeCompare(a.updatedAt);
  const q = (intent ?? '').trim();
  if (!q) return [...shared].sort(byRecent).slice(0, topK);

  const qt = tokenizeMixed(q);
  const scored = shared
    .map((n) => ({
      n,
      s: jaccard(qt, tokenizeMixed(`${n.title} ${n.content} ${(n.tags ?? []).join(' ')}`)),
    }))
    .sort((a, b) => b.s - a.s);
  const matched = scored.filter((x) => x.s > 0).slice(0, topK).map((x) => x.n);
  // 有命中用命中; 全无命中给最近 3 条授权笔记做轻量个人背景
  return matched.length > 0 ? matched : [...shared].sort(byRecent).slice(0, Math.min(3, topK));
}
