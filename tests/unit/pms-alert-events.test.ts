import { describe, it, expect } from 'vitest';
import {
  approvalRoleForLevel,
  priceApplicationSubmittedAlert,
  priceApplicationDecidedAlert,
  dealerOrderSubmittedAlert,
  maintenanceReportedAlert,
  deliveryTaskAssignedAlert,
  contractApprovedAlert,
} from '@/lib/pms/alert-events';

describe('PMS alert-events · approvalRoleForLevel', () => {
  it('L3 → owner, L1/L2 → manager', () => {
    expect(approvalRoleForLevel(3)).toBe('owner');
    expect(approvalRoleForLevel(2)).toBe('manager');
    expect(approvalRoleForLevel(1)).toBe('manager');
  });
});

describe('PMS alert-events · priceApplicationSubmittedAlert', () => {
  it('L3 → high + owner', () => {
    const a = priceApplicationSubmittedAlert({ applicationId: 'p1', discountRate: 20, requiredLevel: 3 });
    expect(a.type).toBe('price_approval_required');
    expect(a.severity).toBe('high');
    expect(a.targetRole).toBe('owner');
    expect(a.entityId).toBe('p1');
  });
  it('L2 → medium, L1 → low', () => {
    expect(priceApplicationSubmittedAlert({ applicationId: 'p', discountRate: 10, requiredLevel: 2 }).severity).toBe('medium');
    expect(priceApplicationSubmittedAlert({ applicationId: 'p', discountRate: 3, requiredLevel: 1 }).severity).toBe('low');
  });
});

describe('PMS alert-events · priceApplicationDecidedAlert', () => {
  it('通知申请人 (targetUserId), 含结果文案', () => {
    const a = priceApplicationDecidedAlert({ applicationId: 'p1', applicantId: 'u1', decision: 'approved' });
    expect(a.targetUserId).toBe('u1');
    expect(a.message).toContain('批准');
    const r = priceApplicationDecidedAlert({ applicationId: 'p1', applicantId: 'u1', decision: 'rejected' });
    expect(r.message).toContain('驳回');
  });
});

describe('PMS alert-events · dealerOrderSubmittedAlert', () => {
  it('通知内部确认 (medium + manager)', () => {
    const a = dealerOrderSubmittedAlert({ orderId: 'o1', orderNumber: 'DO-20260605-0042', totalAmount: 1000 });
    expect(a.type).toBe('dealer_order_confirmation_required');
    expect(a.severity).toBe('medium');
    expect(a.targetRole).toBe('manager');
    expect(a.message).toContain('DO-20260605-0042');
  });
});

describe('PMS alert-events · maintenanceReportedAlert', () => {
  it('急修类 → high', () => {
    expect(maintenanceReportedAlert({ recordId: 'm', maintenanceType: 'repair', equipmentSNId: 'sn' }).severity).toBe('high');
    expect(maintenanceReportedAlert({ recordId: 'm', maintenanceType: 'fault', equipmentSNId: 'sn' }).severity).toBe('high');
  });
  it('保养类 → medium', () => {
    expect(maintenanceReportedAlert({ recordId: 'm', maintenanceType: 'inspection', equipmentSNId: 'sn' }).severity).toBe('medium');
  });
});

describe('PMS alert-events · deliveryTaskAssignedAlert', () => {
  it('通知被指派人 (targetUserId), 含截止日', () => {
    const a = deliveryTaskAssignedAlert({ taskId: 't1', taskType: '安装', assignedTo: 'u9', dueDate: '2026-07-01' });
    expect(a.type).toBe('delivery_task_assigned');
    expect(a.targetUserId).toBe('u9');
    expect(a.message).toContain('2026-07-01');
  });
  it('无截止日不报错', () => {
    const a = deliveryTaskAssignedAlert({ taskId: 't1', taskType: '调试', assignedTo: 'u9' });
    expect(a.message).toContain('调试');
  });
});

describe('PMS alert-events · contractApprovedAlert', () => {
  it('通知交付团队排产 (medium + manager)', () => {
    const a = contractApprovedAlert({ deliveryOrderId: 'do1', customerName: '甲方A' });
    expect(a.type).toBe('contract_approved');
    expect(a.severity).toBe('medium');
    expect(a.targetRole).toBe('manager');
    expect(a.entityId).toBe('do1');
    expect(a.message).toContain('甲方A');
  });
});
