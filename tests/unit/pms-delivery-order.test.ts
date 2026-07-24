import { describe, it, expect } from 'vitest';
import {
  canTransitionDelivery,
  canCompleteTask,
} from '@/lib/pms/delivery-order-service';

describe('PMS delivery-order · canTransitionDelivery 状态机', () => {
  it('pending → scheduled / cancelled 合法', () => {
    expect(canTransitionDelivery('pending', 'scheduled')).toBe(true);
    expect(canTransitionDelivery('pending', 'cancelled')).toBe(true);
  });

  it('scheduled → delivered / cancelled 合法', () => {
    expect(canTransitionDelivery('scheduled', 'delivered')).toBe(true);
    expect(canTransitionDelivery('scheduled', 'cancelled')).toBe(true);
  });

  it('delivered → completed 合法', () => {
    expect(canTransitionDelivery('delivered', 'completed')).toBe(true);
  });

  it('跳级/逆向流转非法', () => {
    expect(canTransitionDelivery('pending', 'delivered')).toBe(false);
    expect(canTransitionDelivery('pending', 'completed')).toBe(false);
    expect(canTransitionDelivery('delivered', 'scheduled')).toBe(false);
    expect(canTransitionDelivery('scheduled', 'completed')).toBe(false);
  });

  it('终态不可再流转', () => {
    expect(canTransitionDelivery('completed', 'pending')).toBe(false);
    expect(canTransitionDelivery('cancelled', 'scheduled')).toBe(false);
  });

  it('未知状态非法', () => {
    expect(canTransitionDelivery('', 'scheduled')).toBe(false);
    expect(canTransitionDelivery('foo', 'bar')).toBe(false);
  });
});

describe('PMS delivery-order · canCompleteTask', () => {
  it('pending / in_progress 可完成', () => {
    expect(canCompleteTask('pending')).toBe(true);
    expect(canCompleteTask('in_progress')).toBe(true);
  });

  it('已完成/未知不可再完成', () => {
    expect(canCompleteTask('completed')).toBe(false);
    expect(canCompleteTask('')).toBe(false);
  });
});
