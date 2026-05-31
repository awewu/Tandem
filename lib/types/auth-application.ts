/**
 * AuthApplication · 外部人员注册申请 (审批制)
 *
 * 与邀请码 (AuthInvite) 的区别:
 *   - 邀请码: Owner/Admin 主动生成 → 外部人员凭码注册即激活 (即时)
 *   - 申请审批: 外部人员先填表 → Owner/Admin 审批 → 通过后自动创建 User + 发激活邮件
 *
 * 状态机:
 *   pending → approved (生成 User + roles) → consumed (登录后)
 *   pending → rejected (拒绝, 不可申诉, 14 天后自动清理)
 *
 * 数据落 KvStore collection 'auth_applications' (P1: 升级为强类型 AuthApplication 表).
 */

import type { Role } from '../auth/roles';

export type AuthApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface AuthApplication {
  id: string;
  email: string;
  name: string;
  /** 申请理由 (必填, 50-500 字) — 防垃圾申请 + 给审批者上下文 */
  reason: string;
  /** 申请者希望进入的板块 (审批者参考, 非强制).
   *  naba = 拿捏 (个人 AI / Persona), dazi = 搭子 (IM / 文档 / 日历 / 学院).
   *  注意: 外部协作者默认不可申请 shiban (事半 OKR), 见 lib/auth/module-scope.ts. */
  requestedScopes?: ('naba' | 'dazi')[];
  /** 申请者填的"我是谁" 自由文本 — 公司/角色/联系方式等 */
  organization?: string;

  status: AuthApplicationStatus;

  /** 审批后写入的最终 roles (默认 ['guest']) */
  grantedRoles?: Role[];
  tenantId: string;

  /** 关联 invite code (审批通过时生成, 用于首次登录设密) */
  inviteCodeHash?: string;

  /** 申请来源 IP / UA — 反滥用追溯 */
  ip?: string | null;
  userAgent?: string | null;

  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
}
