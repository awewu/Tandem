/**
 * 搭子手抄 · 个人蒸馏候选 (A2)
 *
 * 仿组织云盘蒸馏 (lib/types/drive-distillation.ts), 但**纯个人域**:
 *   - 只扫员工本人已授权 (sharedToPersona) 的笔记
 *   - 产出"沉淀建议"草稿, 仅服务本人 (加双链 / 建摘要 / 提示结构化)
 *   - 绝不进组织 Memory/OKR/baseline (承 megaplan C4 隐私墙)
 *   - 人确认才生效 (承 C3), 可忽略
 *
 * 存储: KvStore collection 'shouchao_distill_candidates', ownerId 隔离, 无 DDL。
 */

export type ShouchaoDistillType =
  | 'link' // 两条相似笔记 → 建议互加 [[双链]]
  | 'summarize' // 超长笔记 → 建议生成摘要
  | 'structure'; // 表格/清单型笔记 → 建议抽取成数据库

export type ShouchaoDistillStatus = 'pending' | 'applied' | 'dismissed';

export interface ShouchaoDistillCandidate {
  id: string;
  ownerId: string;
  tenantId: string;
  type: ShouchaoDistillType;
  /** 相关笔记 id (link 为 2 条, 其余通常 1 条)。 */
  noteIds: string[];
  /** 去重签名 = `${type}:${sorted(noteIds).join(',')}`, 防重复扫描产重复候选。 */
  signature: string;
  /** 面向用户的建议正文 (可编辑后再应用)。 */
  suggestion: string;
  /** 为什么建议 (可解释性)。 */
  rationale: string;
  status: ShouchaoDistillStatus;
  /** 应用/忽略的操作时间。 */
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}
