/**
 * 搭子手抄 · 个人蒸馏服务 (A2)
 *
 * 隐私铁律 (承 megaplan C4): 只读本人已授权 (sharedToPersona) 笔记, 产物只进本人域,
 *   绝不写组织 Memory/OKR/baseline。承 C3: 建议默认 pending, 人确认才生效, 可忽略。
 */

import { generateId } from '../storage/repository';
import { getShouchaoStore } from './store';
import { audit } from '../audit/log';
import { getNote, updateNote } from './service';
import { buildCandidates, type DistillNote } from './distill-detect';
import type { ShouchaoDistillCandidate } from '../types/shouchao-distillation';
import type { ShouchaoNote } from '../types/shouchao';

function nowIso(): string {
  return new Date().toISOString();
}

/** 列出本人 pending 蒸馏候选 (最新在前)。 */
export async function listCandidates(ownerId: string): Promise<ShouchaoDistillCandidate[]> {
  const store = getShouchaoStore();
  const all = await store.shouchaoDistillCandidates.list({ ownerId } as Partial<ShouchaoDistillCandidate>);
  return all
    .filter((c) => c.status === 'pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface ScanResult {
  created: number;
  candidates: ShouchaoDistillCandidate[];
}

/**
 * 扫描本人已授权笔记, 生成蒸馏候选。幂等: 已存在 (任意状态) 同 signature 的候选跳过,
 * 避免重复扫描灌重复建议 / 复活已忽略项。
 */
export async function scanForCandidates(ownerId: string): Promise<ScanResult> {
  const store = getShouchaoStore();
  const notes = await store.shouchaoNotes.list({ ownerId } as Partial<ShouchaoNote>);
  // 隐私门: 只喂本人显式授权 (sharedToPersona) 且未删/未归档的笔记
  const opted: DistillNote[] = notes
    .filter((n) => n.sharedToPersona && !n.deletedAt && !n.archived)
    .map((n) => ({ id: n.id, title: n.title, content: n.content ?? '' }));

  const drafts = buildCandidates(opted);

  const existing = await store.shouchaoDistillCandidates.list({ ownerId } as Partial<ShouchaoDistillCandidate>);
  const seen = new Set(existing.map((c) => c.signature));

  const created: ShouchaoDistillCandidate[] = [];
  const ts = nowIso();
  for (const d of drafts) {
    if (seen.has(d.signature)) continue;
    seen.add(d.signature);
    const tenantId = notes.find((n) => n.id === d.noteIds[0])?.tenantId ?? 'default';
    const c = await store.shouchaoDistillCandidates.create({
      id: generateId('scdist'),
      ownerId,
      tenantId,
      type: d.type,
      noteIds: d.noteIds,
      signature: d.signature,
      suggestion: d.suggestion,
      rationale: d.rationale,
      status: 'pending',
      createdAt: ts,
      updatedAt: ts,
    });
    created.push(c);
  }
  await audit('shouchao.distill_scanned', ownerId, {
    targetType: 'shouchao_distill',
    metadata: { scanned: opted.length, created: created.length },
  });
  return { created: created.length, candidates: created };
}

async function getCandidate(ownerId: string, id: string): Promise<ShouchaoDistillCandidate | null> {
  const store = getShouchaoStore();
  const c = await store.shouchaoDistillCandidates.get(id);
  if (!c || c.ownerId !== ownerId) return null;
  return c;
}

/**
 * 应用候选 (人确认后)。
 *   - link: 在两条笔记正文互加 [[双链]] (仅本人笔记, 可撤回)
 *   - structure / summarize: 作为指引, 仅标记 applied (不自动改写正文)
 * 返回更新后的候选; 不存在/无权 → null。
 */
export async function applyCandidate(ownerId: string, id: string): Promise<ShouchaoDistillCandidate | null> {
  const c = await getCandidate(ownerId, id);
  if (!c || c.status !== 'pending') return c && c.status !== 'pending' ? c : null;
  const store = getShouchaoStore();

  if (c.type === 'link' && c.noteIds.length === 2) {
    const [a, b] = await Promise.all([getNote(ownerId, c.noteIds[0]), getNote(ownerId, c.noteIds[1])]);
    if (a && b) {
      if (!a.content.includes(`[[${b.title}]]`)) {
        await updateNote(ownerId, a.id, { content: `${a.content}\n\n相关: [[${b.title}]]` });
      }
      if (!b.content.includes(`[[${a.title}]]`)) {
        await updateNote(ownerId, b.id, { content: `${b.content}\n\n相关: [[${a.title}]]` });
      }
    }
  }

  const updated = await store.shouchaoDistillCandidates.update(id, {
    status: 'applied',
    resolvedAt: nowIso(),
    updatedAt: nowIso(),
  });
  await audit('shouchao.distill_applied', ownerId, {
    targetId: id,
    targetType: 'shouchao_distill',
    metadata: { type: c.type },
  });
  return updated;
}

/** 忽略候选。 */
export async function dismissCandidate(ownerId: string, id: string): Promise<boolean> {
  const c = await getCandidate(ownerId, id);
  if (!c) return false;
  const store = getShouchaoStore();
  await store.shouchaoDistillCandidates.update(id, {
    status: 'dismissed',
    resolvedAt: nowIso(),
    updatedAt: nowIso(),
  });
  await audit('shouchao.distill_dismissed', ownerId, {
    targetId: id,
    targetType: 'shouchao_distill',
    metadata: { type: c.type },
  });
  return true;
}
