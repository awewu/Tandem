/**
 * Document → Memory 升级 (DOC-2, charter §四 文档板块)
 *
 * 复用 `promoteImMessageToMemory` (lib/im/service.ts) 的相同模式:
 *   1. 读 Document
 *   2. 落 Material (originRefs 反链 document)
 *   3. proposePromotion (走 Lv1/2/3 三级签批 SLA)
 *   4. 反向写 document.spawnedPromotionId (避免重复发起)
 *
 * 这是文档模块"飞书云文档 18-24 月做不到"的第一条能力 — 任何文档可被
 * 任意员工提议沉淀为团队/部门/公司级 Memory, 走宪章 §8.1 签批闸门.
 */

import { audit } from '../audit/log';
import { getStore } from '../storage/repository';

export interface PromoteDocumentToMemoryInput {
  documentId: string;
  triggeredBy: string;
  /** 默认 'lesson' (lessson learnt). 可选 sop/case/redline/value/lesson */
  proposedType?: 'sop' | 'case' | 'redline' | 'value' | 'lesson';
  /** 默认从文档 title 复用; 可覆盖 */
  proposedTitle?: string;
  /** 默认 'team' (最低门槛, 鼓励员工沉淀) */
  level?: 'team' | 'dept' | 'company';
  /** 默认 false. true 时走 24h 紧急通道 (适合红线 / 公司价值) */
  isEmergencyTrack?: boolean;
}

export interface PromoteDocumentToMemoryResult {
  promotionId: string;
  materialId: string;
  documentId: string;
}

/** 截字符串前 N 字 (UTF-16, Unicode-safe approx) */
function trimPreview(text: string, max: number): string {
  if (!text) return '';
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max) + '…';
}

export async function promoteDocumentToMemory(
  input: PromoteDocumentToMemoryInput,
): Promise<PromoteDocumentToMemoryResult> {
  const store = getStore();

  const doc = await store.documents.get(input.documentId);
  if (!doc) throw new Error(`document ${input.documentId} not found`);
  if (doc.spawnedPromotionId) {
    throw new Error(
      `document ${input.documentId} 已发起过 Memory 升级 (promotion ${doc.spawnedPromotionId})`,
    );
  }

  const proposedType = input.proposedType ?? 'lesson';
  const title = input.proposedTitle ?? doc.title ?? trimPreview(String(doc.content ?? ''), 50) ?? '文档升级';
  const now = new Date().toISOString();

  // 1) 落 Material — body 携带文档原文 + originRefs 反链
  const material = await store.materials.create({
    type: 'project_doc' as const,
    title,
    body: {
      source: 'document',
      documentId: doc.id,
      title: doc.title,
      content: doc.content,
      docType: (doc as { type?: string }).type,
      originalOwnerId: doc.ownerId,
      originalUpdatedAt: doc.updatedAt,
    },
    originRefs: [`document:${doc.id}`],
    participants: Array.from(
      new Set([
        doc.ownerId,
        input.triggeredBy,
        ...(doc.permissions?.read ?? []),
        ...(doc.permissions?.write ?? []),
      ]),
    ),
    visibility: 'team' as const,
    createdBy: input.triggeredBy,
    createdAt: now,
    updatedAt: now,
  });

  // 2) 调 proposePromotion (动态 import 避免循环依赖, 与 IM service 一致)
  const { proposePromotion } = await import('../memory/promotion-flow');
  const promotion = await proposePromotion({
    materialId: material.id,
    proposedType,
    proposedTitle: title,
    proposedBody: typeof doc.content === 'string' ? doc.content : JSON.stringify(doc.content ?? ''),
    proposerId: input.triggeredBy,
    level: input.level ?? 'team',
    isEmergencyTrack: input.isEmergencyTrack ?? false,
  });

  // 3) 反向链接 — 防止重复发起
  await store.documents.update(doc.id, {
    spawnedPromotionId: promotion.id,
  } as Partial<typeof doc>);

  // 4) audit (与 promotion-flow 内部的 promotion_proposed 互补, 这里记 doc 侧的来源)
  await audit('memory.promotion_proposed', input.triggeredBy, {
    targetId: promotion.id,
    targetType: 'memory_promotion',
    metadata: {
      source: 'document',
      documentId: doc.id,
      documentTitle: doc.title,
      level: input.level ?? 'team',
    },
  });

  return {
    promotionId: promotion.id,
    materialId: material.id,
    documentId: doc.id,
  };
}
