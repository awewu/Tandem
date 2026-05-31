/**
 * Text → Memory 升级 (沉淀闭环, A)
 *
 * 把任意一段文本 (搭子作战室对话产出 / 沙盒探索结论 / 主分身建议) 沉淀为
 * Memory 升级提议, 走宪章 §8.1 三级签批. 与 promoteImMessageToMemory /
 * promoteDocumentToMemory 同一模式:
 *   1. 落 Material (originRefs 反链来源)
 *   2. proposePromotion (Lv1/2/3 三级签批 SLA)
 *   3. audit
 *
 * 闭环: 用户点"沉淀" → Material → proposePromotion → (签批通过) materializePromotion
 *       → ownershipLevel='company' 的 Memory → company-brain 注入中央 AI → 反哺.
 */

import { audit } from '../audit/log';
import { getStore } from '../storage/repository';

export interface PromoteTextToMemoryInput {
  /** 提议标题; 缺省从 body 截前 50 字 */
  title?: string;
  /** 沉淀正文 (必填) */
  body: string;
  /** 提议人 userId (必填) */
  proposerId: string;
  /** sop|case|redline|value|lesson, 默认 'lesson' */
  proposedType?: 'sop' | 'case' | 'redline' | 'value' | 'lesson';
  /** team|dept|company, 默认 'team' (最低门槛, 鼓励沉淀) */
  level?: 'team' | 'dept' | 'company';
  /** 来源标识, 写进 Material originRefs + audit, 例: 'chat:作战室' */
  source?: string;
  /** 来源引用 (例: chat sessionId), 写进 originRefs 反链 */
  originRef?: string;
  /** 默认 false. true 走 24h 紧急通道 */
  isEmergencyTrack?: boolean;
}

export interface PromoteTextToMemoryResult {
  promotionId: string;
  materialId: string;
}

function trimPreview(text: string, max: number): string {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max) + '…';
}

export async function promoteTextToMemory(
  input: PromoteTextToMemoryInput,
): Promise<PromoteTextToMemoryResult> {
  const body = (input.body ?? '').trim();
  if (!body) throw new Error('body required');
  if (!input.proposerId) throw new Error('proposerId required');

  const store = getStore();
  const title = (input.title?.trim() || trimPreview(body, 50)) || '沉淀提议';
  const proposedType = input.proposedType ?? 'lesson';
  const source = input.source ?? 'text';
  const now = new Date().toISOString();

  // 1) 落 Material (origin 反链来源)
  const material = await store.materials.create({
    type: 'project_doc' as const,
    title,
    body: { source, text: body, ...(input.originRef ? { originRef: input.originRef } : {}) },
    originRefs: input.originRef ? [input.originRef] : [`text:${source}`],
    participants: [input.proposerId],
    visibility: 'team' as const,
    createdBy: input.proposerId,
    createdAt: now,
    updatedAt: now,
  });

  // 2) proposePromotion (动态 import 避免循环依赖, 与 im/document service 一致)
  const { proposePromotion } = await import('../memory/promotion-flow');
  const promotion = await proposePromotion({
    materialId: material.id,
    proposedType,
    proposedTitle: title,
    proposedBody: body,
    proposerId: input.proposerId,
    level: input.level ?? 'team',
    isEmergencyTrack: input.isEmergencyTrack ?? false,
  });

  // 3) audit (记来源侧, 与 promotion-flow 内部 promotion_proposed 互补)
  await audit('memory.promotion_proposed', input.proposerId, {
    targetId: promotion.id,
    targetType: 'memory_promotion',
    metadata: { source, level: input.level ?? 'team', proposedType },
  });

  return { promotionId: promotion.id, materialId: material.id };
}
