/**
 * Approval · 通用审批单 (采购/请假等)
 *
 * KvStore-backed (collection: 'approvals'). 身份字段 (requester/tenantId)
 * 一律取自鉴权上下文, 不接受 body 注入. 当前为最小状态机 (pending→approved/rejected),
 * 审批流程编排 (路由/升级/会签) 为后续工作.
 */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: string;
  tenantId: string;
  title: string;
  /** 业务类型: expense / leave / generic ... */
  type: string;
  status: ApprovalStatus;
  /** 申请人 userId (取自鉴权上下文) */
  requester: string;
  /** 指定审批人 userId */
  approver: string;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
}
