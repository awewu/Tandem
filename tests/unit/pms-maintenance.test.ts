import { describe, it, expect } from 'vitest';
import {
  canTransitionMaintenance,
  maintenanceCoverage,
} from '@/lib/pms/maintenance-service';

describe('PMS maintenance · canTransitionMaintenance 状态机', () => {
  it('pending → assigned / cancelled', () => {
    expect(canTransitionMaintenance('pending', 'assigned')).toBe(true);
    expect(canTransitionMaintenance('pending', 'cancelled')).toBe(true);
  });

  it('assigned → in_progress / cancelled', () => {
    expect(canTransitionMaintenance('assigned', 'in_progress')).toBe(true);
    expect(canTransitionMaintenance('assigned', 'cancelled')).toBe(true);
  });

  it('in_progress → completed / cancelled', () => {
    expect(canTransitionMaintenance('in_progress', 'completed')).toBe(true);
    expect(canTransitionMaintenance('in_progress', 'cancelled')).toBe(true);
  });

  it('跳级/逆向/终态非法', () => {
    expect(canTransitionMaintenance('pending', 'completed')).toBe(false);
    expect(canTransitionMaintenance('pending', 'in_progress')).toBe(false);
    expect(canTransitionMaintenance('completed', 'pending')).toBe(false);
    expect(canTransitionMaintenance('cancelled', 'assigned')).toBe(false);
    expect(canTransitionMaintenance('', 'assigned')).toBe(false);
  });
});

describe('PMS maintenance · maintenanceCoverage 保内/保外', () => {
  it('保修有效 + 维修类 → warranty (保内免费)', () => {
    expect(maintenanceCoverage(true, 'repair')).toBe('warranty');
    expect(maintenanceCoverage(true, 'replacement')).toBe('warranty');
  });

  it('保修失效 → paid (无论类型)', () => {
    expect(maintenanceCoverage(false, 'repair')).toBe('paid');
    expect(maintenanceCoverage(false, 'replacement')).toBe('paid');
  });

  it('非维修类 (保养/巡检) → paid', () => {
    expect(maintenanceCoverage(true, 'maintenance')).toBe('paid');
    expect(maintenanceCoverage(true, 'inspection')).toBe('paid');
  });
});
