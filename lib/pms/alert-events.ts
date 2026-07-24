/**
 * PMS · 告警事件映射 (纯函数)
 *
 * 将业务事件映射为告警载荷 (type/severity/targetRole 等). 不依赖任何 service,
 * 供各业务动作埋点调用 emitAlert(payload). 保持无副作用便于单测.
 */

export interface AlertPayload {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  entityType: string;
  entityId: string;
  message: string;
  targetRole?: string;
  targetUserId?: string;
}

/** 审批级别 → 目标角色 (L3=owner, L1/L2=manager) */
export function approvalRoleForLevel(level: number): string {
  return level >= 3 ? 'owner' : 'manager';
}

/** 价格申请提交 → 通知对应级别审批人 */
export function priceApplicationSubmittedAlert(p: {
  applicationId: string;
  discountRate: number;
  requiredLevel: number;
}): AlertPayload {
  const severity: AlertPayload['severity'] =
    p.requiredLevel >= 3 ? 'high' : p.requiredLevel === 2 ? 'medium' : 'low';
  return {
    type: 'price_approval_required',
    severity,
    entityType: 'price_application',
    entityId: p.applicationId,
    message: `价格申请待审批: 折扣 ${p.discountRate}% (需 L${p.requiredLevel} 审批)`,
    targetRole: approvalRoleForLevel(p.requiredLevel),
  };
}

/** 价格申请审批完成 → 通知申请人 */
export function priceApplicationDecidedAlert(p: {
  applicationId: string;
  applicantId: string;
  decision: 'approved' | 'rejected';
}): AlertPayload {
  return {
    type: 'price_application_decided',
    severity: 'low',
    entityType: 'price_application',
    entityId: p.applicationId,
    message: `你的价格申请已${p.decision === 'approved' ? '批准' : '驳回'}`,
    targetUserId: p.applicantId,
  };
}

/** 经销商订货单提交 → 通知内部确认 */
export function dealerOrderSubmittedAlert(p: {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
}): AlertPayload {
  return {
    type: 'dealer_order_confirmation_required',
    severity: 'medium',
    entityType: 'dealer_order',
    entityId: p.orderId,
    message: `新订货单待确认: ${p.orderNumber} (金额 ${p.totalAmount})`,
    targetRole: 'manager',
  };
}

/** 交付任务派工 → 通知被指派人 */
export function deliveryTaskAssignedAlert(p: {
  taskId: string;
  taskType: string;
  assignedTo: string;
  dueDate?: string;
}): AlertPayload {
  return {
    type: 'delivery_task_assigned',
    severity: 'medium',
    entityType: 'delivery_task',
    entityId: p.taskId,
    message: `新交付任务(${p.taskType}) 已指派给你${p.dueDate ? `, 截止 ${p.dueDate}` : ''}`,
    targetUserId: p.assignedTo,
  };
}

/** 合同生效 → 通知交付团队排产 */
export function contractApprovedAlert(p: {
  deliveryOrderId: string;
  customerName: string;
}): AlertPayload {
  return {
    type: 'contract_approved',
    severity: 'medium',
    entityType: 'delivery_order',
    entityId: p.deliveryOrderId,
    message: `合同已生效, 交付工单待排产: ${p.customerName}`,
    targetRole: 'manager',
  };
}

/** 维保报修 → 通知派单 (急修高优先) */
export function maintenanceReportedAlert(p: {
  recordId: string;
  maintenanceType: string;
  equipmentSNId: string;
}): AlertPayload {
  const urgentTypes = ['repair', 'fault', 'emergency', 'breakdown'];
  const severity: AlertPayload['severity'] = urgentTypes.includes(p.maintenanceType) ? 'high' : 'medium';
  return {
    type: 'maintenance_reported',
    severity,
    entityType: 'maintenance_record',
    entityId: p.recordId,
    message: `新维保工单(${p.maintenanceType}) 待派单: 设备 ${p.equipmentSNId}`,
    targetRole: 'manager',
  };
}
