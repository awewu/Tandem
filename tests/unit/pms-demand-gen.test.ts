import { describe, it, expect } from 'vitest';
import { canTransitionLead } from '@/lib/pms/demand-gen-service';

describe('PMS demand-gen · canTransitionLead 状态机', () => {
  it('new → assigned / dropped', () => {
    expect(canTransitionLead('new', 'assigned')).toBe(true);
    expect(canTransitionLead('new', 'dropped')).toBe(true);
  });
  it('assigned → nurturing / converted / dropped', () => {
    expect(canTransitionLead('assigned', 'nurturing')).toBe(true);
    expect(canTransitionLead('assigned', 'converted')).toBe(true);
    expect(canTransitionLead('assigned', 'dropped')).toBe(true);
  });
  it('nurturing → converted / dropped', () => {
    expect(canTransitionLead('nurturing', 'converted')).toBe(true);
    expect(canTransitionLead('nurturing', 'dropped')).toBe(true);
  });
  it('跳级/终态非法', () => {
    expect(canTransitionLead('new', 'converted')).toBe(false);
    expect(canTransitionLead('new', 'nurturing')).toBe(false);
    expect(canTransitionLead('converted', 'nurturing')).toBe(false);
    expect(canTransitionLead('dropped', 'assigned')).toBe(false);
    expect(canTransitionLead('', 'assigned')).toBe(false);
  });
});
